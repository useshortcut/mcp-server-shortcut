import { beforeEach, describe, expect, mock, test } from "bun:test";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";

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
