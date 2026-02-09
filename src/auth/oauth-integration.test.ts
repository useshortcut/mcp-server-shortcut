import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	getOAuthProtectedResourceMetadataUrl,
	mcpAuthRouter,
} from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import express from "express";
import type { Server } from "node:http";
import { createOAuthProvider } from "./provider";

// ============================================================================
// Integration Test Configuration
//
// These tests hit real staging endpoints. They are SKIPPED unless
// the RUN_INTEGRATION_TESTS env var is set.
//
// Required env vars:
//   RUN_INTEGRATION_TESTS=true
//   SHORTCUT_OAUTH_CLIENT_ID=<your client id>
//   SHORTCUT_OAUTH_CLIENT_SECRET=<your client secret>
//
// Optional env vars:
//   AUTH_SERVER (default: api.app.shortcut-staging.com)
//   TEST_AUTH_CODE - a valid authorization code for token exchange test
// ============================================================================

const SKIP = !process.env.RUN_INTEGRATION_TESTS;
const AUTH_SERVER = process.env.AUTH_SERVER ?? "api.app.shortcut-staging.com";

// ============================================================================
// Local MCP Server for Integration Tests
// ============================================================================

let server: Server;
let baseUrl: string;

function createIntegrationTestApp(): express.Express {
	const app = express();

	// Use real provider (connects to real staging auth server)
	const provider = createOAuthProvider();

	const placeholderUrl = "http://localhost:0";
	const mcpResourceUrl = new URL(`${placeholderUrl}/mcp`);
	const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(mcpResourceUrl);

	const bearerAuth = requireBearerAuth({
		verifier: provider,
		resourceMetadataUrl,
	});

	app.use(express.json());

	app.use(
		mcpAuthRouter({
			provider,
			issuerUrl: new URL(placeholderUrl),
			baseUrl: new URL(placeholderUrl),
			resourceServerUrl: mcpResourceUrl,
			scopesSupported: ["openid"],
		}),
	);

	app.get("/health", (_req, res) => {
		res.json({ status: "ok" });
	});

	app.post("/mcp", bearerAuth, (_req, res) => {
		res.json({ jsonrpc: "2.0", result: { protocolVersion: "2025-06-18" }, id: 1 });
	});

	return app;
}

// ============================================================================
// Type helpers
// ============================================================================

interface ResourceMetadataResponse {
	resource: string;
	authorization_servers: string[];
}

interface OAuthMetadataResponse {
	issuer: string;
	authorization_endpoint: string;
	token_endpoint: string;
	registration_endpoint?: string;
	response_types_supported: string[];
	grant_types_supported: string[];
	token_endpoint_auth_methods_supported: string[];
	code_challenge_methods_supported?: string[];
	scopes_supported?: string[];
}

interface TokenResponse {
	access_token: string;
	token_type: string;
	expires_in?: number;
	refresh_token?: string;
	scope?: string;
}

// ============================================================================
// Tests
// ============================================================================

describe.skipIf(SKIP)("OAuth Integration Tests (staging)", () => {
	beforeAll(async () => {
		process.env.MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL = "true";

		const app = createIntegrationTestApp();
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
		if (server) {
			await new Promise<void>((resolve, reject) => {
				server.close((err) => (err ? reject(err) : resolve()));
			});
		}
	});

	describe("Metadata Discovery (live)", () => {
		test("local MCP server serves protected resource metadata", async () => {
			const res = await fetch(
				`${baseUrl}/.well-known/oauth-protected-resource/mcp`,
			);
			expect(res.status).toBe(200);

			const data = (await res.json()) as ResourceMetadataResponse;
			expect(data.resource).toContain("/mcp");
			expect(data.authorization_servers).toBeDefined();
			expect(Array.isArray(data.authorization_servers)).toBe(true);
		});

		test("local MCP server serves authorization server metadata", async () => {
			const res = await fetch(
				`${baseUrl}/.well-known/oauth-authorization-server`,
			);
			expect(res.status).toBe(200);

			const data = (await res.json()) as OAuthMetadataResponse;
			expect(data.issuer).toBeDefined();
			expect(data.authorization_endpoint).toBeDefined();
			expect(data.token_endpoint).toBeDefined();
			expect(data.response_types_supported).toContain("code");
		});

		test("staging auth server serves OAuth metadata", async () => {
			const res = await fetch(
				`https://${AUTH_SERVER}/.well-known/oauth-authorization-server`,
			);
			expect(res.status).toBe(200);

			const data = (await res.json()) as OAuthMetadataResponse;
			expect(data.issuer).toBeDefined();
			expect(data.authorization_endpoint).toBeDefined();
			expect(data.token_endpoint).toBeDefined();
			expect(data.token_endpoint_auth_methods_supported).toContain("client_secret_post");
			expect(data.grant_types_supported).toContain("authorization_code");
			expect(data.grant_types_supported).toContain("refresh_token");
		});
	});

	describe("Authorization URL Construction (live)", () => {
		test("authorize endpoint redirects to staging auth server", async () => {
			// Register first to establish redirect_uris
			await fetch(`${baseUrl}/register`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					redirect_uris: ["http://localhost:6274/oauth/callback"],
				}),
			});

			const clientId = process.env.SHORTCUT_OAUTH_CLIENT_ID!;
			const params = new URLSearchParams({
				client_id: clientId,
				response_type: "code",
				redirect_uri: "http://localhost:6274/oauth/callback",
				code_challenge: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
				code_challenge_method: "S256",
				state: "integration-test-state",
				scope: "openid",
			});

			const res = await fetch(`${baseUrl}/authorize?${params}`, {
				redirect: "manual",
			});

			expect(res.status).toBe(302);

			const location = res.headers.get("location")!;
			expect(location).toContain(AUTH_SERVER);
			expect(location).toContain("/oauth-authorization-code-flow/code");
			expect(location).toContain(`client_id=${clientId}`);
			expect(location).toContain("code_challenge=");
			expect(location).toContain("code_challenge_method=S256");
			expect(location).toContain("state=integration-test-state");
			expect(location).toContain("scope=openid");

			// Verify the URL is valid
			const authUrl = new URL(location);
			expect(authUrl.protocol).toBe("https:");
			expect(authUrl.hostname).toBe(AUTH_SERVER);
		});
	});

	describe.skipIf(!process.env.TEST_AUTH_CODE)(
		"Token Exchange (live, with auth code)",
		() => {
			test("exchanges authorization code for access token", async () => {
				const clientId = process.env.SHORTCUT_OAUTH_CLIENT_ID!;
				const clientSecret = process.env.SHORTCUT_OAUTH_CLIENT_SECRET!;
				const authCode = process.env.TEST_AUTH_CODE!;

				const params = new URLSearchParams({
					grant_type: "authorization_code",
					code: authCode,
					client_id: clientId,
					client_secret: clientSecret,
					redirect_uri: "http://localhost:6274/oauth/callback",
				});

				const res = await fetch(`${baseUrl}/token`, {
					method: "POST",
					headers: { "Content-Type": "application/x-www-form-urlencoded" },
					body: params.toString(),
				});

				expect(res.status).toBe(200);

				const data = (await res.json()) as TokenResponse;
				expect(data.access_token).toBeDefined();
				expect(data.token_type).toBe("Bearer");
				expect(typeof data.access_token).toBe("string");
				expect(data.access_token.length).toBeGreaterThan(0);
			});
		},
	);
});
