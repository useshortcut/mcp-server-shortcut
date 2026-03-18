import { randomUUID } from "node:crypto";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { ShortcutClient } from "@shortcut/client";
import express, { type NextFunction, type Request, type Response } from "express";
import pino from "pino";
import { ShortcutClientWrapper } from "@/client/shortcut";
import { verifyPresentedAccessToken } from "./auth/provider";
import { buildBearerAuthHeader, parseBearerAuthError, toBearerAuthError } from "./http-auth";
import { CustomMcpServer } from "./mcp/CustomMcpServer";
import { CustomFieldTools } from "./tools/custom-fields";
import { DocumentTools } from "./tools/documents";
import { EpicTools } from "./tools/epics";
import { IterationTools } from "./tools/iterations";
import { LabelTools } from "./tools/labels";
import { ObjectiveTools } from "./tools/objectives";
import { ProjectTools } from "./tools/projects";
import { StoryTools } from "./tools/stories";
import { TeamTools } from "./tools/teams";
import { UserTools } from "./tools/user";
import { WorkflowTools } from "./tools/workflows";
import "dotenv/config";

const DEFAULT_PORT = 9292;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

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

interface ServerConfig {
	port: number;
	apiBaseUrl: string;
	mcpServerUrl: string;
	authServerIssuerUrl: string;
	isReadonly: boolean;
	enabledTools: string[];
	sessionTimeoutMs: number;
	httpDebug: boolean;
	httpDebugVerbose: boolean;
	httpDebugDumpAll: boolean;
}

function parseToolsList(toolsStr: string): string[] {
	return toolsStr
		.split(",")
		.map((tool) => tool.trim())
		.filter(Boolean);
}

/** DEBUG_LEVEL: 0 = none, 1 = HTTP debug (redacted), 2 = verbose, 3 = dump everything */
function parseDebugLevel(value: string): {
	httpDebug: boolean;
	httpDebugVerbose: boolean;
	httpDebugDumpAll: boolean;
} {
	const level = Number.parseInt(value, 10);
	if (Number.isNaN(level) || level < 0) {
		return { httpDebug: false, httpDebugVerbose: false, httpDebugDumpAll: false };
	}
	return {
		httpDebug: level >= 1,
		httpDebugVerbose: level >= 2,
		httpDebugDumpAll: level >= 3,
	};
}

let httpDebugVerbose = false;
let httpDebugDumpAll = false;

function logEvent(event: string, data: Record<string, unknown>): void {
	if (httpDebugDumpAll) {
		logger.info({ event, ...data });
		return;
	}

	const payload = httpDebugVerbose
		? data
		: Object.fromEntries(
				Object.entries(data).map(([k, v]) =>
					VERBOSE_KEYS.includes(k as (typeof VERBOSE_KEYS)[number]) ? [k, "[REDACTED]"] : [k, v],
				),
			);

	logger.info({ event, ...payload });
}

function loadConfig(): ServerConfig {
	let isReadonly = process.env.SHORTCUT_READONLY !== "false";
	let enabledTools = parseToolsList(process.env.SHORTCUT_TOOLS || "");
	let apiServer = process.env.API_SERVER ?? process.env.AUTH_SERVER ?? "api.app.shortcut.com";
	let authServer = process.env.AUTH_SERVER;
	let { httpDebug, httpDebugVerbose, httpDebugDumpAll } = parseDebugLevel(
		process.env.DEBUG_LEVEL ?? "0",
	);

	if (process.argv.length >= 3) {
		process.argv
			.slice(2)
			.map((arg) => arg.split("="))
			.forEach(([name, value]) => {
				if (name === "SHORTCUT_READONLY") isReadonly = value !== "false";
				if (name === "SHORTCUT_TOOLS") enabledTools = parseToolsList(value);
				if (name === "API_SERVER") apiServer = value;
				if (name === "AUTH_SERVER") authServer = value;
				if (name === "DEBUG_LEVEL") {
					const parsed = parseDebugLevel(value);
					httpDebug = parsed.httpDebug;
					httpDebugVerbose = parsed.httpDebugVerbose;
					httpDebugDumpAll = parsed.httpDebugDumpAll;
				}
			});
	}

	const port = Number.parseInt(process.env.PORT || String(DEFAULT_PORT), 10);
	const mcpServerUrl = process.env.MCP_SERVER_URL ?? `http://localhost:${port}`;
	const apiBaseUrl = toHttpsUrl(apiServer, "API_SERVER");
	const authServerIssuerUrl = toHttpsUrl(authServer ?? apiServer, "AUTH_SERVER");

	return {
		port,
		apiBaseUrl,
		mcpServerUrl,
		authServerIssuerUrl,
		isReadonly,
		enabledTools,
		sessionTimeoutMs: SESSION_TIMEOUT_MS,
		httpDebug,
		httpDebugVerbose,
		httpDebugDumpAll,
	};
}

function toHttpsUrl(value: string, envName: string): string {
	try {
		const normalized = /^https?:\/\//.test(value) ? value : `https://${value}`;
		const parsed = new URL(normalized);
		if (!parsed.protocol || !parsed.hostname) {
			throw new Error();
		}
		return parsed.origin;
	} catch {
		throw new Error(`${envName} must be a valid hostname or URL. Received: ${value}`);
	}
}

interface SessionData {
	transport: StreamableHTTPServerTransport;
	clientWrapper: ShortcutClientWrapper;
	createdAt: Date;
	lastAccessedAt: Date;
}

class SessionManager {
	private sessions: Map<string, SessionData> = new Map();
	private cleanupInterval: ReturnType<typeof setInterval> | null = null;

	constructor(private timeoutMs: number) {
		this.cleanupInterval = setInterval(() => this.cleanupStaleSessions(), 60000);
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
		clientWrapper: ShortcutClientWrapper,
	): void {
		this.sessions.set(sessionId, {
			transport,
			clientWrapper,
			createdAt: new Date(),
			lastAccessedAt: new Date(),
		});
		logger.info({ sessionId }, "Session initialized");
	}

	remove(sessionId: string): void {
		if (this.sessions.delete(sessionId)) {
			logger.info({ sessionId }, "Session removed");
		}
	}

	async invalidateSession(sessionId: string, reason: string): Promise<void> {
		const session = this.sessions.get(sessionId);
		if (!session) return;
		logger.info({ sessionId, reason }, "Invalidating session");
		try {
			await session.transport.close();
		} catch (error) {
			logger.error({ sessionId, error }, "Error closing transport while invalidating session");
		}
		this.remove(sessionId);
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
	res.header("WWW-Authenticate", buildBearerAuthHeader());
	res.status(401).json({
		jsonrpc: "2.0",
		error: JSON_RPC_ERRORS.UNAUTHORIZED,
		id: requestId || null,
	} satisfies JsonRpcError);
}

function sendBearerTokenError(
	res: Response,
	authError: { error: string; errorDescription?: string; headerValue: string },
): void {
	res.header("WWW-Authenticate", authError.headerValue);
	res.status(401).json({
		error: authError.error,
		...(authError.errorDescription ? { error_description: authError.errorDescription } : {}),
	});
}

/**
 * Maps verifier failures into the normalized bearer auth shape used by HTTP
 * responses. The verifier may throw either a typed `BearerAuthError` or the
 * SDK's `InvalidTokenError`, depending on which validation path failed.
 */
function mapVerifierErrorToBearerAuth(error: unknown) {
	const parsed = parseBearerAuthError(error);
	if (parsed) {
		return parsed;
	}
	if (error instanceof InvalidTokenError) {
		return {
			error: "invalid_token",
			errorDescription: "The access token expired",
			headerValue: buildBearerAuthHeader("invalid_token", "The access token expired"),
		};
	}
	return null;
}

/**
 * Rejects invalid or expired bearer tokens before the request enters the MCP
 * transport. This is what allows clients to see a real HTTP 401 challenge and
 * trigger their built-in refresh flow.
 */
export async function preflightVerifyAccessToken(
	accessToken: string,
	res: Response,
	verifyAccessToken: (token: string) => Promise<unknown> = verifyPresentedAccessToken,
): Promise<boolean> {
	try {
		await verifyAccessToken(accessToken);
		return true;
	} catch (error) {
		const authError = mapVerifierErrorToBearerAuth(error);
		if (authError) {
			sendBearerTokenError(res, authError);
			return false;
		}
		throw error;
	}
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
	_session: SessionData,
	warn: (message: string) => void,
): boolean {
	const presentedBearerToken = extractBearerToken(req);
	if (!presentedBearerToken) {
		warn("Missing bearer token for session-bound request");
		return false;
	}
	return true;
}

function createOAuthShortcutClient(accessToken: string, baseURL: string): ShortcutClient {
	const client = new ShortcutClient("_placeholder_", {
		baseURL,
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	});
	// biome-ignore lint/suspicious/noExplicitAny: accessing axios internals
	const instance = (client as any).instance;
	if (instance?.defaults?.headers) {
		delete instance.defaults.headers["Shortcut-Token"];
		if (instance.defaults.headers.common) {
			delete instance.defaults.headers.common["Shortcut-Token"];
		}
	}

	// Log outbound Shortcut API traffic in verbose modes.
	// DEBUG_LEVEL=2 and DEBUG_LEVEL=3 both enable full API request/response visibility.
	if (httpDebugVerbose && instance?.interceptors) {
		instance.interceptors.request.use((config: unknown) => {
			const cfg = config as Record<string, unknown>;
			logEvent("shortcut_api_request", {
				method: cfg.method,
				baseURL: cfg.baseURL,
				url: cfg.url,
				headers: cfg.headers,
				params: cfg.params,
				data: cfg.data,
			});
			return config;
		});

		instance.interceptors.response.use(
			(response: unknown) => {
				const res = response as Record<string, unknown>;
				const resConfig = (res.config as Record<string, unknown> | undefined) ?? {};
				logEvent("shortcut_api_response", {
					method: resConfig.method,
					url: resConfig.url,
					status: res.status,
					headers: res.headers,
					data: res.data,
				});
				return response;
			},
			(error: unknown) => {
				const err = error as Record<string, unknown>;
				const errConfig = (err.config as Record<string, unknown> | undefined) ?? {};
				const errResponse = (err.response as Record<string, unknown> | undefined) ?? {};
				logEvent("shortcut_api_response_error", {
					method: errConfig.method,
					url: errConfig.url,
					status: errResponse.status,
					headers: errResponse.headers,
					data: errResponse.data,
					message: err.message,
				});
				return Promise.reject(toBearerAuthError(error) ?? error);
			},
		);
	}
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

	const clientWrapper = new ShortcutClientWrapper(
		createOAuthShortcutClient(accessToken, config.apiBaseUrl),
	);

	// Most important tools should be at the top.
	UserTools.create(clientWrapper, server);
	StoryTools.create(clientWrapper, server);
	IterationTools.create(clientWrapper, server);
	EpicTools.create(clientWrapper, server);
	ObjectiveTools.create(clientWrapper, server);
	TeamTools.create(clientWrapper, server);
	WorkflowTools.create(clientWrapper, server);
	DocumentTools.create(clientWrapper, server);
	LabelTools.create(clientWrapper, server);
	ProjectTools.create(clientWrapper, server);
	CustomFieldTools.create(clientWrapper, server);

	return { server, clientWrapper };
}

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
				sessionManager.add(sid, transport, clientWrapper);
			}
		},
	});

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

async function handleMcpPost(
	req: Request,
	res: Response,
	sessionManager: SessionManager,
	config: ServerConfig,
): Promise<void> {
	const sessionId = req.headers[HEADERS.MCP_SESSION_ID] as string | undefined;
	const requestId = req.body?.id;
	const accessToken = extractBearerToken(req);

	try {
		if (sessionId && sessionManager.has(sessionId)) {
			const session = sessionManager.get(sessionId);
			if (!session) {
				sendSessionNotFoundError(res, sessionId, requestId);
				return;
			}
			if (!isAuthorizedForSession(req, session, (message) => logger.warn({ sessionId }, message))) {
				sendUnauthorizedError(res, requestId);
				return;
			}
			if (accessToken) {
				if (!(await preflightVerifyAccessToken(accessToken, res))) {
					return;
				}
				session.clientWrapper.updateClient(
					createOAuthShortcutClient(accessToken, config.apiBaseUrl),
				);
			}
			await session.transport.handleRequest(req, res, req.body);
			return;
		}

		if (isInitializeRequest(req.body)) {
			if (!accessToken) {
				sendUnauthorizedError(res, requestId);
				return;
			}
			if (!(await preflightVerifyAccessToken(accessToken, res))) {
				return;
			}
			const transport = await createTransport(accessToken, config, sessionManager);
			await transport.handleRequest(req, res, req.body);
			return;
		}

		if (sessionId && !sessionManager.has(sessionId)) {
			sendSessionNotFoundError(res, sessionId, requestId);
			return;
		}

		sendBadRequestError(res, "No session ID provided for non-initialization request", requestId);
	} catch (error) {
		const authError = parseBearerAuthError(error);
		if (authError) {
			logger.warn(
				{
					sessionId,
					error: authError.error,
					errorDescription: authError.errorDescription,
				},
				"Upstream bearer token rejected during MCP POST",
			);
			sendBearerTokenError(res, authError);
			return;
		}
		logger.error({ error }, "Error handling MCP POST request");
		sendInternalError(res, requestId);
	}
}

async function handleMcpGet(
	req: Request,
	res: Response,
	sessionManager: SessionManager,
	config: ServerConfig,
): Promise<void> {
	const sessionId = req.headers[HEADERS.MCP_SESSION_ID] as string | undefined;
	const accessToken = extractBearerToken(req);

	if (!sessionId || !sessionManager.has(sessionId)) {
		res.status(400).send("Invalid or missing session ID");
		return;
	}

	const lastEventId = req.headers[HEADERS.LAST_EVENT_ID];
	if (lastEventId) {
		logger.info({ sessionId, lastEventId }, "Client reconnecting with Last-Event-ID");
	}

	try {
		const session = sessionManager.get(sessionId);
		if (!session) {
			res.status(400).send("Invalid or missing session ID");
			return;
		}
		if (!isAuthorizedForSession(req, session, (message) => logger.warn({ sessionId }, message))) {
			sendUnauthorizedError(res);
			return;
		}
		if (accessToken) {
			if (!(await preflightVerifyAccessToken(accessToken, res))) {
				return;
			}
			session.clientWrapper.updateClient(createOAuthShortcutClient(accessToken, config.apiBaseUrl));
		}
		await session.transport.handleRequest(req, res);
	} catch (error) {
		const authError = parseBearerAuthError(error);
		if (authError) {
			logger.warn(
				{
					sessionId,
					error: authError.error,
					errorDescription: authError.errorDescription,
				},
				"Upstream bearer token rejected during MCP GET",
			);
			if (!res.headersSent) {
				sendBearerTokenError(res, authError);
			}
			return;
		}
		logger.error({ error }, "Error handling MCP GET request");
		if (!res.headersSent) {
			res.status(500).send("Internal server error");
		}
	}
}

async function handleMcpDelete(
	req: Request,
	res: Response,
	sessionManager: SessionManager,
	config: ServerConfig,
): Promise<void> {
	const sessionId = req.headers[HEADERS.MCP_SESSION_ID] as string | undefined;
	const accessToken = extractBearerToken(req);

	if (!sessionId || !sessionManager.has(sessionId)) {
		res.status(400).send("Invalid or missing session ID");
		return;
	}

	try {
		const session = sessionManager.get(sessionId);
		if (!session) {
			res.status(400).send("Invalid or missing session ID");
			return;
		}
		if (!isAuthorizedForSession(req, session, (message) => logger.warn({ sessionId }, message))) {
			sendUnauthorizedError(res);
			return;
		}
		if (accessToken) {
			if (!(await preflightVerifyAccessToken(accessToken, res))) {
				return;
			}
			session.clientWrapper.updateClient(createOAuthShortcutClient(accessToken, config.apiBaseUrl));
		}
		await session.transport.handleRequest(req, res);
	} catch (error) {
		const authError = parseBearerAuthError(error);
		if (authError) {
			logger.warn(
				{
					sessionId,
					error: authError.error,
					errorDescription: authError.errorDescription,
				},
				"Upstream bearer token rejected during MCP DELETE",
			);
			if (!res.headersSent) {
				sendBearerTokenError(res, authError);
			}
			return;
		}
		logger.error({ error }, "Error handling session termination");
		if (!res.headersSent) {
			res.status(500).send("Error processing session termination");
		}
	}
}

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

function requireBearerHeader(req: Request, res: Response, next: NextFunction): void {
	const token = extractBearerToken(req);
	if (!token) {
		sendUnauthorizedError(res, req.body?.id);
		return;
	}
	next();
}

function httpDebugRequestMiddleware(req: Request, _res: Response, next: NextFunction): void {
	const headers = { ...req.headers };
	if (!httpDebugDumpAll) {
		delete headers.authorization;
		delete headers.cookie;
	}

	logEvent("http_request", {
		method: req.method,
		path: req.path,
		url: req.originalUrl,
		query: req.query,
		headers,
		body: req.body,
	});

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

export async function startServer() {
	const config = loadConfig();
	httpDebugVerbose = config.httpDebugVerbose;
	httpDebugDumpAll = config.httpDebugDumpAll;
	const sessionManager = new SessionManager(config.sessionTimeoutMs);
	const app = express();

	app.use(express.json());
	if (config.httpDebug) app.use(httpDebugRequestMiddleware);
	if (config.httpDebug) app.use(httpDebugResponseMiddleware);
	app.use(corsMiddleware);
	app.set("trust proxy", 1);

	app.get("/health", (_req: Request, res: Response) => {
		res.json({
			status: "ok",
			service: "shortcut-mcp-server",
			transport: "streamable-http",
			timestamp: new Date().toISOString(),
			version: "2025-11-25",
			auth: "none",
		});
	});

	// OAuth protected-resource metadata for MCP clients. This server does not
	// run auth flows locally; it advertises the external authorization server.
	app.get(
		["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp"],
		(_req, res) => {
			res.json({
				resource: `${config.mcpServerUrl}/mcp`,
				authorization_servers: [config.authServerIssuerUrl],
				scopes_supported: ["openid"],
				bearer_methods_supported: ["header"],
			});
		},
	);

	app.post("/mcp", requireBearerHeader, (req, res) =>
		handleMcpPost(req, res, sessionManager, config),
	);
	app.get("/mcp", requireBearerHeader, (req, res) =>
		handleMcpGet(req, res, sessionManager, config),
	);
	app.delete("/mcp", requireBearerHeader, (req, res) =>
		handleMcpDelete(req, res, sessionManager, config),
	);

	app.listen(config.port, () => {
		logger.info(
			{
				port: config.port,
				readonly: config.isReadonly,
				sessionTTL: `${config.sessionTimeoutMs / 1000 / 60}m`,
				enabledTools: config.enabledTools.length > 0 ? config.enabledTools : "all",
				mcpSpec: "2025-11-25",
				auth: "bearer-required",
				authServer: config.authServerIssuerUrl,
				apiBaseUrl: config.apiBaseUrl,
				debugLevel: process.env.DEBUG_LEVEL ?? "0",
			},
			"Shortcut MCP Server (Bearer Required) started",
		);
		logger.info(`Server URL: http://localhost:${config.port}`);
		logger.info(`Health check: http://localhost:${config.port}/health`);
		logger.info(`MCP endpoint: http://localhost:${config.port}/mcp`);
	});

	process.on("SIGINT", async () => {
		await sessionManager.closeAll();
		process.exit(0);
	});

	process.on("SIGTERM", async () => {
		await sessionManager.closeAll();
		process.exit(0);
	});
}

if (import.meta.main) {
	startServer().catch((error) => {
		logger.fatal({ error }, "Fatal error starting no-auth HTTP server");
		process.exit(1);
	});
}
