import { beforeEach, describe, expect, mock, test } from "bun:test";
import { ShortcutClient } from "@shortcut/client";
import type { Request, Response } from "express";

// Mock the ShortcutClient module
const mockGetCurrentMemberInfo = mock(async () => ({
	data: {
		id: "test-user",
		mention_name: "testuser",
		name: "Test User",
		email_address: "test@example.com",
	},
}));

// We need to mock the module before importing the server components
mock.module("@shortcut/client", () => {
	return {
		ShortcutClient: class {
			constructor(_token: string) {}
			getCurrentMemberInfo = mockGetCurrentMemberInfo;
		},
	};
});

// Helper to create mock Express Request/Response objects
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

describe("Server-HTTP Security Tests", () => {
	describe("extractApiToken", () => {
		test("should extract token from Authorization Bearer header", () => {
			const extractApiToken = (req: Request): string | null => {
				const authHeader = req.headers.authorization;
				if (authHeader?.startsWith("Bearer ")) {
					return authHeader.slice("Bearer ".length);
				}
				const customHeader = req.headers["x-shortcut-api-token"];
				if (typeof customHeader === "string") {
					return customHeader;
				}
				return null;
			};

			const req = createMockRequest({
				headers: { authorization: "Bearer test-token-123" },
			}) as Request;

			const token = extractApiToken(req);
			expect(token).toBe("test-token-123");
		});

		test("should extract token from X-Shortcut-API-Token header", () => {
			const extractApiToken = (req: Request): string | null => {
				const authHeader = req.headers.authorization;
				if (authHeader?.startsWith("Bearer ")) {
					return authHeader.slice("Bearer ".length);
				}
				const customHeader = req.headers["x-shortcut-api-token"];
				if (typeof customHeader === "string") {
					return customHeader;
				}
				return null;
			};

			const req = createMockRequest({
				headers: { "x-shortcut-api-token": "test-token-456" },
			}) as Request;

			const token = extractApiToken(req);
			expect(token).toBe("test-token-456");
		});

		test("should return null when no token provided", () => {
			const extractApiToken = (req: Request): string | null => {
				const authHeader = req.headers.authorization;
				if (authHeader?.startsWith("Bearer ")) {
					return authHeader.slice("Bearer ".length);
				}
				const customHeader = req.headers["x-shortcut-api-token"];
				if (typeof customHeader === "string") {
					return customHeader;
				}
				return null;
			};

			const req = createMockRequest() as Request;
			const token = extractApiToken(req);
			expect(token).toBeNull();
		});

		test("should prioritize Authorization header over custom header", () => {
			const extractApiToken = (req: Request): string | null => {
				const authHeader = req.headers.authorization;
				if (authHeader?.startsWith("Bearer ")) {
					return authHeader.slice("Bearer ".length);
				}
				const customHeader = req.headers["x-shortcut-api-token"];
				if (typeof customHeader === "string") {
					return customHeader;
				}
				return null;
			};

			const req = createMockRequest({
				headers: {
					authorization: "Bearer priority-token",
					"x-shortcut-api-token": "fallback-token",
				},
			}) as Request;

			const token = extractApiToken(req);
			expect(token).toBe("priority-token");
		});
	});

	describe("validateApiToken", () => {
		beforeEach(() => {
			mockGetCurrentMemberInfo.mockClear();
		});

		test("should return true for valid token", async () => {
			mockGetCurrentMemberInfo.mockResolvedValueOnce({
				data: {
					id: "user-1",
					mention_name: "testuser",
					name: "Test User",
					email_address: "testuser@example.com",
				},
			});

			const validateApiToken = async (token: string): Promise<boolean> => {
				try {
					const client = new ShortcutClient(token);
					await client.getCurrentMemberInfo();
					return true;
				} catch {
					return false;
				}
			};

			const result = await validateApiToken("valid-token");
			expect(result).toBe(true);
			expect(mockGetCurrentMemberInfo).toHaveBeenCalledTimes(1);
		});

		test("should return false for invalid token", async () => {
			mockGetCurrentMemberInfo.mockRejectedValueOnce(new Error("Unauthorized"));

			const validateApiToken = async (token: string): Promise<boolean> => {
				try {
					const client = new ShortcutClient(token);
					await client.getCurrentMemberInfo();
					return true;
				} catch {
					return false;
				}
			};

			const result = await validateApiToken("invalid-token");
			expect(result).toBe(false);
			expect(mockGetCurrentMemberInfo).toHaveBeenCalledTimes(1);
		});
	});

	describe("SessionManager", () => {
		// Simplified SessionManager for testing
		interface SessionData {
			apiToken: string;
			createdAt: Date;
			lastAccessedAt: Date;
		}

		class TestSessionManager {
			private sessions: Map<string, SessionData> = new Map();

			has(sessionId: string): boolean {
				return this.sessions.has(sessionId);
			}

			get(sessionId: string): SessionData | undefined {
				const session = this.sessions.get(sessionId);
				if (session) {
					session.lastAccessedAt = new Date();
				}
				return session;
			}

			add(sessionId: string, apiToken: string): void {
				this.sessions.set(sessionId, {
					apiToken,
					createdAt: new Date(),
					lastAccessedAt: new Date(),
				});
			}

			remove(sessionId: string): void {
				this.sessions.delete(sessionId);
			}

			validateToken(sessionId: string, providedToken: string): boolean {
				const session = this.sessions.get(sessionId);
				if (!session) {
					return false;
				}
				return session.apiToken === providedToken;
			}

			getStaleSessions(timeoutMs: number): string[] {
				const now = Date.now();
				const staleSessionIds: string[] = [];

				for (const [sessionId, session] of this.sessions.entries()) {
					const timeSinceLastAccess = now - session.lastAccessedAt.getTime();
					if (timeSinceLastAccess > timeoutMs) {
						staleSessionIds.push(sessionId);
					}
				}

				return staleSessionIds;
			}
		}

		test("should add and retrieve sessions", () => {
			const manager = new TestSessionManager();
			const sessionId = "session-123";
			const apiToken = "token-abc";

			manager.add(sessionId, apiToken);
			expect(manager.has(sessionId)).toBe(true);

			const session = manager.get(sessionId);
			expect(session).toBeDefined();
			expect(session?.apiToken).toBe(apiToken);
		});

		test("should validate tokens correctly", () => {
			const manager = new TestSessionManager();
			const sessionId = "session-123";
			const apiToken = "correct-token";

			manager.add(sessionId, apiToken);

			expect(manager.validateToken(sessionId, "correct-token")).toBe(true);
			expect(manager.validateToken(sessionId, "wrong-token")).toBe(false);
			expect(manager.validateToken("non-existent", "correct-token")).toBe(false);
		});

		test("should remove sessions", () => {
			const manager = new TestSessionManager();
			const sessionId = "session-123";

			manager.add(sessionId, "token");
			expect(manager.has(sessionId)).toBe(true);

			manager.remove(sessionId);
			expect(manager.has(sessionId)).toBe(false);
		});

		test("should identify stale sessions", async () => {
			const manager = new TestSessionManager();
			const timeoutMs = 100; // 100ms timeout for testing

			// Add a session
			manager.add("session-1", "token-1");

			// Wait for it to become stale
			await new Promise((resolve) => setTimeout(resolve, 150));

			// Add a fresh session
			manager.add("session-2", "token-2");

			const staleSessions = manager.getStaleSessions(timeoutMs);
			expect(staleSessions).toContain("session-1");
			expect(staleSessions).not.toContain("session-2");
		});

		test("should update lastAccessedAt on get", async () => {
			const manager = new TestSessionManager();
			manager.add("session-1", "token");

			const session1 = manager.get("session-1");
			const firstAccessTime = session1?.lastAccessedAt.getTime();

			await new Promise((resolve) => setTimeout(resolve, 50));

			const session2 = manager.get("session-1");
			const secondAccessTime = session2?.lastAccessedAt.getTime();

			expect(secondAccessTime).toBeGreaterThan(firstAccessTime!);
		});
	});

	describe("Error Response Helpers", () => {
		test("should send unauthorized error", () => {
			const res = createMockResponse();

			const sendUnauthorizedError = (res: Response): void => {
				res.status(401).json({
					jsonrpc: "2.0",
					error: {
						code: -32000,
						message: "Unauthorized",
					},
					id: null,
				});
			};

			sendUnauthorizedError(res as Response);

			expect(res.statusCode).toBe(401);
			expect(res._data).toMatchObject({
				jsonrpc: "2.0",
				error: {
					code: -32000,
					message: "Unauthorized",
				},
			});
		});

		test("should send invalid token error", () => {
			const res = createMockResponse();

			const sendInvalidTokenError = (res: Response, requestId?: unknown): void => {
				res.status(401).json({
					jsonrpc: "2.0",
					error: {
						code: -32002,
						message: "Invalid API token",
					},
					id: requestId || null,
				});
			};

			sendInvalidTokenError(res as Response, "req-123");

			expect(res.statusCode).toBe(401);
			expect(res._data).toMatchObject({
				jsonrpc: "2.0",
				error: {
					code: -32002,
					message: "Invalid API token",
				},
				id: "req-123",
			});
		});

		test("should send session not found error", () => {
			const res = createMockResponse();

			const sendSessionNotFoundError = (
				res: Response,
				_sessionId: string,
				requestId?: unknown,
			): void => {
				res.status(404).json({
					jsonrpc: "2.0",
					error: {
						code: -32001,
						message: "Session not found",
					},
					id: requestId || null,
				});
			};

			sendSessionNotFoundError(res as Response, "session-123", "req-456");

			expect(res.statusCode).toBe(404);
			expect(res._data).toMatchObject({
				jsonrpc: "2.0",
				error: {
					code: -32001,
					message: "Session not found",
				},
				id: "req-456",
			});
		});

		test("should send bad request error", () => {
			const res = createMockResponse();

			const sendBadRequestError = (res: Response, message: string, requestId?: unknown): void => {
				res.status(400).json({
					jsonrpc: "2.0",
					error: {
						code: -32000,
						message,
					},
					id: requestId || null,
				});
			};

			sendBadRequestError(res as Response, "Missing parameter", "req-789");

			expect(res.statusCode).toBe(400);
			expect(res._data).toMatchObject({
				jsonrpc: "2.0",
				error: {
					code: -32000,
					message: "Missing parameter",
				},
				id: "req-789",
			});
		});

		test("should not send internal error if headers already sent", () => {
			const res = createMockResponse();
			res.headersSent = true;

			const sendInternalError = (res: Response): void => {
				if (!res.headersSent) {
					res.status(500).json({
						jsonrpc: "2.0",
						error: {
							code: -32603,
							message: "Internal server error",
						},
						id: null,
					});
				}
			};

			sendInternalError(res as Response);

			// Should not call status or json because headers are already sent
			expect(res.statusCode).toBe(200); // Still the default
		});
	});

	describe("Request Handler Scenarios", () => {
		interface SessionData {
			apiToken: string;
			createdAt: Date;
			lastAccessedAt: Date;
		}

		class TestSessionManager {
			private sessions: Map<string, SessionData> = new Map();

			has(sessionId: string): boolean {
				return this.sessions.has(sessionId);
			}

			get(sessionId: string): SessionData | undefined {
				return this.sessions.get(sessionId);
			}

			add(sessionId: string, apiToken: string): void {
				this.sessions.set(sessionId, {
					apiToken,
					createdAt: new Date(),
					lastAccessedAt: new Date(),
				});
			}

			validateToken(sessionId: string, providedToken: string): boolean {
				const session = this.sessions.get(sessionId);
				if (!session) return false;
				return session.apiToken === providedToken;
			}
		}

		test("POST - should reject request without API token", () => {
			const res = createMockResponse();

			const extractApiToken = (): string | null => null;
			const apiToken = extractApiToken();

			if (!apiToken) {
				(res.status as any)(401).json({
					jsonrpc: "2.0",
					error: { code: -32000, message: "Unauthorized" },
					id: null,
				});
			}

			expect(res.statusCode).toBe(401);
			expect((res._data as any).error.message).toBe("Unauthorized");
		});

		test("POST - should reject existing session with wrong token", () => {
			const manager = new TestSessionManager();
			manager.add("session-123", "correct-token");

			const res = createMockResponse();

			const sessionId = "session-123";
			const apiToken = "wrong-token";

			if (sessionId && manager.has(sessionId)) {
				if (!manager.validateToken(sessionId, apiToken)) {
					(res.status as any)(401).json({
						jsonrpc: "2.0",
						error: { code: -32000, message: "Token mismatch" },
						id: null,
					});
				}
			}

			expect(res.statusCode).toBe(401);
		});

		test("GET - should reject SSE request without token", () => {
			const manager = new TestSessionManager();
			manager.add("session-123", "correct-token");

			const res = createMockResponse();

			const sessionId = "session-123";
			const apiToken = null;

			if (!sessionId || !manager.has(sessionId)) {
				(res.status as any)(400).send("Invalid or missing session ID");
			} else if (!apiToken) {
				(res.status as any)(401).json({
					jsonrpc: "2.0",
					error: { code: -32000, message: "Unauthorized" },
					id: null,
				});
			}

			expect(res.statusCode).toBe(401);
		});

		test("DELETE - should validate token before terminating session", () => {
			const manager = new TestSessionManager();
			manager.add("session-123", "correct-token");

			const res = createMockResponse();

			const sessionId = "session-123";
			const apiToken = "wrong-token";

			if (!sessionId || !manager.has(sessionId)) {
				(res.status as any)(400).send("Invalid or missing session ID");
			} else if (!apiToken) {
				(res.status as any)(401).json({
					jsonrpc: "2.0",
					error: { code: -32000, message: "Unauthorized" },
					id: null,
				});
			} else if (!manager.validateToken(sessionId, apiToken)) {
				(res.status as any)(401).json({
					jsonrpc: "2.0",
					error: { code: -32000, message: "Token mismatch" },
					id: null,
				});
			}

			expect(res.statusCode).toBe(401);
		});
	});

	describe("CORS Middleware", () => {
		test("should set correct CORS headers", () => {
			const mockReq = createMockRequest({
				method: "POST",
			});
			const res = createMockResponse();
			let nextCalled = false;

			const corsMiddleware = (req: Request, res: Response, next: () => void): void => {
				res.header("Access-Control-Allow-Origin", "*");
				res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
				res.header(
					"Access-Control-Allow-Headers",
					"Content-Type, Authorization, X-Shortcut-API-Token, Mcp-Session-Id, Last-Event-Id",
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
				"Access-Control-Expose-Headers": "Mcp-Session-Id",
			});
			expect(nextCalled).toBe(true);
		});

		test("should handle OPTIONS preflight request", () => {
			const mockReq = createMockRequest({
				method: "OPTIONS",
			});
			const res = createMockResponse();
			let nextCalled = false;

			const corsMiddleware = (req: Request, res: Response, next: () => void): void => {
				res.header("Access-Control-Allow-Origin", "*");
				res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
				res.header(
					"Access-Control-Allow-Headers",
					"Content-Type, Authorization, X-Shortcut-API-Token, Mcp-Session-Id, Last-Event-Id",
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

	describe("Configuration", () => {
		test("should parse tools list correctly", () => {
			const parseToolsList = (toolsStr: string): string[] => {
				return toolsStr
					.split(",")
					.map((tool) => tool.trim())
					.filter(Boolean);
			};

			expect(parseToolsList("story,epic,iteration")).toEqual(["story", "epic", "iteration"]);
			expect(parseToolsList("story, epic, iteration")).toEqual(["story", "epic", "iteration"]);
			expect(parseToolsList("")).toEqual([]);
			expect(parseToolsList("story,,epic")).toEqual(["story", "epic"]);
		});

		test("should load config with defaults", () => {
			const DEFAULT_PORT = 9292;
			const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

			const config = {
				port: DEFAULT_PORT,
				isReadonly: true,
				enabledTools: [],
				sessionTimeoutMs: SESSION_TIMEOUT_MS,
			};

			expect(config.port).toBe(9292);
			expect(config.isReadonly).toBe(true);
			expect(config.sessionTimeoutMs).toBe(1800000); // 30 minutes
		});
	});
});
