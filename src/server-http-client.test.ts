import { describe, expect, mock, test } from "bun:test";

type HeadersMap = Record<string, unknown>;

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
}

mock.module("@shortcut/client", () => ({ ShortcutClient: MockShortcutClient }));

const { createShortcutClientForAuth } = await import("./server-http");

function getHeader(headers: HeadersMap, name: string): unknown {
	const common =
		typeof headers.common === "object" && headers.common ? (headers.common as HeadersMap) : {};

	return headers[name] ?? headers[name.toLowerCase()] ?? common[name] ?? common[name.toLowerCase()];
}

describe("server-http auth-aware Shortcut client factory", () => {
	test("creates OAuth clients that send Authorization bearer headers", () => {
		const client = createShortcutClientForAuth("oauth-token", "oauth", "https://api.example.com");
		const headers = (client as unknown as MockShortcutClient).instance.defaults.headers;

		expect(getHeader(headers, "Authorization")).toBe("Bearer oauth-token");
		expect(getHeader(headers, "Shortcut-Token")).toBeUndefined();
	});

	test("creates legacy clients that keep Shortcut-Token auth", () => {
		const client = createShortcutClientForAuth(
			"legacy-token",
			"legacy-api-token",
			"https://api.example.com",
		);
		const headers = (client as unknown as MockShortcutClient).instance.defaults.headers;

		expect(getHeader(headers, "Shortcut-Token")).toBe("legacy-token");
		expect(getHeader(headers, "Authorization")).toBeUndefined();
	});
});
