import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
	getOAuthProtectedResourceMetadataUrl,
	mcpAuthRouter,
} from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { ShortcutClient } from "@shortcut/client";
import express, { type NextFunction, type Request, type Response } from "express";
import pino from "pino";
import { createOAuthProvider } from "@/auth/provider";
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
import "dotenv/config";

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_PORT = 9292;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const MCP_SERVER_URL =
	process.env.MCP_SERVER_URL ?? `http://localhost:${process.env.PORT ?? DEFAULT_PORT}`;

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

const VERBOSE_KEYS = ["body", "headers", "query"] as const;

/** Set from config in startServer(); controls whether logEvent includes full body/headers/query. */
let httpDebugVerbose = false;
/** Set from config in startServer(); controls whether proxy request logs are emitted. */
let httpDebugEnabled = false;

/** Log structured event for HTTP debug; use this instead of logger.info(JSON.stringify(...)) */
function logEvent(event: string, data: Record<string, unknown>): void {
	const payload =
		httpDebugVerbose
			? data
			: Object.fromEntries(
					Object.entries(data).map(([k, v]) =>
						VERBOSE_KEYS.includes(k as (typeof VERBOSE_KEYS)[number]) ? [k, "[REDACTED]"] : [k, v],
					),
				);
	logger.info({ event, ...payload });
}

// ============================================================================
// Configuration
// ============================================================================

interface ServerConfig {
	port: number;
	isReadonly: boolean;
	enabledTools: string[];
	sessionTimeoutMs: number;
	httpDebug: boolean;
	/** When true, logEvent includes full body/headers/query; when false, those keys are redacted. */
	httpDebugVerbose: boolean;
}

/** DEBUG_LEVEL: 0 = none, 1 = HTTP debug (redacted), 2 = full verbose */
function parseDebugLevel(value: string): { httpDebug: boolean; httpDebugVerbose: boolean } {
	const level = Number.parseInt(value, 10);
	if (Number.isNaN(level) || level < 0) {
		return { httpDebug: false, httpDebugVerbose: false };
	}
	return {
		httpDebug: level >= 1,
		httpDebugVerbose: level >= 2,
	};
}

function loadConfig(): ServerConfig {
	let isReadonly = process.env.SHORTCUT_READONLY !== "false";
	let enabledTools = parseToolsList(process.env.SHORTCUT_TOOLS || "");
	let { httpDebug, httpDebugVerbose } = parseDebugLevel(process.env.DEBUG_LEVEL ?? "0");

	// Parse command line arguments
	if (process.argv.length >= 3) {
		process.argv
			.slice(2)
			.map((arg) => arg.split("="))
			.forEach(([name, value]) => {
				if (name === "SHORTCUT_READONLY") isReadonly = value !== "false";
				if (name === "SHORTCUT_TOOLS") enabledTools = parseToolsList(value);
				if (name === "DEBUG_LEVEL") {
					const parsed = parseDebugLevel(value);
					httpDebug = parsed.httpDebug;
					httpDebugVerbose = parsed.httpDebugVerbose;
				}
			});
	}

	return {
		port: Number.parseInt(process.env.PORT || String(DEFAULT_PORT), 10),
		isReadonly,
		enabledTools,
		sessionTimeoutMs: SESSION_TIMEOUT_MS,
		httpDebug,
		httpDebugVerbose,
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
	/**
	 * Session-bound bearer token used to authorize reuse of this session.
	 * This is kept stable to preserve ownership binding even if middleware
	 * refreshes tokens behind the scenes.
	 */
	sessionToken: string;
	/** Current token used by the Shortcut client for upstream API calls. */
	accessToken: string;
	/** Bounded set of tokens that are valid for this session chain. */
	boundTokens: Set<string>;
	clientWrapper: ShortcutClientWrapper;
	createdAt: Date;
	lastAccessedAt: Date;
}

const MAX_BOUND_TOKENS_PER_SESSION = 8;

function bindSessionToken(session: SessionData, token: string): void {
	if (!token) {
		return;
	}
	// Refresh insertion order if already present.
	if (session.boundTokens.has(token)) {
		session.boundTokens.delete(token);
	}
	session.boundTokens.add(token);
	// Keep memory bounded; drop oldest seen token(s) first.
	while (session.boundTokens.size > MAX_BOUND_TOKENS_PER_SESSION) {
		const oldestToken = session.boundTokens.values().next().value as string | undefined;
		if (!oldestToken) {
			break;
		}
		session.boundTokens.delete(oldestToken);
	}
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
		clientWrapper: ShortcutClientWrapper,
	): void {
		this.sessions.set(sessionId, {
			transport,
			sessionToken: accessToken,
			accessToken,
			boundTokens: new Set([accessToken]),
			clientWrapper,
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

function sendUnauthorizedError(res: Response, requestId?: unknown): void {
	res.status(401).json({
		jsonrpc: "2.0",
		error: JSON_RPC_ERRORS.UNAUTHORIZED,
		id: requestId || null,
	} satisfies JsonRpcError);
}

function extractBearerToken(req: Request): string | undefined {
	const authHeader = req.headers[HEADERS.AUTHORIZATION];
	if (typeof authHeader !== "string") {
		return undefined;
	}
	const [type, token] = authHeader.split(" ");
	if (type?.toLowerCase() !== "bearer" || !token) {
		return undefined;
	}
	return token;
}

function isAuthorizedForSession(
	req: Request,
	session: SessionData,
	warn: (message: string) => void,
): boolean {
	const presentedBearerToken = extractBearerToken(req);
	if (!presentedBearerToken) {
		warn("Missing bearer token for session-bound request");
		return false;
	}

	// Accept the original bound token and the current active client token.
	// This allows clients that lag behind token refreshes to keep using a
	// recently-bound token, while still requiring session-specific ownership.
	const tokenMatchesSession = session.boundTokens.has(presentedBearerToken);
	if (!tokenMatchesSession) {
		warn("Bearer token does not match session binding");
		return false;
	}

	return true;
}

// ============================================================================
// MCP Server Creation
// ============================================================================

const API_BASE_URL = `https://${process.env.AUTH_SERVER ?? "api.app.shortcut.com"}`;

function attachShortcutProxyLogging(client: ShortcutClient): void {
	if (!httpDebugEnabled) {
		return;
	}

	// biome-ignore lint/suspicious/noExplicitAny: accessing axios internals
	const instance = (client as any).instance;
	if (!instance?.interceptors?.request || !instance?.interceptors?.response) {
		return;
	}

	instance.interceptors.request.use((config: any) => {
		config.__proxyStartMs = Date.now();
		logEvent("shortcut_api_proxy_request", {
			method: (config.method ?? "get").toString().toUpperCase(),
			baseURL: config.baseURL,
			url: config.url,
		});
		return config;
	});

	instance.interceptors.response.use(
		(response: any) => {
			const startMs =
				typeof response?.config?.__proxyStartMs === "number"
					? response.config.__proxyStartMs
					: undefined;
			logEvent("shortcut_api_proxy_response", {
				method: (response?.config?.method ?? "get").toString().toUpperCase(),
				baseURL: response?.config?.baseURL,
				url: response?.config?.url,
				status: response?.status,
				ms: typeof startMs === "number" ? Date.now() - startMs : undefined,
			});
			return response;
		},
		(error: any) => {
			const config = error?.config;
			const startMs =
				typeof config?.__proxyStartMs === "number" ? config.__proxyStartMs : undefined;
			logEvent("shortcut_api_proxy_response_error", {
				method: (config?.method ?? "get").toString().toUpperCase(),
				baseURL: config?.baseURL,
				url: config?.url,
				status: error?.response?.status ?? "network_error",
				ms: typeof startMs === "number" ? Date.now() - startMs : undefined,
			});
			return Promise.reject(error);
		},
	);
}

/**
 * Creates a ShortcutClient configured for OAuth Bearer tokens.
 * - Sends Authorization: Bearer instead of Shortcut-Token
 * - Uses the correct base URL (staging vs production) based on AUTH_SERVER
 */
function createOAuthShortcutClient(accessToken: string): ShortcutClient {
	const client = new ShortcutClient("_placeholder_", {
		baseURL: API_BASE_URL,
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	});
	// Remove the Shortcut-Token header set by the constructor --
	// the Shortcut API rejects requests with an invalid Shortcut-Token
	// even when a valid Authorization: Bearer header is present.
	// biome-ignore lint/suspicious/noExplicitAny: accessing axios internals
	const instance = (client as any).instance;
	if (instance?.defaults?.headers) {
		delete instance.defaults.headers["Shortcut-Token"];
		if (instance.defaults.headers.common) {
			delete instance.defaults.headers.common["Shortcut-Token"];
		}
	}
	attachShortcutProxyLogging(client);
	return client;
}

function createServerInstance(
	accessToken: string,
	config: ServerConfig,
): { server: CustomMcpServer; clientWrapper: ShortcutClientWrapper } {
	const server = new CustomMcpServer({
		readonly: config.isReadonly,
		tools: config.enabledTools,
	});
	const clientWrapper = new ShortcutClientWrapper(createOAuthShortcutClient(accessToken));

	// The order these are created impacts the order they are listed to the LLM
	// Most important tools should be at the top
	UserTools.create(clientWrapper, server);
	StoryTools.create(clientWrapper, server);
	IterationTools.create(clientWrapper, server);
	EpicTools.create(clientWrapper, server);
	ObjectiveTools.create(clientWrapper, server);
	TeamTools.create(clientWrapper, server);
	WorkflowTools.create(clientWrapper, server);
	DocumentTools.create(clientWrapper, server);

	return { server, clientWrapper };
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
	const { server, clientWrapper } = createServerInstance(accessToken, config);

	transport = new StreamableHTTPServerTransport({
		sessionIdGenerator: () => randomUUID(),
		onsessioninitialized: (sid): void => {
			if (transport) {
				sessionManager.add(sid, transport, accessToken, clientWrapper);
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
	const accessToken = req.auth?.token;
	const requestId = req.body?.id;

	const reqLogger = logger.child({ sessionId: sessionId || "new", method: "POST" });
	reqLogger.debug({ hasAccessToken: !!accessToken }, "Received POST request");

	try {
		// Scenario 1: Existing session
		if (sessionId && sessionManager.has(sessionId)) {
			if (!accessToken) {
				reqLogger.warn("Missing access token for session");
				sendUnauthorizedError(res, requestId);
				return;
			}

			const session = sessionManager.get(sessionId);
			if (!session) {
				sendSessionNotFoundError(res, sessionId, requestId);
				return;
			}
			if (!isAuthorizedForSession(req, session, (message) => reqLogger.warn(message))) {
				sendUnauthorizedError(res, requestId);
				return;
			}

			// If the token was refreshed by the auth middleware, update the
			// session's ShortcutClient so tools use the fresh token.
			if (accessToken !== session.accessToken) {
				reqLogger.info("Token refreshed, updating session client");
				session.accessToken = accessToken;
				bindSessionToken(session, accessToken);
				session.clientWrapper.updateClient(createOAuthShortcutClient(accessToken));
			}

			await session.transport.handleRequest(req, res, req.body);
			return;
		}

		// Scenario 2: Initialization request
		if (isInitializeRequest(req.body)) {
			if (!accessToken) {
				sendUnauthorizedError(res, requestId);
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
		sendBadRequestError(
			res,
			"No session ID provided for non-initialization request",
			requestId,
		);
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
	const accessToken = req.auth?.token;

	const reqLogger = logger.child({ sessionId, method: "GET" });

	if (!sessionId || !sessionManager.has(sessionId)) {
		res.status(400).send("Invalid or missing session ID");
		return;
	}

	// Token is already verified by requireBearerAuth middleware
	// (which also auto-refreshes expired tokens).
	if (!accessToken) {
		reqLogger.warn("Missing access token for GET request");
		sendUnauthorizedError(res);
		return;
	}

	const lastEventId = req.headers[HEADERS.LAST_EVENT_ID];
	if (lastEventId) {
		reqLogger.info({ lastEventId }, "Client reconnecting with Last-Event-ID");
	} else {
		reqLogger.info("Establishing SSE stream");
	}

	try {
		const session = sessionManager.get(sessionId);
		if (!session) {
			res.status(400).send("Invalid or missing session ID");
			return;
		}
		if (!isAuthorizedForSession(req, session, (message) => reqLogger.warn(message))) {
			sendUnauthorizedError(res);
			return;
		}
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
	const accessToken = req.auth?.token;

	const reqLogger = logger.child({ sessionId, method: "DELETE" });

	if (!sessionId || !sessionManager.has(sessionId)) {
		res.status(400).send("Invalid or missing session ID");
		return;
	}

	// Token is already verified by requireBearerAuth middleware
	// (which also auto-refreshes expired tokens).
	if (!accessToken) {
		reqLogger.warn("Missing access token for DELETE request");
		sendUnauthorizedError(res);
		return;
	}

	reqLogger.info("Terminating session");

	try {
		const session = sessionManager.get(sessionId);
		if (!session) {
			res.status(400).send("Invalid or missing session ID");
			return;
		}
		if (!isAuthorizedForSession(req, session, (message) => reqLogger.warn(message))) {
			sendUnauthorizedError(res);
			return;
		}
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
	const hasAccessToken = !!req.headers[HEADERS.AUTHORIZATION];

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

	logEvent("http_request", { method: req.method, path: req.path, url: req.originalUrl, query: req.query, headers, body: req.body });

	next();
}

function httpDebugResponseMiddleware(req: Request, res: Response, next: NextFunction): void {
	const originalJson = res.json.bind(res);
	res.json = (body: unknown) => {
		logEvent("http_response", { method: req.method, path: req.path, status: res.statusCode, body });
		return originalJson(body);
	  };
	next();
}

// ============================================================================
// Server Setup
// ============================================================================

async function startServer() {
	const config = loadConfig();
	httpDebugEnabled = config.httpDebug;
	httpDebugVerbose = config.httpDebugVerbose;
	const sessionManager = new SessionManager(config.sessionTimeoutMs);
	const app = express();

	// OAuth provider and resource metadata URL
	const oauthProvider = createOAuthProvider({ mcpServerUrl: MCP_SERVER_URL });
	const mcpResourceUrl = new URL(`${MCP_SERVER_URL}/mcp`);
	const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(mcpResourceUrl);

	// Bearer auth middleware for protecting /mcp routes
	const bearerAuth = requireBearerAuth({
		verifier: oauthProvider,
		resourceMetadataUrl,
	});

	// Middleware
	app.use(express.json());
	if (config.httpDebug) app.use(httpDebugRequestMiddleware);
	if (config.httpDebug) app.use(httpDebugResponseMiddleware);
	app.use(corsMiddleware);
	app.use(loggingMiddleware);
	app.set('trust proxy', 1); // Required when behind ALB/Load Balancer

	app.use((req, res, next) => {
		const start = Date.now();
		res.on("finish", () => {
			const ms = Date.now() - start;
			if (res.statusCode >= 400) {
				const headers = { ...req.headers };
				logEvent("http_request_failed", { method: req.method, path: req.path, url: req.originalUrl, query: req.query, headers, body: req.body, ms: ms });
			}
		});
		next();
	});

	// OAuth auth router: installs /.well-known/oauth-protected-resource/mcp,
	// /.well-known/oauth-authorization-server, /authorize, /token, /register
	app.use(
		mcpAuthRouter({
			provider: oauthProvider,
			issuerUrl: new URL(MCP_SERVER_URL),
			baseUrl: new URL(MCP_SERVER_URL),
			resourceServerUrl: mcpResourceUrl,
			scopesSupported: ["openid"],
		}),
	);

	// OAuth callback: relays the authorization code from the upstream auth server
	// back to the original MCP client's redirect_uri.
	app.get(oauthProvider.callbackPath, (req: Request, res: Response) => {
		const { code, state, error, error_description } = req.query as Record<string, string>;

		if (!state) {
			res.status(400).send("Missing state parameter");
			return;
		}

		const originalRedirectUri = oauthProvider.pendingAuthorizations.get(state);
		if (!originalRedirectUri) {
			res.status(400).send("Unknown or expired authorization state");
			return;
		}

		// Clean up the pending authorization
		oauthProvider.pendingAuthorizations.delete(state);

		// Build the redirect back to the original client
		const redirectUrl = new URL(originalRedirectUri);
		if (code) redirectUrl.searchParams.set("code", code);
		if (state) redirectUrl.searchParams.set("state", state);
		if (error) redirectUrl.searchParams.set("error", error);
		if (error_description) {
			redirectUrl.searchParams.set("error_description", error_description);
		}

		logger.info({ state, hasCode: !!code, hasError: !!error }, "OAuth callback relay");
		res.redirect(redirectUrl.toString());
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

	// MCP routes protected by bearer auth
	app.post("/mcp", bearerAuth, (req, res) =>
		handleMcpPost(req, res, sessionManager, config),
	);
	app.get("/mcp", bearerAuth, (req, res) =>
		handleMcpGet(req, res, sessionManager),
	);
	app.delete("/mcp", bearerAuth, (req, res) =>
		handleMcpDelete(req, res, sessionManager),
	);

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
