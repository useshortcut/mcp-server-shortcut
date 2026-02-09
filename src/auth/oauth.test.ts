import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import {
	getOAuthProtectedResourceMetadataUrl,
	mcpAuthRouter,
} from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import express from "express";
import type { Server } from "node:http";
import { createOAuthProvider } from "./provider";

// ============================================================================
// Test Configuration
// ============================================================================

const TEST_CLIENT_ID = "test-client-id-123";
const TEST_CLIENT_SECRET = "test-client-secret-456";
const TEST_ACCESS_TOKEN = "test-access-token-789";

// Set env vars before provider creation (module-level reads are lazy)
process.env.SHORTCUT_OAUTH_CLIENT_ID = TEST_CLIENT_ID;
process.env.SHORTCUT_OAUTH_CLIENT_SECRET = TEST_CLIENT_SECRET;
process.env.MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL = "true";

// ============================================================================
// Type helpers for JSON responses
// ============================================================================

interface OAuthMetadataResponse {
	issuer: string;
	authorization_endpoint: string;
	token_endpoint: string;
	registration_endpoint?: string;
	response_types_supported: string[];
	grant_types_supported: string[];
	token_endpoint_auth_methods_supported: string[];
	code_challenge_methods_supported: string[];
	scopes_supported: string[];
}

interface ResourceMetadataResponse {
	resource: string;
	authorization_servers: string[];
}

interface ClientInfoResponse {
	client_id: string;
	client_secret: string;
	client_secret_expires_at: number;
}

interface TokenResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
	refresh_token: string;
	scope?: string;
}

// ============================================================================
// Mock Token Verification
// ============================================================================

const mockVerifyAccessToken = mock(async (token: string): Promise<AuthInfo> => {
	if (token === TEST_ACCESS_TOKEN) {
		return {
			token,
			clientId: TEST_CLIENT_ID,
			scopes: ["openid"],
			expiresAt: Math.floor(Date.now() / 1000) + 3600,
			extra: { memberId: "member-1", mentionName: "testuser" },
		};
	}
	throw new InvalidTokenError("Invalid or expired access token");
});

// ============================================================================
// Mock Fetch for Upstream Auth Server
// ============================================================================

const mockFetch = mock(async (url: string | URL, init?: RequestInit): Promise<Response> => {
	const urlStr = url.toString();

	// Mock token exchange endpoint
	if (urlStr.includes("/oauth-authorization-code-flow/token") && init?.method === "POST") {
		const body = init.body?.toString() ?? "";
		const params = new URLSearchParams(body);

		if (params.get("grant_type") === "authorization_code") {
			const clientSecret = params.get("client_secret");
			if (clientSecret !== TEST_CLIENT_SECRET) {
				return new Response(
					JSON.stringify({
						error: "invalid_client",
						error_description: "Invalid client credentials",
					}),
					{ status: 401, headers: { "Content-Type": "application/json" } },
				);
			}

			return new Response(
				JSON.stringify({
					access_token: TEST_ACCESS_TOKEN,
					token_type: "Bearer",
					expires_in: 3600,
					refresh_token: "test-refresh-token",
					scope: "openid",
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		}

		if (params.get("grant_type") === "refresh_token") {
			return new Response(
				JSON.stringify({
					access_token: "refreshed-access-token",
					token_type: "Bearer",
					expires_in: 3600,
					refresh_token: "new-refresh-token",
					scope: "openid",
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		}
	}

	return new Response(JSON.stringify({ error: "unsupported" }), {
		status: 400,
		headers: { "Content-Type": "application/json" },
	});
});

// ============================================================================
// Test App Setup
// ============================================================================

let server: Server;
let baseUrl: string;

function createTestApp(): express.Express {
	const app = express();
	const placeholderUrl = "http://localhost:0";

	const provider = createOAuthProvider({
		verifyAccessToken: mockVerifyAccessToken,
		fetch: mockFetch as unknown as FetchLike,
		mcpServerUrl: placeholderUrl,
	});

	const mcpResourceUrl = new URL(`${placeholderUrl}/mcp`);
	const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(mcpResourceUrl);

	const bearerAuth = requireBearerAuth({
		verifier: provider,
		resourceMetadataUrl,
	});

	app.use(express.json());

	// Mount OAuth auth router
	app.use(
		mcpAuthRouter({
			provider,
			issuerUrl: new URL(placeholderUrl),
			baseUrl: new URL(placeholderUrl),
			resourceServerUrl: mcpResourceUrl,
			scopesSupported: ["openid"],
		}),
	);

	// OAuth callback relay
	app.get(provider.callbackPath, (req, res) => {
		const { code, state, error, error_description } = req.query as Record<string, string>;
		if (!state) {
			res.status(400).send("Missing state");
			return;
		}
		const originalRedirect = provider.pendingAuthorizations.get(state);
		if (!originalRedirect) {
			res.status(400).send("Unknown state");
			return;
		}
		provider.pendingAuthorizations.delete(state);
		const redirectUrl = new URL(originalRedirect);
		if (code) redirectUrl.searchParams.set("code", code);
		if (state) redirectUrl.searchParams.set("state", state);
		if (error) redirectUrl.searchParams.set("error", error);
		if (error_description) redirectUrl.searchParams.set("error_description", error_description);
		res.redirect(redirectUrl.toString());
	});

	// Health endpoint (unprotected)
	app.get("/health", (_req, res) => {
		res.json({ status: "ok" });
	});

	// MCP endpoint (protected)
	app.post("/mcp", bearerAuth, (_req, res) => {
		res.json({ jsonrpc: "2.0", result: { protocolVersion: "2025-06-18" }, id: 1 });
	});

	app.get("/mcp", bearerAuth, (_req, res) => {
		res.json({ status: "connected" });
	});

	app.delete("/mcp", bearerAuth, (_req, res) => {
		res.sendStatus(204);
	});

	return app;
}

type FetchLike = (url: string | URL, init?: RequestInit) => Promise<Response>;

beforeAll(async () => {
	const app = createTestApp();
	await new Promise<void>((resolve) => {
		server = app.listen(0, () => {
			const addr = server.address();
			if (addr && typeof addr === "object") {
				baseUrl = `http://localhost:${addr.port}`;
			}
			resolve();
		});
	});
});

afterAll(async () => {
	await new Promise<void>((resolve, reject) => {
		server.close((err) => (err ? reject(err) : resolve()));
	});
});

beforeEach(() => {
	mockVerifyAccessToken.mockClear();
	mockFetch.mockClear();
});

// ============================================================================
// Tests
// ============================================================================

describe("OAuth Flow Tests", () => {
	describe("Metadata Discovery", () => {
		test("GET /.well-known/oauth-protected-resource/mcp returns resource metadata", async () => {
			const res = await fetch(`${baseUrl}/.well-known/oauth-protected-resource/mcp`);
			expect(res.status).toBe(200);

			const data = (await res.json()) as ResourceMetadataResponse;
			expect(data.resource).toContain("/mcp");
			expect(data.authorization_servers).toBeDefined();
			expect(Array.isArray(data.authorization_servers)).toBe(true);
			expect(data.authorization_servers.length).toBeGreaterThan(0);
		});

		test("GET /.well-known/oauth-authorization-server returns OAuth metadata", async () => {
			const res = await fetch(`${baseUrl}/.well-known/oauth-authorization-server`);
			expect(res.status).toBe(200);

			const data = (await res.json()) as OAuthMetadataResponse;
			expect(data.issuer).toBeDefined();
			expect(data.authorization_endpoint).toBeDefined();
			expect(data.token_endpoint).toBeDefined();
			expect(data.response_types_supported).toContain("code");
			expect(data.grant_types_supported).toContain("authorization_code");
			expect(data.grant_types_supported).toContain("refresh_token");
			expect(data.token_endpoint_auth_methods_supported).toContain("client_secret_post");
			expect(data.code_challenge_methods_supported).toContain("S256");
			expect(data.scopes_supported).toContain("openid");
		});

		test("OAuth metadata includes registration_endpoint", async () => {
			const res = await fetch(`${baseUrl}/.well-known/oauth-authorization-server`);
			const data = (await res.json()) as OAuthMetadataResponse;
			expect(data.registration_endpoint).toBeDefined();
			expect(data.registration_endpoint).toContain("/register");
		});
	});

	describe("Client Registration (pre-configured)", () => {
		test("POST /register returns pre-configured client credentials", async () => {
			const res = await fetch(`${baseUrl}/register`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					redirect_uris: ["http://localhost:6274/oauth/callback"],
					client_name: "Test MCP Client",
				}),
			});

			expect(res.status).toBe(201);

			const data = (await res.json()) as ClientInfoResponse;
			expect(data.client_id).toBe(TEST_CLIENT_ID);
			expect(data.client_secret).toBe(TEST_CLIENT_SECRET);
			expect(data.client_secret_expires_at).toBe(0);
		});

		test("POST /register returns same credentials on repeated calls", async () => {
			const results = await Promise.all(
				[1, 2, 3].map(() =>
					fetch(`${baseUrl}/register`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							redirect_uris: ["http://localhost:6274/oauth/callback"],
						}),
					}).then((r) => r.json() as Promise<ClientInfoResponse>),
				),
			);

			for (const data of results) {
				expect(data.client_id).toBe(TEST_CLIENT_ID);
				expect(data.client_secret).toBe(TEST_CLIENT_SECRET);
			}
		});
	});

	describe("Authorization Flow", () => {
		test("GET /authorize redirects to upstream auth server", async () => {
			// First register the client to establish the redirect_uri
			await fetch(`${baseUrl}/register`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					redirect_uris: ["http://localhost:6274/oauth/callback"],
				}),
			});

			const params = new URLSearchParams({
				client_id: TEST_CLIENT_ID,
				response_type: "code",
				redirect_uri: "http://localhost:6274/oauth/callback",
				code_challenge: "test-code-challenge-value",
				code_challenge_method: "S256",
				state: "test-state-123",
				scope: "openid",
			});

			const res = await fetch(`${baseUrl}/authorize?${params}`, {
				redirect: "manual",
			});

			expect(res.status).toBe(302);

			const location = res.headers.get("location");
			expect(location).toBeDefined();
			expect(location).toContain("/oauth-authorization-code-flow/code");
			expect(location).toContain(`client_id=${TEST_CLIENT_ID}`);
			expect(location).toContain("code_challenge=");
			expect(location).toContain("code_challenge_method=S256");
			expect(location).toContain("state=test-state-123");
			expect(location).toContain("scope=openid");
			expect(location).toContain("redirect_uri=");
		});

		test("GET /authorize without required params returns error", async () => {
			const res = await fetch(`${baseUrl}/authorize`, {
				redirect: "manual",
			});

			// Should return an error (400 or redirect with error)
			expect(res.status).toBeGreaterThanOrEqual(400);
		});
	});

	describe("Token Exchange", () => {
		test("POST /token exchanges auth code for access token", async () => {
			const params = new URLSearchParams({
				grant_type: "authorization_code",
				code: "test-auth-code",
				client_id: TEST_CLIENT_ID,
				client_secret: TEST_CLIENT_SECRET,
				redirect_uri: "http://localhost:6274/oauth/callback",
				code_verifier: "test-code-verifier",
			});

			const res = await fetch(`${baseUrl}/token`, {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: params.toString(),
			});

			expect(res.status).toBe(200);

			const data = (await res.json()) as TokenResponse;
			expect(data.access_token).toBe(TEST_ACCESS_TOKEN);
			expect(data.token_type).toBe("Bearer");
			expect(data.expires_in).toBe(3600);
			expect(data.refresh_token).toBe("test-refresh-token");

			// Verify the upstream fetch was called with client_secret
			expect(mockFetch).toHaveBeenCalledTimes(1);
		});

		test("POST /token passes client_secret to upstream (client_secret_post)", async () => {
			const params = new URLSearchParams({
				grant_type: "authorization_code",
				code: "test-auth-code",
				client_id: TEST_CLIENT_ID,
				client_secret: TEST_CLIENT_SECRET,
				redirect_uri: "http://localhost:6274/oauth/callback",
				code_verifier: "test-code-verifier",
			});

			await fetch(`${baseUrl}/token`, {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: params.toString(),
			});

			expect(mockFetch).toHaveBeenCalledTimes(1);

			const [fetchUrl, fetchInit] = mockFetch.mock.calls[0] as [string, RequestInit];
			expect(fetchUrl).toContain("/oauth-authorization-code-flow/token");
			expect(fetchInit.method).toBe("POST");

			const upstreamBody = new URLSearchParams(fetchInit.body as string);
			expect(upstreamBody.get("client_secret")).toBe(TEST_CLIENT_SECRET);
			expect(upstreamBody.get("client_id")).toBe(TEST_CLIENT_ID);
			expect(upstreamBody.get("code")).toBe("test-auth-code");
			expect(upstreamBody.get("grant_type")).toBe("authorization_code");
		});

		test("POST /token with refresh_token grant returns new tokens", async () => {
			const params = new URLSearchParams({
				grant_type: "refresh_token",
				refresh_token: "test-refresh-token",
				client_id: TEST_CLIENT_ID,
				client_secret: TEST_CLIENT_SECRET,
			});

			const res = await fetch(`${baseUrl}/token`, {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: params.toString(),
			});

			expect(res.status).toBe(200);

			const data = (await res.json()) as TokenResponse;
			expect(data.access_token).toBe("refreshed-access-token");
			expect(data.refresh_token).toBe("new-refresh-token");
		});
	});

	describe("Protected MCP Endpoint", () => {
		test("POST /mcp without Bearer token returns 401", async () => {
			const res = await fetch(`${baseUrl}/mcp`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ jsonrpc: "2.0", method: "initialize", id: 1 }),
			});

			expect(res.status).toBe(401);

			const wwwAuth = res.headers.get("www-authenticate");
			expect(wwwAuth).toBeDefined();
			expect(wwwAuth).toContain("Bearer");
		});

		test("POST /mcp with valid Bearer token succeeds", async () => {
			const res = await fetch(`${baseUrl}/mcp`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${TEST_ACCESS_TOKEN}`,
				},
				body: JSON.stringify({ jsonrpc: "2.0", method: "initialize", id: 1 }),
			});

			// Token may be served from the issuedTokens cache (populated by
			// earlier token exchange tests) without hitting mockVerifyAccessToken.
			expect(res.status).toBe(200);
		});

		test("POST /mcp with invalid Bearer token returns 401", async () => {
			const res = await fetch(`${baseUrl}/mcp`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer invalid-token",
				},
				body: JSON.stringify({ jsonrpc: "2.0", method: "initialize", id: 1 }),
			});

			expect(res.status).toBe(401);
			expect(mockVerifyAccessToken).toHaveBeenCalledTimes(1);
		});

		test("GET /mcp without Bearer token returns 401", async () => {
			const res = await fetch(`${baseUrl}/mcp`);
			expect(res.status).toBe(401);
		});

		test("DELETE /mcp without Bearer token returns 401", async () => {
			const res = await fetch(`${baseUrl}/mcp`, { method: "DELETE" });
			expect(res.status).toBe(401);
		});

		test("health endpoint is not protected", async () => {
			const res = await fetch(`${baseUrl}/health`);
			expect(res.status).toBe(200);
			const data = (await res.json()) as { status: string };
			expect(data.status).toBe("ok");
		});
	});

	describe("Full OAuth Flow (mocked)", () => {
		test("complete flow: discovery -> registration -> authorize -> token -> mcp request", async () => {
			// Step 1: Discover protected resource metadata
			const resourceRes = await fetch(
				`${baseUrl}/.well-known/oauth-protected-resource/mcp`,
			);
			expect(resourceRes.status).toBe(200);
			const resourceMeta = (await resourceRes.json()) as ResourceMetadataResponse;
			expect(resourceMeta.authorization_servers).toBeDefined();

			// Step 2: Discover authorization server metadata
			const authServerRes = await fetch(
				`${baseUrl}/.well-known/oauth-authorization-server`,
			);
			expect(authServerRes.status).toBe(200);
			const authMeta = (await authServerRes.json()) as OAuthMetadataResponse;
			expect(authMeta.authorization_endpoint).toBeDefined();
			expect(authMeta.token_endpoint).toBeDefined();
			expect(authMeta.registration_endpoint).toBeDefined();

			// Step 3: Register client (get pre-configured credentials)
			const registerUrl = new URL(authMeta.registration_endpoint!);
			registerUrl.host = new URL(baseUrl).host;
			registerUrl.protocol = "http:";

			const registerRes = await fetch(registerUrl.toString(), {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					redirect_uris: ["http://localhost:6274/oauth/callback"],
					client_name: "Test MCP Client",
				}),
			});
			expect(registerRes.status).toBe(201);
			const clientInfo = (await registerRes.json()) as ClientInfoResponse;
			expect(clientInfo.client_id).toBe(TEST_CLIENT_ID);
			expect(clientInfo.client_secret).toBe(TEST_CLIENT_SECRET);

			// Step 4: Build authorization URL (simulated, would redirect in browser)
			const authorizeUrl = new URL(authMeta.authorization_endpoint);
			authorizeUrl.host = new URL(baseUrl).host;
			authorizeUrl.protocol = "http:";
			authorizeUrl.searchParams.set("client_id", clientInfo.client_id);
			authorizeUrl.searchParams.set("response_type", "code");
			authorizeUrl.searchParams.set(
				"redirect_uri",
				"http://localhost:6274/oauth/callback",
			);
			authorizeUrl.searchParams.set("code_challenge", "test-challenge");
			authorizeUrl.searchParams.set("code_challenge_method", "S256");
			authorizeUrl.searchParams.set("state", "test-state");
			authorizeUrl.searchParams.set("scope", "openid");

			const authorizeRes = await fetch(authorizeUrl.toString(), {
				redirect: "manual",
			});
			expect(authorizeRes.status).toBe(302);
			const redirectLocation = authorizeRes.headers.get("location");
			expect(redirectLocation).toContain("/oauth-authorization-code-flow/code");

			// Step 5: Exchange authorization code for token
			const tokenUrl = new URL(authMeta.token_endpoint);
			tokenUrl.host = new URL(baseUrl).host;
			tokenUrl.protocol = "http:";

			const tokenParams = new URLSearchParams({
				grant_type: "authorization_code",
				code: "simulated-auth-code",
				client_id: clientInfo.client_id,
				client_secret: clientInfo.client_secret,
				redirect_uri: "http://localhost:6274/oauth/callback",
				code_verifier: "test-verifier",
			});

			const tokenRes = await fetch(tokenUrl.toString(), {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: tokenParams.toString(),
			});
			expect(tokenRes.status).toBe(200);
			const tokens = (await tokenRes.json()) as TokenResponse;
			expect(tokens.access_token).toBeDefined();
			expect(tokens.token_type).toBe("Bearer");

			// Step 6: Use access token to make authenticated MCP request
			const mcpRes = await fetch(`${baseUrl}/mcp`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${tokens.access_token}`,
				},
				body: JSON.stringify({
					jsonrpc: "2.0",
					method: "initialize",
					id: 1,
				}),
			});
			expect(mcpRes.status).toBe(200);
		});
	});
});
