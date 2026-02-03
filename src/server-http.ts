import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { ShortcutClient } from "@shortcut/client";
import express, { type NextFunction, type Request, type Response } from "express";
import pino from "pino";
import { ShortcutClientWrapper } from "@/client/shortcut";
import { CustomMcpServer } from "./mcp/CustomMcpServer";
import { DocumentTools } from "./tools/documents";
import { EpicTools } from "./tools/epics";
import { IterationTools } from "./tools/iterations";
import { ObjectiveTools } from "./tools/objectives";
import { StoryTools } from "./tools/stories";
import { TeamTools } from "./tools/teams";
import { UserTools } from "./tools/user";
import { WorkflowTools } from "./tools/workflows";
import 'dotenv/config';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_PORT = 9292;
const BEARER_PREFIX = "Bearer ";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const AUTH_SERVER = process.env.AUTH_SERVER ?? "api.app.shortcut-staging.com";
const MCP_SERVER_URL = process.env.MCP_SERVER_URL ?? `http://localhost:${process.env.PORT ?? DEFAULT_PORT}`;
const ISSUER = process.env.ISSUER ?? `https://${AUTH_SERVER}/oauth2`;

const OAUTH_PROTECTED_RESOURCE_PATH = "/.well-known/oauth-protected-resource";

const HEADERS = {
	AUTHORIZATION: "authorization",
	MCP_SESSION_ID: "mcp-session-id",
	LAST_EVENT_ID: "last-event-id",
} as const;

const JSON_RPC_ERRORS = {
	UNAUTHORIZED: { code: -32000, message: "Unauthorized" },
	BAD_REQUEST: { code: -32000, message: "Bad Request" },
	SESSION_NOT_FOUND: { code: -32001, message: "Session not found" },
	INTERNAL_ERROR: { code: -32603, message: "Internal server error" },
} as const;

// ============================================================================
// Logger
// ============================================================================

const logger = pino({
	level: process.env.LOG_LEVEL || "info",
	transport:
		process.env.NODE_ENV !== "production"
			? {
					target: "pino-pretty",
					options: {
						colorize: true,
						translateTime: "HH:MM:ss",
						ignore: "pid,hostname",
					},
				}
			: undefined,
});

// ============================================================================
// Configuration
// ============================================================================

interface ServerConfig {
	port: number;
	isReadonly: boolean;
	enabledTools: string[];
	sessionTimeoutMs: number;
	httpDebug: boolean;
}

function loadConfig(): ServerConfig {
	let isReadonly = process.env.SHORTCUT_READONLY !== "false";
	let enabledTools = parseToolsList(process.env.SHORTCUT_TOOLS || "");
	let httpDebug = process.env.SHORTCUT_HTTP_DEBUG === "true";

	// Parse command line arguments
	if (process.argv.length >= 3) {
		process.argv
			.slice(2)
			.map((arg) => arg.split("="))
			.forEach(([name, value]) => {
				if (name === "SHORTCUT_READONLY") isReadonly = value !== "false";
				if (name === "SHORTCUT_TOOLS") enabledTools = parseToolsList(value);
				if (name === "SHORTCUT_HTTP_DEBUG") httpDebug = value === "true";
			});
	}

	return {
		port: Number.parseInt(process.env.PORT || String(DEFAULT_PORT), 10),
		isReadonly,
		enabledTools,
		sessionTimeoutMs: SESSION_TIMEOUT_MS,
		httpDebug,
	};
}

function parseToolsList(toolsStr: string): string[] {
	return toolsStr
		.split(",")
		.map((tool) => tool.trim())
		.filter(Boolean);
}

// ============================================================================
// Session Management
// ============================================================================

interface SessionData {
	transport: StreamableHTTPServerTransport;
	accessToken: string; // Store hashed version in production
	createdAt: Date;
	lastAccessedAt: Date;
}

class SessionManager {
	private sessions: Map<string, SessionData> = new Map();
	private cleanupInterval: ReturnType<typeof setInterval> | null = null;

	constructor(private timeoutMs: number) {
		// Start periodic cleanup of stale sessions
		this.cleanupInterval = setInterval(() => this.cleanupStaleSessions(), 60000); // Check every minute
	}

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

	add(
		sessionId: string,
		transport: StreamableHTTPServerTransport,
		accessToken: string,
	): void {
		this.sessions.set(sessionId, {
			transport,
			accessToken,
			createdAt: new Date(),
			lastAccessedAt: new Date(),
		});
		logger.info({ sessionId }, "Session initialized");
	}

	remove(sessionId: string): void {
		const session = this.sessions.get(sessionId);
		if (session) {
			this.sessions.delete(sessionId);
			logger.info({ sessionId }, "Session removed");
		}
	}

	validateToken(sessionId: string, accessToken: string): boolean {
		const session = this.sessions.get(sessionId);
		if (!session) {
			return false;
		}
		return session.accessToken === accessToken;
	}

	private cleanupStaleSessions(): void {
		const now = Date.now();
		const staleSessionIds: string[] = [];

		for (const [sessionId, session] of this.sessions.entries()) {
			const timeSinceLastAccess = now - session.lastAccessedAt.getTime();
			if (timeSinceLastAccess > this.timeoutMs) {
				staleSessionIds.push(sessionId);
			}
		}

		if (staleSessionIds.length > 0) {
			logger.info({ count: staleSessionIds.length }, "Cleaning up stale sessions");
			for (const sessionId of staleSessionIds) {
				const session = this.sessions.get(sessionId);
				if (session) {
					session.transport.close().catch((error) => {
						logger.error({ sessionId, error }, "Error closing stale transport");
					});
					this.remove(sessionId);
				}
			}
		}
	}

	async closeAll(): Promise<void> {
		logger.info("Shutting down server...");
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
		}

		const closePromises: Promise<void>[] = [];
		for (const [sessionId, session] of this.sessions.entries()) {
			logger.debug({ sessionId }, "Closing session");
			closePromises.push(
				session.transport.close().catch((error) => {
					logger.error({ sessionId, error }, "Error closing transport");
				}),
			);
			this.remove(sessionId);
		}

		await Promise.all(closePromises);
		logger.info("Server shutdown complete");
	}
}

// ============================================================================
// Authentication & Validation
// ============================================================================

function extractAccessToken(req: Request): string | null {
	const authHeader = req.headers[HEADERS.AUTHORIZATION];
	if (authHeader?.startsWith(BEARER_PREFIX)) {
		return authHeader.slice(BEARER_PREFIX.length);
	}
	return null;
}

// ============================================================================
// Error Responses
// ============================================================================

interface JsonRpcError {
	jsonrpc: "2.0";
	error: {
		code: number;
		message: string;
	};
	id: unknown;
}

function getProtectedResourceMetadataUrl(): string {
	return new URL(OAUTH_PROTECTED_RESOURCE_PATH, MCP_SERVER_URL).toString();
}

function setWwwAuthenticateHeader(res: Response): void {
	const headerValue = [
		'Bearer error="unauthorized"',
		'error_description="Authorization needed"',
		`resource_metadata="${getProtectedResourceMetadataUrl()}"`,
	].join(", ");

	res.set("WWW-Authenticate", headerValue);
}

function sendUnauthorizedError(res: Response, message?: string): void {
	setWwwAuthenticateHeader(res);
	res.status(401).json({
		jsonrpc: "2.0",
		error: {
			...JSON_RPC_ERRORS.UNAUTHORIZED,
			message:
				message ||
				"Access token required. Provide via Authorization: Bearer <token>.",
		},
		id: null,
	} satisfies JsonRpcError);
}

function sendSessionNotFoundError(res: Response, sessionId: string, requestId?: unknown): void {
	logger.warn({ sessionId }, "Session not found - may have expired or server restarted");
	res.status(404).json({
		jsonrpc: "2.0",
		error: {
			...JSON_RPC_ERRORS.SESSION_NOT_FOUND,
			message: "Session not found or expired. Please re-initialize the connection.",
		},
		id: requestId || null,
	} satisfies JsonRpcError);
}

function sendBadRequestError(res: Response, message: string, requestId?: unknown): void {
	res.status(400).json({
		jsonrpc: "2.0",
		error: {
			...JSON_RPC_ERRORS.BAD_REQUEST,
			message,
		},
		id: requestId || null,
	} satisfies JsonRpcError);
}

function sendInternalError(res: Response, requestId?: unknown): void {
	if (!res.headersSent) {
		res.status(500).json({
			jsonrpc: "2.0",
			error: JSON_RPC_ERRORS.INTERNAL_ERROR,
			id: requestId || null,
		} satisfies JsonRpcError);
	}
}

// ============================================================================
// MCP Server Creation
// ============================================================================

function createServerInstance(accessToken: string, config: ServerConfig): CustomMcpServer {
	const server = new CustomMcpServer({
		readonly: config.isReadonly,
		tools: config.enabledTools,
	});
	const client = new ShortcutClientWrapper(new ShortcutClient(accessToken));

	// The order these are created impacts the order they are listed to the LLM
	// Most important tools should be at the top
	UserTools.create(client, server);
	StoryTools.create(client, server);
	IterationTools.create(client, server);
	EpicTools.create(client, server);
	ObjectiveTools.create(client, server);
	TeamTools.create(client, server);
	WorkflowTools.create(client, server);
	DocumentTools.create(client, server);

	return server;
}

// ============================================================================
// Transport Management
// ============================================================================

async function createTransport(
	accessToken: string,
	config: ServerConfig,
	sessionManager: SessionManager,
): Promise<StreamableHTTPServerTransport> {
	let transport: StreamableHTTPServerTransport | null = null;

	transport = new StreamableHTTPServerTransport({
		sessionIdGenerator: () => randomUUID(),
		onsessioninitialized: (sid): void => {
			if (transport) {
				sessionManager.add(sid, transport, accessToken);
			}
		},
	});

	// Set up cleanup on close
	transport.onclose = () => {
		if (transport) {
			const sid = transport.sessionId;
			if (sid && sessionManager.has(sid)) {
				sessionManager.remove(sid);
			}
		}
	};

	// Create server instance with the access token and connect
	const server = createServerInstance(accessToken, config);
	await server.connect(transport);

	return transport;
}

// ============================================================================
// Request Handlers
// ============================================================================

async function handleMcpPost(
	req: Request,
	res: Response,
	sessionManager: SessionManager,
	config: ServerConfig,
): Promise<void> {
	const sessionId = req.headers[HEADERS.MCP_SESSION_ID] as string | undefined;
	const accessToken = extractAccessToken(req);
	const requestId = req.body?.id;

	const reqLogger = logger.child({ sessionId: sessionId || "new", method: "POST" });
	reqLogger.debug({ hasAccessToken: !!accessToken }, "Received POST request");

	try {
		// Scenario 1: Existing session
		if (sessionId && sessionManager.has(sessionId)) {
			if (!accessToken) {
				sendUnauthorizedError(res);
				return;
			}

			// Validate that the provided token matches the session's token
			if (!sessionManager.validateToken(sessionId, accessToken)) {
				reqLogger.warn("Token mismatch for session");
				sendUnauthorizedError(res, "Token does not match the session");
				return;
			}

			const session = sessionManager.get(sessionId)!;
			await session.transport.handleRequest(req, res, req.body);
			return;
		}

		// Scenario 2: Initialization request
		if (isInitializeRequest(req.body)) {
			if (!accessToken) {
				sendUnauthorizedError(res);
				return;
			}

			reqLogger.info("Creating session");
			const transport = await createTransport(accessToken, config, sessionManager);
			await transport.handleRequest(req, res, req.body);
			return;
		}

		// Scenario 3: Stale session
		if (sessionId && !sessionManager.has(sessionId)) {
			sendSessionNotFoundError(res, sessionId, requestId);
			return;
		}

		// Scenario 4: Missing session ID
		sendBadRequestError(res, "No session ID provided for non-initialization request", requestId);
	} catch (error) {
		reqLogger.error({ error }, "Error handling MCP POST request");
		sendInternalError(res, requestId);
	}
}

async function handleMcpGet(
	req: Request,
	res: Response,
	sessionManager: SessionManager,
): Promise<void> {
	const sessionId = req.headers[HEADERS.MCP_SESSION_ID] as string | undefined;
	const accessToken = extractAccessToken(req);

	const reqLogger = logger.child({ sessionId, method: "GET" });

	if (!sessionId || !sessionManager.has(sessionId)) {
		res.status(400).send("Invalid or missing session ID");
		return;
	}

	// Validate token for SSE stream establishment
	if (!accessToken) {
		sendUnauthorizedError(res);
		return;
	}

	if (!sessionManager.validateToken(sessionId, accessToken)) {
		reqLogger.warn("Token mismatch for GET request");
		sendUnauthorizedError(res, "Token does not match the session");
		return;
	}

	const lastEventId = req.headers[HEADERS.LAST_EVENT_ID];
	if (lastEventId) {
		reqLogger.info({ lastEventId }, "Client reconnecting with Last-Event-ID");
	} else {
		reqLogger.info("Establishing SSE stream");
	}

	try {
		const session = sessionManager.get(sessionId)!;
		await session.transport.handleRequest(req, res);
	} catch (error) {
		reqLogger.error({ error }, "Error handling MCP GET request");
		if (!res.headersSent) {
			res.status(500).send("Internal server error");
		}
	}
}

async function handleMcpDelete(
	req: Request,
	res: Response,
	sessionManager: SessionManager,
): Promise<void> {
	const sessionId = req.headers[HEADERS.MCP_SESSION_ID] as string | undefined;
	const accessToken = extractAccessToken(req);

	const reqLogger = logger.child({ sessionId, method: "DELETE" });

	if (!sessionId || !sessionManager.has(sessionId)) {
		res.status(400).send("Invalid or missing session ID");
		return;
	}

	// Validate token for session termination
	if (!accessToken) {
		sendUnauthorizedError(res);
		return;
	}

	if (!sessionManager.validateToken(sessionId, accessToken)) {
		reqLogger.warn("Token mismatch for DELETE request");
		sendUnauthorizedError(res, "Token does not match the session");
		return;
	}

	reqLogger.info("Terminating session");

	try {
		const session = sessionManager.get(sessionId)!;
		await session.transport.handleRequest(req, res);
		// The session will be removed via the onclose handler
	} catch (error) {
		reqLogger.error({ error }, "Error handling session termination");
		if (!res.headersSent) {
			res.status(500).send("Error processing session termination");
		}
	}
}

// ============================================================================
// Middleware
// ============================================================================

function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
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
}

/**
 * Request logging middleware for debugging and audit purposes
 */
function loggingMiddleware(req: Request, _res: Response, next: NextFunction): void {
	const sessionId = req.headers[HEADERS.MCP_SESSION_ID];
	const hasAccessToken = !!extractAccessToken(req);

	logger.debug(
		{
			method: req.method,
			path: req.path,
			sessionId: sessionId || "none",
			hasAccessToken,
		},
		"Incoming request",
	);

	next();
}

function httpDebugRequestMiddleware(req: Request, _res: Response, next: NextFunction): void {
	const headers = { ...req.headers };
	delete headers[HEADERS.AUTHORIZATION];
	delete headers.cookie;

	logger.info(
		JSON.stringify({
			event: "http_request",
			method: req.method,
			path: req.path,
			url: req.originalUrl,
			query: req.query,
			headers,
			body: req.body,
		}),
	);

	next();
}

// ============================================================================
// Server Setup
// ============================================================================

async function startServer() {
	const config = loadConfig();
	const sessionManager = new SessionManager(config.sessionTimeoutMs);
	const app = express();

	// Middleware
	app.use(express.json());
	if (config.httpDebug) app.use(httpDebugRequestMiddleware);
	app.use(corsMiddleware);
	app.use(loggingMiddleware);

	app.use((req, res, next) => {
		const start = Date.now();
		res.on("finish", () => {
			if (res.statusCode >= 400) {
				logger.info(
					JSON.stringify({
						event: "http_request_failed",
						method: req.method,
						path: req.path,
						status: res.statusCode,
						ms: Date.now() - start,
					}),
				);
			}
		});
		next();
	});

	// Routes
	app.get("/health", (_req: Request, res: Response) => {
		res.json({
			status: "ok",
			service: "shortcut-mcp-server",
			transport: "streamable-http",
			timestamp: new Date().toISOString(),
			version: "2025-06-18", // MCP spec version
		});
	});

	app.get("/.well-known/oauth-protected-resource", (_req: Request, res: Response) => {
		res.json({
			resource: `${MCP_SERVER_URL}/mcp`,
			authorization_servers: [`https://${AUTH_SERVER}`],
			bearer_methods_supported: ["header"],
		});
	});

	app.post("/mcp", (req, res) => handleMcpPost(req, res, sessionManager, config));
	app.get("/mcp", (req, res) => handleMcpGet(req, res, sessionManager));
	app.delete("/mcp", (req, res) => handleMcpDelete(req, res, sessionManager));

	// Start server
	app.listen(config.port, () => {
		logger.info(
			{
				port: config.port,
				readonly: config.isReadonly,
				sessionTTL: `${config.sessionTimeoutMs / 1000 / 60}m`,
				enabledTools: config.enabledTools.length > 0 ? config.enabledTools : "all",
				mcpSpec: "2025-06-18",
			},
			"Shortcut MCP Server (Streamable HTTP) started",
		);
		logger.info(`Server URL: http://localhost:${config.port}`);
		logger.info(`Health check: http://localhost:${config.port}/health`);
		logger.info(`MCP endpoint: http://localhost:${config.port}/mcp`);
	});

	// Graceful shutdown
	process.on("SIGINT", async () => {
		await sessionManager.closeAll();
		process.exit(0);
	});

	process.on("SIGTERM", async () => {
		await sessionManager.closeAll();
		process.exit(0);
	});
}

// ============================================================================
// Entry Point
// ============================================================================

startServer().catch((error) => {
	logger.fatal({ error }, "Fatal error starting server");
	process.exit(1);
});
