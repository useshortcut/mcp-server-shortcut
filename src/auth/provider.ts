import { randomBytes } from "node:crypto";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import {
	InvalidClientError,
	InvalidGrantError,
	InvalidRequestError,
	InvalidTokenError,
	ServerError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";
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

function getApiBaseUrl(): string {
	return `https://${getAuthServer()}`;
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

const DEFAULT_AUTHORIZATION_SCOPES = ["openid"] as const;
const DEFAULT_CLIENT_EXPIRES_IN_SECONDS = 3600;

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

function normalizeTokensForClient(tokens: OAuthTokens): OAuthTokens {
	return {
		...tokens,
		token_type: tokens.token_type || "Bearer",
		expires_in:
			tokens.expires_in && tokens.expires_in > 0
				? tokens.expires_in
				: DEFAULT_CLIENT_EXPIRES_IN_SECONDS,
	};
}

function throwMappedUpstreamOAuthError(status: number, body: string): never {
	let upstreamError: { error?: string; error_description?: string } | undefined;
	try {
		upstreamError = JSON.parse(body) as { error?: string; error_description?: string };
	} catch {
		upstreamError = undefined;
	}

	const description =
		upstreamError?.error_description || body || `OAuth upstream error (${status})`;
	switch (upstreamError?.error) {
		case "invalid_request":
			throw new InvalidRequestError(description);
		case "invalid_client":
			throw new InvalidClientError(description);
		case "invalid_grant":
			throw new InvalidGrantError(description);
		case "server_error":
			throw new ServerError(description);
		default:
			if (status >= 500) {
				throw new ServerError(description);
			}
			throw new InvalidGrantError(description);
	}
}

// ============================================================================
// Default Token Verification
// ============================================================================

/**
 * Verifies an access token by calling the Shortcut API directly.
 * Supports both:
 * - OAuth access tokens via Authorization: Bearer
 * - Legacy Shortcut API tokens via Shortcut-Token header (fallback)
 */
async function defaultVerifyAccessToken(token: string): Promise<AuthInfo> {
	const clientId = process.env.SHORTCUT_OAUTH_CLIENT_ID ?? "unknown";
	const baseURL = getApiBaseUrl();

	// First, try OAuth bearer-token validation. This handles uncached tokens
	// after server restarts or requests routed to a different server instance.
	try {
		const oauthClient = createOAuthVerificationClient(token, baseURL);
		const oauthResponse = await oauthClient.getCurrentMemberInfo();

		if (!oauthResponse.data) {
			throw new InvalidTokenError("No member data returned");
		}

		const member = oauthResponse.data as { id: string | number; mention_name?: string };
		return {
			token,
			clientId,
			scopes: ["openid"],
			expiresAt: Math.floor(Date.now() / 1000) + 3600,
			extra: {
				memberId: String(member.id),
				mentionName: member.mention_name,
			},
		};
	} catch {
		// Fall through to legacy token verification below.
	}

	// Fallback: legacy Shortcut API token in Shortcut-Token header.
	try {
		const legacyClient = new ShortcutClient(token, { baseURL });
		const legacyResponse = await legacyClient.getCurrentMemberInfo();

		if (!legacyResponse.data) {
			throw new InvalidTokenError("No member data returned");
		}

		const member = legacyResponse.data as { id: string | number; mention_name?: string };
		return {
			token,
			clientId,
			scopes: ["openid"],
			expiresAt: Math.floor(Date.now() / 1000) + 3600,
			extra: {
				memberId: String(member.id),
				mentionName: member.mention_name,
			},
		};
	} catch (error) {
		if (error instanceof InvalidTokenError) {
			throw error;
		}
		throw new InvalidTokenError("Invalid or expired access token");
	}
}

function createOAuthVerificationClient(accessToken: string, baseURL: string): ShortcutClient {
	const client = new ShortcutClient("_placeholder_", {
		baseURL,
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	});

	// Remove Shortcut-Token header so Shortcut API only sees Bearer auth.
	// biome-ignore lint/suspicious/noExplicitAny: accessing axios internals
	const instance = (client as any).instance;
	if (instance?.defaults?.headers) {
		delete instance.defaults.headers["Shortcut-Token"];
		if (instance.defaults.headers.common) {
			delete instance.defaults.headers.common["Shortcut-Token"];
		}
	}

	return client;
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
	/** Map of proxy state → pending authorization details */
	pendingAuthorizations: Map<string, PendingAuthorization>;
	/** The path the callback route should be mounted at */
	callbackPath: string;
}

export interface PendingAuthorization {
	clientId: string;
	clientState: string;
	redirectUri: string;
	createdAtMs: number;
}

interface RegisteredClientEntry {
	clientId: string;
	redirectUris: string[];
	createdAtMs: number;
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

	// Store pending authorization requests: proxyState → pending authorization details.
	const pendingAuthorizations = new Map<string, PendingAuthorization>();

	// Cache tokens issued through our token exchange so verifyAccessToken
	// can trust them without calling the Shortcut API (which doesn't accept
	// OAuth access tokens as API tokens).
	// Extended entry stores refresh_token for auto-refresh when access_token expires.
	interface TokenCacheEntry extends AuthInfo {
		refreshToken?: string;
	}
	const issuedTokens = new Map<string, TokenCacheEntry>();
	const issuedTokenOrder: string[] = [];

	// Keep in-memory stores bounded to reduce memory DoS risk.
	const MAX_ISSUED_TOKENS = 10_000;
	const MAX_PENDING_AUTHORIZATIONS = 2_000;
	const PENDING_AUTH_TTL_MS = 10 * 60 * 1000;
	const MAX_REGISTERED_CLIENTS = 10_000;
	const REGISTERED_CLIENT_TTL_MS = 24 * 60 * 60 * 1000;
	const MAX_REDIRECT_URIS_PER_CLIENT = 20;

	// Short default TTL because Shortcut's token endpoint may not return
	// expires_in, but the actual tokens expire quickly on the API side.
	const DEFAULT_TOKEN_TTL_SECONDS = 120;

	function normalizeClientState(state: string): string {
		// Preserve client-supplied state exactly in callbacks.
		return state;
	}

	function makeProxyState(clientState: string): string {
		// Prefix client state with server entropy to avoid state collisions across clients.
		const nonce = randomBytes(16).toString("hex");
		return `${nonce}.${clientState}`;
	}

	function parseRedirectUri(uri: string): URL {
		let parsed: URL;
		try {
			parsed = new URL(uri);
		} catch {
			throw new InvalidRequestError(`Invalid redirect_uri: ${uri}`);
		}
		if (parsed.hash) {
			throw new InvalidRequestError("redirect_uri must not contain fragment");
		}

		// Permit https everywhere and loopback-only http for local IDE callbacks.
		const isLoopbackHost =
			parsed.hostname === "localhost" ||
			parsed.hostname === "127.0.0.1" ||
			parsed.hostname === "::1" ||
			parsed.hostname === "[::1]";
		if (parsed.protocol === "https:") {
			return parsed;
		}
		if (parsed.protocol === "http:" && isLoopbackHost) {
			return parsed;
		}
		throw new InvalidRequestError("redirect_uri must use https or loopback http");
	}

	function validateRedirectUris(
		redirectUris: string[] | undefined,
		options?: { allowEmpty?: boolean },
	): string[] {
		if (!redirectUris?.length) {
			if (options?.allowEmpty) {
				return [];
			}
			throw new InvalidRequestError("At least one redirect_uri is required");
		}
		if (redirectUris.length > MAX_REDIRECT_URIS_PER_CLIENT) {
			throw new InvalidRequestError(
				`Too many redirect_uris; max allowed is ${MAX_REDIRECT_URIS_PER_CLIENT}`,
			);
		}
		return [...new Set(redirectUris.map((uri) => parseRedirectUri(uri).toString()))];
	}

	function evictOldestFromMap<T>(map: Map<string, T>): void {
		const first = map.keys().next().value as string | undefined;
		if (first) {
			map.delete(first);
		}
	}

	function cleanupPendingAuthorizations(nowMs: number): void {
		for (const [state, pending] of pendingAuthorizations.entries()) {
			if (nowMs - pending.createdAtMs > PENDING_AUTH_TTL_MS) {
				pendingAuthorizations.delete(state);
			}
		}
	}

	function setIssuedToken(token: string, entry: TokenCacheEntry): void {
		if (!issuedTokens.has(token)) {
			issuedTokenOrder.push(token);
		}
		issuedTokens.set(token, entry);

		while (issuedTokens.size > MAX_ISSUED_TOKENS) {
			const oldest = issuedTokenOrder.shift();
			if (!oldest) break;
			if (issuedTokens.has(oldest)) {
				issuedTokens.delete(oldest);
			}
		}
	}

	const registeredClients = new Map<string, RegisteredClientEntry>();

	function cleanupRegisteredClients(nowMs: number): void {
		for (const [clientId, entry] of registeredClients.entries()) {
			if (nowMs - entry.createdAtMs > REGISTERED_CLIENT_TTL_MS) {
				registeredClients.delete(clientId);
			}
		}
	}

	function cacheIssuedToken(tokens: OAuthTokens, clientId: string): void {
		const expiresAt = tokens.expires_in
			? Math.floor(Date.now() / 1000) + tokens.expires_in
			: Math.floor(Date.now() / 1000) + DEFAULT_TOKEN_TTL_SECONDS;

		setIssuedToken(tokens.access_token, {
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
		setIssuedToken(tokens.access_token, newEntry);
		// Also keep the old token mapped to the new entry so the MCP client's
		// stale token still resolves (until it re-auths or uses the new one).
		setIssuedToken(oldToken, newEntry);

		return newEntry;
	}

	const defaultRedirectUris = validateRedirectUris(getDefaultRedirectUris(), { allowEmpty: true });
	if (defaultRedirectUris.length > 0) {
		const bootstrapClientId = randomBytes(16).toString("hex");
		registeredClients.set(bootstrapClientId, {
			clientId: bootstrapClientId,
			redirectUris: defaultRedirectUris,
			createdAtMs: Date.now(),
		});
	}

	const getClient =
		options?.getClient ??
		(async (clientId: string): Promise<OAuthClientInformationFull | undefined> => {
			cleanupRegisteredClients(Date.now());
			const entry = registeredClients.get(clientId);
			if (!entry) {
				return undefined;
			}
			return {
				client_id: entry.clientId,
				client_id_issued_at: Math.floor(entry.createdAtMs / 1000),
				redirect_uris: entry.redirectUris,
				token_endpoint_auth_method: "none",
			} as OAuthClientInformationFull;
		});

	const clientsStore: OAuthRegisteredClientsStore = {
		getClient,
		registerClient: async (
			clientMetadata: Omit<OAuthClientInformationFull, "client_id" | "client_id_issued_at">,
		): Promise<OAuthClientInformationFull> => {
			if (!staticClient?.client_id) {
				throw new Error(
					"OAuth client credentials not configured. " +
						"Set SHORTCUT_OAUTH_CLIENT_ID and SHORTCUT_OAUTH_CLIENT_SECRET.",
				);
			}

			const redirectUris = validateRedirectUris(
				(clientMetadata as OAuthClientInformationFull).redirect_uris,
			);
			const nowMs = Date.now();
			cleanupRegisteredClients(nowMs);
			while (registeredClients.size >= MAX_REGISTERED_CLIENTS) {
				evictOldestFromMap(registeredClients);
			}

			const clientId = randomBytes(16).toString("hex");
			const entry: RegisteredClientEntry = {
				clientId,
				redirectUris,
				createdAtMs: nowMs,
			};
			registeredClients.set(clientId, entry);

			const publicMetadata = toPublicClientInfo(clientMetadata as OAuthClientInformationFull);

			// Return a per-registration client identifier with its own redirect URIs.
			return {
				...publicMetadata,
				client_id: entry.clientId,
				client_id_issued_at: Math.floor(entry.createdAtMs / 1000),
				redirect_uris: entry.redirectUris,
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
			const nowMs = Date.now();
			cleanupPendingAuthorizations(nowMs);

			if (!params.state) {
				throw new InvalidRequestError("Missing state");
			}

			const registered = await getClient(client.client_id);
			if (!registered) {
				throw new InvalidClientError("Unknown client_id");
			}
			if (!registered.redirect_uris?.includes(params.redirectUri)) {
				throw new InvalidRequestError("Unregistered redirect_uri");
			}

			// Save callback relay info under an internal proxy-state to avoid cross-client collisions.
			const proxyState = makeProxyState(normalizeClientState(params.state));
			while (pendingAuthorizations.size >= MAX_PENDING_AUTHORIZATIONS) {
				evictOldestFromMap(pendingAuthorizations);
			}
			pendingAuthorizations.set(proxyState, {
				clientId: client.client_id,
				clientState: params.state,
				redirectUri: params.redirectUri,
				createdAtMs: nowMs,
			});

			const targetUrl = new URL(endpoints.authorizationUrl);
			const searchParams = new URLSearchParams({
				client_id: staticClient?.client_id ?? client.client_id,
				response_type: "code",
				// Use OUR callback URL for the upstream server, not the client's
				redirect_uri: callbackUrl,
				code_challenge: params.codeChallenge,
				code_challenge_method: "S256",
			});
			searchParams.set("state", proxyState);
			const scopes =
				params.scopes && params.scopes.length > 0 ? params.scopes : DEFAULT_AUTHORIZATION_SCOPES;
			searchParams.set("scope", scopes.join(" "));
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
			if (!staticClient?.client_id) {
				throw new InvalidClientError("OAuth client credentials not configured");
			}
			const params = new URLSearchParams({
				grant_type: "authorization_code",
				client_id: staticClient.client_id,
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
				throwMappedUpstreamOAuthError(response.status, body);
			}

			const tokens = normalizeTokensForClient((await response.json()) as OAuthTokens);
			cacheIssuedToken(tokens, client.client_id);
			return tokens;
		},

		async exchangeRefreshToken(
			client: OAuthClientInformationFull,
			refreshToken: string,
			scopes?: string[],
			resource?: URL,
		): Promise<OAuthTokens> {
			if (!staticClient?.client_id) {
				throw new InvalidClientError("OAuth client credentials not configured");
			}
			const params = new URLSearchParams({
				grant_type: "refresh_token",
				client_id: staticClient.client_id,
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
				throwMappedUpstreamOAuthError(response.status, body);
			}

			const tokens = normalizeTokensForClient((await response.json()) as OAuthTokens);
			cacheIssuedToken(tokens, client.client_id);
			return tokens;
		},

		async verifyAccessToken(token: string): Promise<AuthInfo> {
			cleanupPendingAuthorizations(Date.now());

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
