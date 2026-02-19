import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type {
	AuthorizationParams,
	OAuthServerProvider,
} from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type {
	OAuthClientInformationFull,
	OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import type { FetchLike } from "@modelcontextprotocol/sdk/shared/transport.js";
import { ShortcutClient } from "@shortcut/client";
import type { Response } from "express";

// ============================================================================
// Configuration (read lazily so tests can set env vars before creation)
// ============================================================================

function getAuthServer(): string {
	return process.env.AUTH_SERVER ?? "api.app.shortcut-staging.com";
}

function getUpstreamEndpoints() {
	const authServer = getAuthServer();
	return {
		authorizationUrl: `https://${authServer}/oauth-authorization-code-flow/code`,
		tokenUrl: `https://${authServer}/oauth-authorization-code-flow/token`,
	};
}

function getMcpServerUrl(): string {
	const defaultPort = process.env.PORT ?? "9292";
	return process.env.MCP_SERVER_URL ?? `http://localhost:${defaultPort}`;
}

function getDefaultRedirectUris(): string[] {
	const raw = process.env.OAUTH_ALLOWED_REDIRECT_URIS;
	if (!raw) {
		return [];
	}

	return raw
		.split(",")
		.map((uri) => uri.trim())
		.filter((uri) => uri.length > 0);
}

function getStaticClientInfo(): OAuthClientInformationFull | undefined {
	const clientId = process.env.SHORTCUT_OAUTH_CLIENT_ID;
	const clientSecret = process.env.SHORTCUT_OAUTH_CLIENT_SECRET;
	if (!clientId || !clientSecret) {
		return undefined;
	}
	return {
		client_id: clientId,
		client_secret: clientSecret,
		redirect_uris: [],
	};
}

function toPublicClientInfo(client: OAuthClientInformationFull): OAuthClientInformationFull {
	const {
		client_secret: _clientSecret,
		client_secret_expires_at: _clientSecretExpiresAt,
		...publicClient
	} = client;
	return publicClient as OAuthClientInformationFull;
}

// ============================================================================
// Default Token Verification
// ============================================================================

/**
 * Verifies an access token by calling the Shortcut API directly.
 * Used as a fallback for legacy Shortcut API tokens (not OAuth tokens).
 */
async function defaultVerifyAccessToken(token: string): Promise<AuthInfo> {
	try {
		const client = new ShortcutClient(token);
		const response = await client.getCurrentMemberInfo();

		if (!response.data) {
			throw new InvalidTokenError("No member data returned");
		}

		return {
			token,
			clientId: process.env.SHORTCUT_OAUTH_CLIENT_ID ?? "unknown",
			scopes: ["openid"],
			expiresAt: Math.floor(Date.now() / 1000) + 3600,
			extra: {
				memberId: response.data.id,
				mentionName: response.data.mention_name,
			},
		};
	} catch (error) {
		if (error instanceof InvalidTokenError) {
			throw error;
		}
		throw new InvalidTokenError("Invalid or expired access token");
	}
}

// ============================================================================
// Provider Factory
// ============================================================================

export interface CreateOAuthProviderOptions {
	/** Override the upstream auth server endpoints (useful for testing) */
	endpoints?: { authorizationUrl: string; tokenUrl: string };
	/** Override the access token verifier (useful for testing) */
	verifyAccessToken?: (token: string) => Promise<AuthInfo>;
	/** Override the client info lookup (useful for testing) */
	getClient?: (clientId: string) => Promise<OAuthClientInformationFull | undefined>;
	/** Override the static client info used for registration (useful for testing) */
	clientInfo?: OAuthClientInformationFull;
	/** Custom fetch implementation (useful for testing) */
	fetch?: FetchLike;
	/** The public URL of this MCP server (used to build the OAuth callback URL) */
	mcpServerUrl?: string;
}

/**
 * Extended provider that exposes the pending authorization map and callback path
 * so the server can mount a `/oauth/callback` route.
 */
export interface OAuthProviderWithCallback extends OAuthServerProvider {
	/** Map of state → original client redirect_uri for pending authorizations */
	pendingAuthorizations: Map<string, string>;
	/** The path the callback route should be mounted at */
	callbackPath: string;
}

/**
 * Creates an OAuthServerProvider configured for the Shortcut auth server.
 *
 * The provider uses pre-configured client credentials (from env vars) instead of
 * dynamic client registration. All MCP clients share the same OAuth client identity
 * when communicating with the upstream Shortcut auth server.
 *
 * - `skipLocalPkceValidation` is true because the upstream server handles PKCE.
 * - The `getClient` function returns the static client info for the pre-configured client_id,
 *   allowing the proxy to inject the client_secret during token exchange.
 * - The `registerClient` function on the clients store returns the static credentials
 *   so MCP clients can discover them during the registration step.
 */
export function createOAuthProvider(
	options?: CreateOAuthProviderOptions,
): OAuthProviderWithCallback {
	const endpoints = options?.endpoints ?? getUpstreamEndpoints();
	const staticClient = options?.clientInfo ?? getStaticClientInfo();
	const verifyToken = options?.verifyAccessToken ?? defaultVerifyAccessToken;
	const fetchFn = options?.fetch;
	const mcpServerUrl = options?.mcpServerUrl ?? getMcpServerUrl();

	const CALLBACK_PATH = "/oauth/callback";
	const callbackUrl = `${mcpServerUrl}${CALLBACK_PATH}`;

	// Store pending authorization requests: state → original client redirect_uri
	const pendingAuthorizations = new Map<string, string>();

	// Cache tokens issued through our token exchange so verifyAccessToken
	// can trust them without calling the Shortcut API (which doesn't accept
	// OAuth access tokens as API tokens).
	// Extended entry stores refresh_token for auto-refresh when access_token expires.
	interface TokenCacheEntry extends AuthInfo {
		refreshToken?: string;
	}
	const issuedTokens = new Map<string, TokenCacheEntry>();

	// Short default TTL because Shortcut's token endpoint may not return
	// expires_in, but the actual tokens expire quickly on the API side.
	const DEFAULT_TOKEN_TTL_SECONDS = 120;

	function cacheIssuedToken(tokens: OAuthTokens, clientId: string): void {
		const expiresAt = tokens.expires_in
			? Math.floor(Date.now() / 1000) + tokens.expires_in
			: Math.floor(Date.now() / 1000) + DEFAULT_TOKEN_TTL_SECONDS;

		issuedTokens.set(tokens.access_token, {
			token: tokens.access_token,
			clientId,
			scopes: tokens.scope?.split(" ") ?? ["openid"],
			expiresAt,
			refreshToken: tokens.refresh_token,
		});
	}

	/**
	 * Refreshes an expired token using the stored refresh_token.
	 * Updates the cache so both old and new tokens resolve to the fresh AuthInfo.
	 */
	async function refreshExpiredToken(
		oldToken: string,
		entry: TokenCacheEntry,
	): Promise<TokenCacheEntry> {
		if (!entry.refreshToken || !staticClient) {
			throw new InvalidTokenError("Token expired and no refresh token available");
		}

		const params = new URLSearchParams({
			grant_type: "refresh_token",
			client_id: staticClient.client_id,
			refresh_token: entry.refreshToken,
		});
		if (staticClient.client_secret) {
			params.set("client_secret", staticClient.client_secret);
		}

		const response = await (fetchFn ?? fetch)(endpoints.tokenUrl, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: params.toString(),
		});

		if (!response.ok) {
			const body = await response.text();
			console.error("Token refresh failed (expired-token flow)", { status: response.status, body });	   
			issuedTokens.delete(oldToken);
			throw new InvalidTokenError("Token refresh failed");
		}

		const tokens = (await response.json()) as OAuthTokens;
		const newExpiresAt = tokens.expires_in
			? Math.floor(Date.now() / 1000) + tokens.expires_in
			: Math.floor(Date.now() / 1000) + DEFAULT_TOKEN_TTL_SECONDS;

		const newEntry: TokenCacheEntry = {
			token: tokens.access_token,
			clientId: entry.clientId,
			scopes: tokens.scope?.split(" ") ?? entry.scopes,
			expiresAt: newExpiresAt,
			refreshToken: tokens.refresh_token ?? entry.refreshToken,
		};

		// Cache the new token
		issuedTokens.set(tokens.access_token, newEntry);
		// Also keep the old token mapped to the new entry so the MCP client's
		// stale token still resolves (until it re-auths or uses the new one).
		issuedTokens.set(oldToken, newEntry);

		return newEntry;
	}

	// Track redirect_uris from registrations and optional env allowlist.
	// The SDK will enforce exact membership via Array.includes().
	const registeredRedirectUris = new Set<string>(getDefaultRedirectUris());

	function buildRedirectUris(): string[] {
		return [...registeredRedirectUris];
	}

	const getClient =
		options?.getClient ??
		(async (clientId: string): Promise<OAuthClientInformationFull | undefined> => {
			if (!staticClient) {
				return undefined;
			}
			if (clientId === staticClient.client_id) {
				return toPublicClientInfo({
					...staticClient,
					redirect_uris: buildRedirectUris(),
				});
			}
			return undefined;
		});

	const clientsStore: OAuthRegisteredClientsStore = {
		getClient,
		registerClient: async (
			clientMetadata: Omit<OAuthClientInformationFull, "client_id" | "client_id_issued_at">,
		): Promise<OAuthClientInformationFull> => {
			if (!staticClient) {
				throw new Error(
					"OAuth client credentials not configured. " +
						"Set SHORTCUT_OAUTH_CLIENT_ID and SHORTCUT_OAUTH_CLIENT_SECRET.",
				);
			}

			// Track redirect_uris from this registration
			const redirectUris = (clientMetadata as OAuthClientInformationFull).redirect_uris;
			if (redirectUris) {
				for (const uri of redirectUris) {
					registeredRedirectUris.add(uri);
				}
			}

			const publicMetadata = toPublicClientInfo(clientMetadata as OAuthClientInformationFull);

			// Return the static client_id but do not expose client_secret to callers.
			return {
				...publicMetadata,
				client_id: staticClient.client_id,
				client_id_issued_at: Math.floor(Date.now() / 1000),
				redirect_uris: [...registeredRedirectUris],
				token_endpoint_auth_method: "none",
			} as OAuthClientInformationFull;
		},
	};

	return {
		clientsStore,
		skipLocalPkceValidation: true,
		pendingAuthorizations,
		callbackPath: CALLBACK_PATH,

		async authorize(
			client: OAuthClientInformationFull,
			params: AuthorizationParams,
			res: Response,
		): Promise<void> {
			// Save the client's original redirect_uri so our /oauth/callback
			// can relay the auth code back to the client.
			if (params.state) {
				pendingAuthorizations.set(params.state, params.redirectUri);
			}

			const targetUrl = new URL(endpoints.authorizationUrl);
			const searchParams = new URLSearchParams({
				client_id: client.client_id,
				response_type: "code",
				// Use OUR callback URL for the upstream server, not the client's
				redirect_uri: callbackUrl,
				code_challenge: params.codeChallenge,
				code_challenge_method: "S256",
			});
			if (params.state) searchParams.set("state", params.state);
			if (params.scopes?.length) searchParams.set("scope", params.scopes.join(" "));
			if (params.resource) searchParams.set("resource", params.resource.href);
			targetUrl.search = searchParams.toString();
			res.redirect(targetUrl.toString());
		},

		async challengeForAuthorizationCode(): Promise<string> {
			// In a proxy setup, the upstream server validates the code challenge
			return "";
		},

		async exchangeAuthorizationCode(
			client: OAuthClientInformationFull,
			authorizationCode: string,
			codeVerifier?: string,
			_redirectUri?: string,
			resource?: URL,
		): Promise<OAuthTokens> {
			const params = new URLSearchParams({
				grant_type: "authorization_code",
				client_id: client.client_id,
				code: authorizationCode,
			});
			if (staticClient?.client_secret) {
				params.append("client_secret", staticClient.client_secret);
			}
			if (codeVerifier) params.append("code_verifier", codeVerifier);
			// Always use OUR callback URL, since that's what the upstream auth
			// server saw during the authorization step.
			params.append("redirect_uri", callbackUrl);
			if (resource) params.append("resource", resource.href);

			const response = await (fetchFn ?? fetch)(endpoints.tokenUrl, {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: params.toString(),
			});

			if (!response.ok) {
				const body = await response.text();
				console.error("Token exchange failed", { status: response.status, body });
				throw new Error(`Token exchange failed: ${response.status} ${body}`);
			}

			const tokens = (await response.json()) as OAuthTokens;
			cacheIssuedToken(tokens, client.client_id);
			return tokens;
		},

		async exchangeRefreshToken(
			client: OAuthClientInformationFull,
			refreshToken: string,
			scopes?: string[],
			resource?: URL,
		): Promise<OAuthTokens> {
			const params = new URLSearchParams({
				grant_type: "refresh_token",
				client_id: client.client_id,
				refresh_token: refreshToken,
			});
			if (staticClient?.client_secret) {
				params.set("client_secret", staticClient.client_secret);
			}
			if (scopes?.length) params.set("scope", scopes.join(" "));
			if (resource) params.set("resource", resource.href);

			const response = await (fetchFn ?? fetch)(endpoints.tokenUrl, {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: params.toString(),
			});

			if (!response.ok) {
				const body = await response.text();
				console.error("Token refresh failed", { status: response.status, body });
				throw new Error(`Token refresh failed: ${response.status}`);
			}

			const tokens = (await response.json()) as OAuthTokens;
			cacheIssuedToken(tokens, client.client_id);
			return tokens;
		},

		async verifyAccessToken(token: string): Promise<AuthInfo> {
			// First check if this is a token we issued through our proxy
			const cached = issuedTokens.get(token);
			if (cached) {
				const now = Date.now() / 1000;
				const REFRESH_BUFFER_SECONDS = 60;

				// If expired or near-expiry, try to refresh
				if (cached.expiresAt && cached.expiresAt < now + REFRESH_BUFFER_SECONDS) {
					try {
						return await refreshExpiredToken(token, cached);
					} catch {
						// If refresh fails and token is fully expired, reject
						if (cached.expiresAt < now) {
							issuedTokens.delete(token);
							throw new InvalidTokenError("Token has expired");
						}
						// If just near-expiry but refresh failed, allow it through
					}
				}
				return cached;
			}

			// Fall back to direct Shortcut API verification (for API tokens)
			return verifyToken(token);
		},
	};
}
