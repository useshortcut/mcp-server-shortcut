import { describe, expect, mock, test } from "bun:test";
import type { Request, Response } from "express";
import { getProtectedResourceMetadata, getWellKnownRedirectUrl } from "./server-http";

interface MockRequest extends Partial<Request> {
	headers: Record<string, string | string[] | undefined>;
	body?: unknown;
}

interface MockResponse extends Partial<Response> {
	statusCode?: number;
	headers?: Record<string, string>;
	_data?: unknown;
	headersSent?: boolean;
}

function createMockRequest(overrides: Partial<MockRequest> = {}): MockRequest {
	return {
		headers: {},
		body: {},
		method: "POST",
		...overrides,
	};
}

function createMockResponse(): MockResponse {
	const res: MockResponse = {
		statusCode: 200,
		headers: {},
		_data: undefined,
		headersSent: false,
	};

	res.status = mock((code: number) => {
		res.statusCode = code;
		return res;
	}) as unknown as Response["status"];

	res.json = mock((data: unknown) => {
		res._data = data;
		res.headersSent = true;
		return res as Response;
	}) as unknown as Response["json"];

	res.send = mock((data: unknown) => {
		res._data = data;
		res.headersSent = true;
		return res as Response;
	}) as unknown as Response["send"];

	res.header = mock((name: string, value: string) => {
		if (!res.headers) res.headers = {};
		res.headers[name] = value;
		return res as Response;
	}) as unknown as Response["header"];

	res.sendStatus = mock((code: number) => {
		res.statusCode = code;
		res.headersSent = true;
		return res as Response;
	}) as unknown as Response["sendStatus"];

	return res;
}

describe("server-http (no-auth) smoke tests", () => {
	describe("CORS middleware behavior", () => {
		test("sets expected CORS headers for regular requests", () => {
			const mockReq = createMockRequest({ method: "POST" });
			const res = createMockResponse();
			let nextCalled = false;

			const corsMiddleware = (req: Request, res: Response, next: () => void): void => {
				res.header("Access-Control-Allow-Origin", "*");
				res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
				res.header(
					"Access-Control-Allow-Headers",
					"Content-Type, Authorization, Mcp-Session-Id, Last-Event-Id",
				);
				res.header("Access-Control-Expose-Headers", "Mcp-Session-Id");

				if (req.method === "OPTIONS") {
					res.sendStatus(204);
					return;
				}

				next();
			};

			corsMiddleware(mockReq as Request, res as Response, () => {
				nextCalled = true;
			});

			expect(res.headers).toMatchObject({
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
				"Access-Control-Allow-Headers":
					"Content-Type, Authorization, Mcp-Session-Id, Last-Event-Id",
				"Access-Control-Expose-Headers": "Mcp-Session-Id",
			});
			expect(nextCalled).toBe(true);
		});

		test("returns 204 for OPTIONS preflight", () => {
			const mockReq = createMockRequest({ method: "OPTIONS" });
			const res = createMockResponse();
			let nextCalled = false;

			const corsMiddleware = (req: Request, res: Response, next: () => void): void => {
				res.header("Access-Control-Allow-Origin", "*");
				res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
				res.header(
					"Access-Control-Allow-Headers",
					"Content-Type, Authorization, Mcp-Session-Id, Last-Event-Id",
				);
				res.header("Access-Control-Expose-Headers", "Mcp-Session-Id");

				if (req.method === "OPTIONS") {
					res.sendStatus(204);
					return;
				}

				next();
			};

			corsMiddleware(mockReq as Request, res as Response, () => {
				nextCalled = true;
			});

			expect(res.statusCode).toBe(204);
			expect(nextCalled).toBe(false);
		});
	});

	describe("config helper behavior", () => {
		test("parseToolsList-style behavior trims and drops empty values", () => {
			const parseToolsList = (toolsStr: string): string[] => {
				return toolsStr
					.split(",")
					.map((tool) => tool.trim())
					.filter(Boolean);
			};

			expect(parseToolsList("story,epic,iteration")).toEqual(["story", "epic", "iteration"]);
			expect(parseToolsList(" story , epic , iteration ")).toEqual(["story", "epic", "iteration"]);
			expect(parseToolsList("story,,epic")).toEqual(["story", "epic"]);
			expect(parseToolsList("")).toEqual([]);
		});

		test("parseBoolean-style behavior treats only 'false' as false", () => {
			const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
				if (value === undefined) return defaultValue;
				return value.toLowerCase() !== "false";
			};

			expect(parseBoolean(undefined, true)).toBe(true);
			expect(parseBoolean(undefined, false)).toBe(false);
			expect(parseBoolean("false", true)).toBe(false);
			expect(parseBoolean("FALSE", true)).toBe(false);
			expect(parseBoolean("true", false)).toBe(true);
			expect(parseBoolean("1", false)).toBe(true);
		});

		test("debug level mapping includes dump-all at level 3", () => {
			const parseDebugLevel = (
				value: string,
			): { httpDebug: boolean; httpDebugVerbose: boolean; httpDebugDumpAll: boolean } => {
				const level = Number.parseInt(value, 10);
				if (Number.isNaN(level) || level < 0) {
					return { httpDebug: false, httpDebugVerbose: false, httpDebugDumpAll: false };
				}
				return {
					httpDebug: level >= 1,
					httpDebugVerbose: level >= 2,
					httpDebugDumpAll: level >= 3,
				};
			};

			expect(parseDebugLevel("0")).toEqual({
				httpDebug: false,
				httpDebugVerbose: false,
				httpDebugDumpAll: false,
			});
			expect(parseDebugLevel("1")).toEqual({
				httpDebug: true,
				httpDebugVerbose: false,
				httpDebugDumpAll: false,
			});
			expect(parseDebugLevel("2")).toEqual({
				httpDebug: true,
				httpDebugVerbose: true,
				httpDebugDumpAll: false,
			});
			expect(parseDebugLevel("3")).toEqual({
				httpDebug: true,
				httpDebugVerbose: true,
				httpDebugDumpAll: true,
			});
		});

		test("builds protected-resource metadata from local server config", () => {
			const previousAuthServer = process.env.AUTH_SERVER;
			process.env.AUTH_SERVER = "auth.example.com";

			const config = {
				mcpServerUrl: "http://localhost:9292",
				authServerIssuerUrl: "https://auth.example.com",
			};

			expect(getProtectedResourceMetadata(config)).toEqual({
				resource: "http://localhost:9292/mcp",
				authorization_servers: ["https://auth.example.com"],
				scopes_supported: ["openid"],
			});

			if (previousAuthServer === undefined) {
				delete process.env.AUTH_SERVER;
			} else {
				process.env.AUTH_SERVER = previousAuthServer;
			}
		});

		test("maps the OAuth authorization-server path to the auth server", () => {
			const config = {
				apiBaseUrl: "https://api.example.com",
				authServerIssuerUrl: "https://auth.example.com",
			};

			expect(getWellKnownRedirectUrl("/.well-known/oauth-authorization-server", config)).toBe(
				"https://auth.example.com/.well-known/oauth-authorization-server",
			);
			expect(getWellKnownRedirectUrl("/.well-known/oauth-protected-resource", config)).toBeNull();
			expect(
				getWellKnownRedirectUrl("/.well-known/oauth-protected-resource/mcp", config),
			).toBeNull();
			expect(getWellKnownRedirectUrl("/not-well-known", config)).toBeNull();
		});
	});
});
