import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { ShortcutClient } from "@shortcut/client";
import express, { type NextFunction, type Request, type Response } from "express";
import pino from "pino";
import { ShortcutClientWrapper } from "@/client/shortcut";
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
	MCP_SESSION_ID: "mcp-session-id",
	LAST_EVENT_ID: "last-event-id",
} as const;

const JSON_RPC_ERRORS = {
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
	apiToken: string;
	apiBaseUrl: string;
	mcpServerUrl: string;
	authServerIssuerUrl?: string;
	enableOAuthProtectedResourceMetadata: boolean;
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

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
	if (value === undefined) return defaultValue;
	return value.toLowerCase() !== "false";
}

/** DEBUG_LEVEL: 0 = none, 1 = HTTP debug (redacted), 2 = verbose, 3 = dump everything */
function parseDebugLevel(
	value: string,
): { httpDebug: boolean; httpDebugVerbose: boolean; httpDebugDumpAll: boolean } {
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
	let apiToken = process.env.SHORTCUT_API_TKN || process.env.SHORTCUT_API_TOKEN;
	let isReadonly = process.env.SHORTCUT_READONLY !== "false";
	let enabledTools = parseToolsList(process.env.SHORTCUT_TOOLS || "");
	let apiServer = process.env.API_SERVER ?? process.env.AUTH_SERVER ?? "api.app.shortcut.com";
	let authServer = process.env.AUTH_SERVER;
	let enableOAuthProtectedResourceMetadata = parseBoolean(
		process.env.ENABLE_OAUTH_PROTECTED_RESOURCE_METADATA,
		true,
	);
	let { httpDebug, httpDebugVerbose, httpDebugDumpAll } = parseDebugLevel(process.env.DEBUG_LEVEL ?? "0");

	if (process.argv.length >= 3) {
		process.argv
			.slice(2)
			.map((arg) => arg.split("="))
			.forEach(([name, value]) => {
				if (name === "SHORTCUT_API_TKN") apiToken = value;
				if (name === "SHORTCUT_API_TOKEN") apiToken = value;
				if (name === "SHORTCUT_READONLY") isReadonly = value !== "false";
				if (name === "SHORTCUT_TOOLS") enabledTools = parseToolsList(value);
				if (name === "API_SERVER") apiServer = value;
				if (name === "AUTH_SERVER") authServer = value;
				if (name === "ENABLE_OAUTH_PROTECTED_RESOURCE_METADATA") {
					enableOAuthProtectedResourceMetadata = parseBoolean(value, true);
				}
				if (name === "DEBUG_LEVEL") {
					const parsed = parseDebugLevel(value);
					httpDebug = parsed.httpDebug;
					httpDebugVerbose = parsed.httpDebugVerbose;
					httpDebugDumpAll = parsed.httpDebugDumpAll;
				}
			});
	}

	if (!apiToken) {
		throw new Error("A Shortcut API token is required (SHORTCUT_API_TOKEN or SHORTCUT_API_TKN).");
	}

	const port = Number.parseInt(process.env.PORT || String(DEFAULT_PORT), 10);
	const mcpServerUrl = process.env.MCP_SERVER_URL ?? `http://localhost:${port}`;
	const apiBaseUrl = toHttpsUrl(apiServer, "API_SERVER");
	const authServerIssuerUrl = enableOAuthProtectedResourceMetadata
		? toHttpsUrl(authServer ?? apiServer, "AUTH_SERVER")
		: undefined;

	return {
		port,
		apiToken,
		apiBaseUrl,
		mcpServerUrl,
		authServerIssuerUrl,
		enableOAuthProtectedResourceMetadata,
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

	add(sessionId: string, transport: StreamableHTTPServerTransport): void {
		this.sessions.set(sessionId, {
			transport,
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

function createServerInstance(config: ServerConfig): CustomMcpServer {
	const server = new CustomMcpServer({
		readonly: config.isReadonly,
		tools: config.enabledTools,
	});

	const clientWrapper = new ShortcutClientWrapper(
		new ShortcutClient(config.apiToken, { baseURL: config.apiBaseUrl }),
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

	return server;
}

async function createTransport(
	config: ServerConfig,
	sessionManager: SessionManager,
): Promise<StreamableHTTPServerTransport> {
	let transport: StreamableHTTPServerTransport | null = null;
	const server = createServerInstance(config);

	transport = new StreamableHTTPServerTransport({
		sessionIdGenerator: () => randomUUID(),
		onsessioninitialized: (sid): void => {
			if (transport) {
				sessionManager.add(sid, transport);
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

	try {
		if (sessionId && sessionManager.has(sessionId)) {
			const session = sessionManager.get(sessionId);
			if (!session) {
				sendSessionNotFoundError(res, sessionId, requestId);
				return;
			}
			await session.transport.handleRequest(req, res, req.body);
			return;
		}

		if (isInitializeRequest(req.body)) {
			const transport = await createTransport(config, sessionManager);
			await transport.handleRequest(req, res, req.body);
			return;
		}

		if (sessionId && !sessionManager.has(sessionId)) {
			sendSessionNotFoundError(res, sessionId, requestId);
			return;
		}

		sendBadRequestError(res, "No session ID provided for non-initialization request", requestId);
	} catch (error) {
		logger.error({ error }, "Error handling MCP POST request");
		sendInternalError(res, requestId);
	}
}

async function handleMcpGet(
	req: Request,
	res: Response,
	sessionManager: SessionManager,
): Promise<void> {
	const sessionId = req.headers[HEADERS.MCP_SESSION_ID] as string | undefined;

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
		await session.transport.handleRequest(req, res);
	} catch (error) {
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
): Promise<void> {
	const sessionId = req.headers[HEADERS.MCP_SESSION_ID] as string | undefined;

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
		await session.transport.handleRequest(req, res);
	} catch (error) {
		logger.error({ error }, "Error handling session termination");
		if (!res.headersSent) {
			res.status(500).send("Error processing session termination");
		}
	}
}

function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
	res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id, Last-Event-Id");
	res.header("Access-Control-Expose-Headers", "Mcp-Session-Id");

	if (req.method === "OPTIONS") {
		res.sendStatus(204);
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

async function startServer() {
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
	if (config.enableOAuthProtectedResourceMetadata && config.authServerIssuerUrl) {
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
	} else {
		logger.info("OAuth protected-resource metadata endpoints are disabled");
	}

	app.post("/mcp", (req, res) => handleMcpPost(req, res, sessionManager, config));
	app.get("/mcp", (req, res) => handleMcpGet(req, res, sessionManager));
	app.delete("/mcp", (req, res) => handleMcpDelete(req, res, sessionManager));

	app.listen(config.port, () => {
		logger.info(
			{
				port: config.port,
				readonly: config.isReadonly,
				sessionTTL: `${config.sessionTimeoutMs / 1000 / 60}m`,
				enabledTools: config.enabledTools.length > 0 ? config.enabledTools : "all",
				mcpSpec: "2025-11-25",
				auth: "none",
				oauthProtectedResourceMetadata: config.enableOAuthProtectedResourceMetadata,
				authServer: config.authServerIssuerUrl ?? "disabled",
				apiBaseUrl: config.apiBaseUrl,
				debugLevel: process.env.DEBUG_LEVEL ?? "0",
			},
			"Shortcut MCP Server (No Auth) started",
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

startServer().catch((error) => {
	logger.fatal({ error }, "Fatal error starting no-auth HTTP server");
	process.exit(1);
});
