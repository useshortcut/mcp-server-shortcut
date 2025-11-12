import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { ShortcutClient } from "@shortcut/client";
import express, { type NextFunction, type Request, type Response } from "express";
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

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_PORT = 9191;
const BEARER_PREFIX = "Bearer ";

const HEADERS = {
	AUTHORIZATION: "authorization",
	X_SHORTCUT_API_TOKEN: "x-shortcut-api-token",
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
// Configuration
// ============================================================================

interface ServerConfig {
	port: number;
	isReadonly: boolean;
	enabledTools: string[];
}

function loadConfig(): ServerConfig {
	let isReadonly = process.env.SHORTCUT_READONLY !== "false";
	let enabledTools = parseToolsList(process.env.SHORTCUT_TOOLS || "");

	// Parse command line arguments
	if (process.argv.length >= 3) {
		process.argv
			.slice(2)
			.map((arg) => arg.split("="))
			.forEach(([name, value]) => {
				if (name === "SHORTCUT_READONLY") isReadonly = value !== "false";
				if (name === "SHORTCUT_TOOLS") enabledTools = parseToolsList(value);
			});
	}

	return {
		port: Number.parseInt(process.env.PORT || String(DEFAULT_PORT), 10),
		isReadonly,
		enabledTools,
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

class SessionManager {
	private transports: Map<string, StreamableHTTPServerTransport> = new Map();

	has(sessionId: string): boolean {
		return this.transports.has(sessionId);
	}

	get(sessionId: string): StreamableHTTPServerTransport | undefined {
		return this.transports.get(sessionId);
	}

	add(sessionId: string, transport: StreamableHTTPServerTransport): void {
		this.transports.set(sessionId, transport);
		console.log(`Session initialized with ID: ${sessionId}`);
	}

	remove(sessionId: string): void {
		this.transports.delete(sessionId);
		console.log(`Transport closed for session ${sessionId}`);
	}

	async closeAll(): Promise<void> {
		console.log("\nShutting down server...");
		for (const [sessionId, transport] of this.transports.entries()) {
			try {
				console.log(`Closing transport for session ${sessionId}`);
				await transport.close();
				this.remove(sessionId);
			} catch (error) {
				console.error(`Error closing transport for session ${sessionId}:`, error);
			}
		}
		console.log("Server shutdown complete");
	}
}

// ============================================================================
// Authentication
// ============================================================================

function extractApiToken(req: Request): string | null {
	// Try Authorization header first
	const authHeader = req.headers[HEADERS.AUTHORIZATION];
	if (authHeader?.startsWith(BEARER_PREFIX)) {
		return authHeader.slice(BEARER_PREFIX.length);
	}

	// Try custom header
	const customHeader = req.headers[HEADERS.X_SHORTCUT_API_TOKEN];
	if (typeof customHeader === "string") {
		return customHeader;
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

function sendUnauthorizedError(res: Response): void {
	res.status(401).json({
		jsonrpc: "2.0",
		error: {
			...JSON_RPC_ERRORS.UNAUTHORIZED,
			message:
				"API token required. Provide via Authorization: Bearer <token> or X-Shortcut-API-Token: <token>",
		},
		id: null,
	} satisfies JsonRpcError);
}

function sendSessionNotFoundError(res: Response, sessionId: string, requestId?: unknown): void {
	console.log(`Session ${sessionId} not found - session may have expired or server restarted`);
	res.status(404).json({
		jsonrpc: "2.0",
		error: {
			...JSON_RPC_ERRORS.SESSION_NOT_FOUND,
			message: "Session not found. Please re-initialize the connection.",
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

function sendInternalError(res: Response): void {
	if (!res.headersSent) {
		res.status(500).json({
			jsonrpc: "2.0",
			error: JSON_RPC_ERRORS.INTERNAL_ERROR,
			id: null,
		} satisfies JsonRpcError);
	}
}

// ============================================================================
// MCP Server Creation
// ============================================================================

function createServerInstance(apiToken: string, config: ServerConfig): CustomMcpServer {
	const server = new CustomMcpServer({
		readonly: config.isReadonly,
		tools: config.enabledTools,
	});
	const client = new ShortcutClientWrapper(new ShortcutClient(apiToken));

	// The order these are created impacts the order they are listed to the LLM
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
	apiToken: string,
	config: ServerConfig,
	sessionManager: SessionManager,
): Promise<StreamableHTTPServerTransport> {
	let transport: StreamableHTTPServerTransport | null = null;

	transport = new StreamableHTTPServerTransport({
		sessionIdGenerator: () => randomUUID(),
		onsessioninitialized: (sid): void => {
			if (transport) {
				sessionManager.add(sid, transport);
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

	// Create server instance with the API token and connect
	const server = createServerInstance(apiToken, config);
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
	const apiToken = extractApiToken(req);

	console.log(sessionId ? `Received MCP request for session: ${sessionId}` : "Received MCP request (new session)");

	try {
		// Scenario 1: Existing session
		if (sessionId && sessionManager.has(sessionId)) {
			if (!apiToken) {
				sendUnauthorizedError(res);
				return;
			}
			const transport = sessionManager.get(sessionId)!;
			await transport.handleRequest(req, res, req.body);
			return;
		}

		// Scenario 2: Initialization request
		if (isInitializeRequest(req.body)) {
			if (!apiToken) {
				sendUnauthorizedError(res);
				return;
			}
			const transport = await createTransport(apiToken, config, sessionManager);
			await transport.handleRequest(req, res, req.body);
			return;
		}

		// Scenario 3: Stale session
		if (sessionId && !sessionManager.has(sessionId)) {
			sendSessionNotFoundError(res, sessionId, req.body?.id);
			return;
		}

		// Scenario 4: Missing session ID
		sendBadRequestError(res, "No session ID provided for non-initialization request", req.body?.id);
	} catch (error) {
		console.error("Error handling MCP POST request:", error);
		sendInternalError(res);
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
	console.log(
		lastEventId
			? `Client reconnecting with Last-Event-ID: ${lastEventId}`
			: `Establishing new SSE stream for session ${sessionId}`,
	);

	try {
		const transport = sessionManager.get(sessionId)!;
		await transport.handleRequest(req, res);
	} catch (error) {
		console.error("Error handling MCP GET request:", error);
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

	console.log(`Received session termination request for session ${sessionId}`);

	try {
		const transport = sessionManager.get(sessionId)!;
		await transport.handleRequest(req, res);
	} catch (error) {
		console.error("Error handling session termination:", error);
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
		"Content-Type, Authorization, X-Shortcut-API-Token, Mcp-Session-Id",
	);
	res.header("Access-Control-Expose-Headers", "Mcp-Session-Id");

	if (req.method === "OPTIONS") {
		res.sendStatus(204);
		return;
	}

	next();
}

// ============================================================================
// Server Setup
// ============================================================================

async function startServer() {
	const config = loadConfig();
	const sessionManager = new SessionManager();
	const app = express();

	// Middleware
	app.use(express.json());
	app.use(corsMiddleware);

	// Routes
	app.get("/health", (_req: Request, res: Response) => {
		res.json({
			status: "ok",
			service: "shortcut-mcp-server",
			timestamp: new Date().toISOString(),
		});
	});

	app.post("/mcp", (req, res) => handleMcpPost(req, res, sessionManager, config));
	app.get("/mcp", (req, res) => handleMcpGet(req, res, sessionManager));
	app.delete("/mcp", (req, res) => handleMcpDelete(req, res, sessionManager));

	// Start server
	app.listen(config.port, () => {
		console.log(`🚀 Shortcut MCP SSE Server running on http://localhost:${config.port}`);
		console.log(`   Health check: http://localhost:${config.port}/health`);
		console.log(`   MCP endpoint: http://localhost:${config.port}/mcp`);
		console.log(`   Read-only mode: ${config.isReadonly ? "enabled" : "disabled"}`);
		if (config.enabledTools.length > 0) {
			console.log(`   Enabled tools: ${config.enabledTools.join(", ")}`);
		}
	});

	// Graceful shutdown
	process.on("SIGINT", async () => {
		await sessionManager.closeAll();
		process.exit(0);
	});
}

// ============================================================================
// Entry Point
// ============================================================================

startServer().catch((error) => {
	console.error("Fatal error starting server:", error);
	process.exit(1);
});

