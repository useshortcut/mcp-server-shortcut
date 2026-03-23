import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
	InvalidGrantError,
	InvalidTokenError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";

type HeadersMap = Record<string, unknown>;

const mockState: {
	handler: (headers: HeadersMap) => Promise<{ data: { id: string; mention_name: string } }>;
	calls: HeadersMap[];
} = {
	handler: async () => {
		throw new Error("Unauthorized");
	},
	calls: [],
};

class MockShortcutClient {
	instance: { defaults: { headers: HeadersMap } };

	constructor(token: string, config?: { headers?: Record<string, string> }) {
		const configuredHeaders = config?.headers ?? {};
		this.instance = {
			defaults: {
				headers: {
					...configuredHeaders,
					"Shortcut-Token": token,
					common: {
						...configuredHeaders,
						"Shortcut-Token": token,
					},
				},
			},
		};
	}

	async getCurrentMemberInfo(): Promise<{ data: { id: string; mention_name: string } }> {
		const headers = this.instance.defaults.headers;
		const common =
			typeof headers.common === "object" && headers.common ? (headers.common as HeadersMap) : {};

		mockState.calls.push({
			...headers,
			common: { ...common },
		});

		return mockState.handler(headers);
	}
}

mock.module("@shortcut/client", () => ({ ShortcutClient: MockShortcutClient }));

const { createOAuthProvider } = await import("./provider");

function getHeader(headers: HeadersMap, name: string): unknown {
	const common =
		typeof headers.common === "object" && headers.common ? (headers.common as HeadersMap) : {};

	return headers[name] ?? headers[name.toLowerCase()] ?? common[name] ?? common[name.toLowerCase()];
}

describe("createOAuthProvider default verifier", () => {
	beforeEach(() => {
		process.env.SHORTCUT_OAUTH_CLIENT_ID = "test-client-id";
		process.env.SHORTCUT_OAUTH_CLIENT_SECRET = "test-client-secret";
		process.env.AUTH_SERVER = "api.app.shortcut-staging.com";
		mockState.calls = [];
	});

	test("verifies uncached OAuth token via Authorization bearer header", async () => {
		mockState.handler = async (headers) => {
			if (getHeader(headers, "Authorization") === "Bearer oauth-token") {
				return {
					data: {
						id: "member-1",
						mention_name: "oauth-user",
					},
				};
			}
			throw new Error("Unauthorized");
		};

		const provider = createOAuthProvider();
		const authInfo = await provider.verifyAccessToken("oauth-token");

		expect(authInfo.token).toBe("oauth-token");
		expect(authInfo.clientId).toBe("test-client-id");
		expect(authInfo.extra).toEqual({
			memberId: "member-1",
			mentionName: "oauth-user",
			authType: "oauth",
		});
		expect(mockState.calls.length).toBe(1);
		expect(getHeader(mockState.calls[0], "Shortcut-Token")).toBeUndefined();
	});

	test("falls back to legacy Shortcut-Token verification when bearer auth fails", async () => {
		mockState.handler = async (headers) => {
			if (getHeader(headers, "Authorization") === "Bearer legacy-token") {
				throw new Error("Bearer rejected");
			}
			if (getHeader(headers, "Shortcut-Token") === "legacy-token") {
				return {
					data: {
						id: "member-2",
						mention_name: "legacy-user",
					},
				};
			}
			throw new Error("Unauthorized");
		};

		const provider = createOAuthProvider();
		const authInfo = await provider.verifyAccessToken("legacy-token");

		expect(authInfo.token).toBe("legacy-token");
		expect(authInfo.extra).toEqual({
			memberId: "member-2",
			mentionName: "legacy-user",
			authType: "legacy-api-token",
		});
		expect(mockState.calls.length).toBe(2);
	});

	test("throws InvalidTokenError when both bearer and legacy verification fail", async () => {
		mockState.handler = async () => {
			throw new Error("Unauthorized");
		};

		const provider = createOAuthProvider();
		await expect(provider.verifyAccessToken("invalid-token")).rejects.toBeInstanceOf(
			InvalidTokenError,
		);
		expect(mockState.calls.length).toBe(2);
	});
});

describe("createOAuthProvider token exchange behavior", () => {
	beforeEach(() => {
		process.env.SHORTCUT_OAUTH_CLIENT_ID = "test-client-id";
		process.env.SHORTCUT_OAUTH_CLIENT_SECRET = "test-client-secret";
		process.env.AUTH_SERVER = "api.app.shortcut-staging.com";
	});

	test("maps upstream invalid_grant refresh errors to InvalidGrantError", async () => {
		const fetchMock = mock(async () => {
			return new Response(
				JSON.stringify({
					error: "invalid_grant",
					error_description: "Refresh token expired",
				}),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			);
		});

		const provider = createOAuthProvider({
			fetch: fetchMock as unknown as FetchLike,
			endpoints: {
				authorizationUrl: "https://example.com/oauth/code",
				tokenUrl: "https://example.com/oauth/token",
			},
		});

		await expect(
			provider.exchangeRefreshToken(
				{
					client_id: "test-client-id",
					redirect_uris: [],
				} as never,
				"expired-refresh-token",
			),
		).rejects.toBeInstanceOf(InvalidGrantError);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	test("normalizes refresh token responses without expires_in", async () => {
		const fetchMock = mock(async () => {
			return new Response(
				JSON.stringify({
					access_token: "new-access-token",
					refresh_token: "new-refresh-token",
					scope: "openid",
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		});

		const provider = createOAuthProvider({
			fetch: fetchMock as unknown as FetchLike,
			endpoints: {
				authorizationUrl: "https://example.com/oauth/code",
				tokenUrl: "https://example.com/oauth/token",
			},
		});

		const tokens = await provider.exchangeRefreshToken(
			{
				client_id: "test-client-id",
				redirect_uris: [],
			} as never,
			"valid-refresh-token",
		);

		expect(tokens.token_type).toBe("Bearer");
		expect(tokens.expires_in).toBe(3600);
		expect(tokens.access_token).toBe("new-access-token");

		const authInfo = await provider.verifyAccessToken("new-access-token");
		expect(authInfo.extra.authType).toBe("oauth");
		expect(authInfo.extra.memberId).toBeUndefined();
	});

	test("accepts a previously issued refresh token after server-side rotation", async () => {
		let oldRefreshTokenCalls = 0;
		const fetchMock = mock(async (_url: string | URL, init?: RequestInit) => {
			const body = typeof init?.body === "string" ? init.body : "";
			const params = new URLSearchParams(body);
			const refreshToken = params.get("refresh_token");

			if (refreshToken === "old-refresh-token") {
				oldRefreshTokenCalls += 1;
				if (oldRefreshTokenCalls === 1) {
					return new Response(
						JSON.stringify({
							access_token: "access-token-2",
							refresh_token: "new-refresh-token",
							scope: "openid",
						}),
						{
							status: 200,
							headers: { "Content-Type": "application/json" },
						},
					);
				}
				return new Response(
					JSON.stringify({
						error: "invalid_grant",
						error_description: "Refresh token already used",
					}),
					{
						status: 400,
						headers: { "Content-Type": "application/json" },
					},
				);
			}

			if (refreshToken === "new-refresh-token") {
				return new Response(
					JSON.stringify({
						access_token: "access-token-3",
						refresh_token: "newer-refresh-token",
						scope: "openid",
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			}

			return new Response(JSON.stringify({ error: "invalid_grant" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		});

		const provider = createOAuthProvider({
			fetch: fetchMock as unknown as FetchLike,
			endpoints: {
				authorizationUrl: "https://example.com/oauth/code",
				tokenUrl: "https://example.com/oauth/token",
			},
		});

		const firstTokens = await provider.exchangeRefreshToken(
			{
				client_id: "test-client-id",
				redirect_uris: [],
			} as never,
			"old-refresh-token",
		);
		expect(firstTokens.refresh_token).toBe("new-refresh-token");

		const secondTokens = await provider.exchangeRefreshToken(
			{
				client_id: "test-client-id",
				redirect_uris: [],
			} as never,
			"old-refresh-token",
		);

		expect(secondTokens.access_token).toBe("access-token-3");
		expect(secondTokens.refresh_token).toBe("newer-refresh-token");
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});

type FetchLike = (url: string | URL, init?: RequestInit) => Promise<Response>;
