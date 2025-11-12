import express, { type Request, type Response, type NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { ShortcutClient } from "@shortcut/client";
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

const PORT = Number.parseInt(process.env.PORT || "9191", 10);
let isReadonly = process.env.SHORTCUT_READONLY !== "false";
let enabledTools = (process.env.SHORTCUT_TOOLS || "")
	.split(",")
	.map((tool) => tool.trim())
	.filter(Boolean);

// Parse command line arguments
if (process.argv.length >= 3) {
	process.argv
		.slice(2)
		.map((arg) => arg.split("="))
		.forEach(([name, value]) => {
			if (name === "SHORTCUT_READONLY") isReadonly = value !== "false";
			if (name === "SHORTCUT_TOOLS")
				enabledTools = value
					.split(",")
					.map((tool) => tool.trim())
					.filter(Boolean);
		});
}

/**
 * Extract API token from request headers.
 * Supports both Authorization: Bearer <token> and X-Shortcut-API-Token: <token>
 */
function extractApiToken(req: Request): string | null {
	// Try Authorization header first
	const authHeader = req.headers.authorization;
	if (authHeader?.startsWith("Bearer ")) {
		return authHeader.slice(7);
	}

	// Try custom header
	const customHeader = req.headers["x-shortcut-api-token"];
	if (typeof customHeader === "string") {
		return customHeader;
	}

	return null;
}

/**
 * Create and configure an MCP server instance for a connection
 */
function createServerInstance(apiToken: string): CustomMcpServer {
	const server = new CustomMcpServer({ readonly: isReadonly, tools: enabledTools });
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

// Map to store transports by session ID
const transports: Record<string, StreamableHTTPServerTransport> = {};

/**
 * Start the SSE server
 */
async function startServer() {
	const app = express();

	// Parse JSON bodies
	app.use(express.json());

	// CORS middleware
	app.use((req: Request, res: Response, next: NextFunction) => {
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
	});

	// Health check endpoint
	app.get("/health", (_req: Request, res: Response) => {
		res.json({
			status: "ok",
			service: "shortcut-mcp-server",
			timestamp: new Date().toISOString(),
		});
	});

	// MCP POST endpoint for initialization and JSON-RPC messages
	app.post("/mcp", async (req: Request, res: Response) => {
		const sessionId = req.headers["mcp-session-id"] as string | undefined;
		
		// Always extract API token from current request
		const apiToken = extractApiToken(req);

		if (sessionId) {
			console.log(`Received MCP request for session: ${sessionId}`);
		} else {
			console.log("Received MCP request (new session)");
		}

		try {
			let transport: StreamableHTTPServerTransport;

			if (sessionId && transports[sessionId]) {
				// Reuse existing transport for this session
				// Validate that we have an API token for authenticated requests
				if (!apiToken) {
					res.status(401).json({
						jsonrpc: "2.0",
						error: {
							code: -32000,
							message:
								"Unauthorized: API token required. Provide via Authorization: Bearer <token> or X-Shortcut-API-Token: <token>",
						},
						id: null,
					});
					return;
				}
				transport = transports[sessionId];
			} else if (isInitializeRequest(req.body)) {
				// Initialize request - can be with or without session ID
				if (!apiToken) {
					res.status(401).json({
						jsonrpc: "2.0",
						error: {
							code: -32000,
							message:
								"Unauthorized: API token required. Provide via Authorization: Bearer <token> or X-Shortcut-API-Token: <token>",
						},
						id: null,
					});
					return;
				}

				// Create new transport for initialization
				transport = new StreamableHTTPServerTransport({
					sessionIdGenerator: () => randomUUID(),
					onsessioninitialized: (sid) => {
						console.log(`Session initialized with ID: ${sid}`);
						transports[sid] = transport;
					},
				});

				// Set up cleanup on close
				transport.onclose = () => {
					const sid = transport.sessionId;
					if (sid && transports[sid]) {
						console.log(`Transport closed for session ${sid}`);
						delete transports[sid];
					}
				};

				// Create server instance with the API token and connect
				const server = createServerInstance(apiToken);
				await server.connect(transport);
			} else if (sessionId && !transports[sessionId]) {
				// Session ID provided but doesn't exist (stale/invalid)
				console.log(`Session ${sessionId} not found - session may have expired or server restarted`);
				res.status(404).json({
					jsonrpc: "2.0",
					error: {
						code: -32001,
						message: "Session not found. Please re-initialize the connection.",
					},
					id: req.body?.id || null,
				});
				return;
			} else {
				// Non-initialization request without session ID
				res.status(400).json({
					jsonrpc: "2.0",
					error: {
						code: -32000,
						message: "Bad Request: No session ID provided for non-initialization request",
					},
					id: req.body?.id || null,
				});
				return;
			}

			// Handle the request
			await transport.handleRequest(req, res, req.body);
		} catch (error) {
			console.error("Error handling MCP POST request:", error);
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
		}
	});

	// MCP GET endpoint for SSE streams
	app.get("/mcp", async (req: Request, res: Response) => {
		const sessionId = req.headers["mcp-session-id"] as string | undefined;

		if (!sessionId || !transports[sessionId]) {
			res.status(400).send("Invalid or missing session ID");
			return;
		}

		const lastEventId = req.headers["last-event-id"];
		if (lastEventId) {
			console.log(`Client reconnecting with Last-Event-ID: ${lastEventId}`);
		} else {
			console.log(`Establishing new SSE stream for session ${sessionId}`);
		}

		try {
			const transport = transports[sessionId];
			await transport.handleRequest(req, res);
		} catch (error) {
			console.error("Error handling MCP GET request:", error);
			if (!res.headersSent) {
				res.status(500).send("Internal server error");
			}
		}
	});

	// MCP DELETE endpoint for session termination
	app.delete("/mcp", async (req: Request, res: Response) => {
		const sessionId = req.headers["mcp-session-id"] as string | undefined;

		if (!sessionId || !transports[sessionId]) {
			res.status(400).send("Invalid or missing session ID");
			return;
		}

		console.log(`Received session termination request for session ${sessionId}`);

		try {
			const transport = transports[sessionId];
			await transport.handleRequest(req, res);
		} catch (error) {
			console.error("Error handling session termination:", error);
			if (!res.headersSent) {
				res.status(500).send("Error processing session termination");
			}
		}
	});

	// Start the server
	app.listen(PORT, () => {
		console.log(`🚀 Shortcut MCP SSE Server running on http://localhost:${PORT}`);
		console.log(`   Health check: http://localhost:${PORT}/health`);
		console.log(`   MCP endpoint: http://localhost:${PORT}/mcp`);
		console.log(`   Read-only mode: ${isReadonly ? "enabled" : "disabled"}`);
		if (enabledTools.length > 0) {
			console.log(`   Enabled tools: ${enabledTools.join(", ")}`);
		}
	});

	// Handle graceful shutdown
	process.on("SIGINT", async () => {
		console.log("\nShutting down server...");
		// Close all active transports
		for (const sessionId in transports) {
			try {
				console.log(`Closing transport for session ${sessionId}`);
				await transports[sessionId].close();
				delete transports[sessionId];
			} catch (error) {
				console.error(`Error closing transport for session ${sessionId}:`, error);
			}
		}
		console.log("Server shutdown complete");
		process.exit(0);
	});
}

startServer().catch((error) => {
	console.error("Fatal error starting server:", error);
	process.exit(1);
});
