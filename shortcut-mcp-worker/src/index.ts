import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ShortcutClient } from "@shortcut/client";
import { getTokenFromRequest, handleAuth } from "./auth";
import { HttpSseTransport } from "./transport/http-sse";

// Import shared tools
import {
	EpicTools,
	IterationTools,
	ObjectiveTools,
	ShortcutClientWrapper,
	StoryTools,
	TeamTools,
	UserTools,
	WorkflowTools,
} from "@shortcut/mcp-tools";

// Read package.json for name and version
// These would normally be imported with: import { name, version } from "../package.json"
const pkgInfo = {
	name: "@shortcut/mcp",
	version: "0.1.0",
};

export interface Env {
	// Environment variables for authentication
	SHORTCUT_CLIENT_ID: string;
	SHORTCUT_CLIENT_SECRET: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// Handle OPTIONS requests for CORS
		if (request.method === "OPTIONS") {
			return handleCorsRequest();
		}

		const url = new URL(request.url);

		// Handle OAuth routes
		if (url.pathname.startsWith("/oauth")) {
			return handleAuth(request, env);
		}

		// Handle MCP SSE endpoint
		if (url.pathname === "/sse" && request.method === "POST") {
			try {
				// Get token from session, headers, or query parameters
				const token = await getTokenFromRequest(request, env);
				if (!token) {
					return new Response("Unauthorized: API token is required", {
						status: 401,
						headers: getCorsHeaders(),
					});
				}

				// Create MCP server
				const server = new McpServer({
					name: pkgInfo.name,
					version: pkgInfo.version,
				});

				// Initialize client with token
				const client = new ShortcutClientWrapper(new ShortcutClient(token));

				// Register all tools
				UserTools.create(client, server);
				StoryTools.create(client, server);
				IterationTools.create(client, server);
				EpicTools.create(client, server);
				ObjectiveTools.create(client, server);
				TeamTools.create(client, server);
				WorkflowTools.create(client, server);

				// Create transport and connect
				const transport = new HttpSseTransport(request, env);

				// Connect transport to server (this will start handling the request)
				ctx.waitUntil(server.connect(transport));

				// Return SSE response stream
				return await transport.getResponse();
			} catch (error) {
				console.error("Error handling MCP request:", error);
				return new Response(`Error: ${error.message}`, {
					status: 500,
					headers: getCorsHeaders(),
				});
			}
		}

		// Return connection instructions for home page
		if (url.pathname === "/" || url.pathname === "") {
			return new Response(
				`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Shortcut MCP Server</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                line-height: 1.6;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
              }
              code {
                background: #f4f4f4;
                padding: 2px 5px;
                border-radius: 3px;
              }
              pre {
                background: #f4f4f4;
                padding: 10px;
                border-radius: 5px;
                overflow-x: auto;
              }
            </style>
          </head>
          <body>
            <h1>Shortcut MCP Server</h1>
            <p>This is a Model Context Protocol (MCP) server for Shortcut. It allows AI assistants to interact with your Shortcut projects.</p>
            
            <h2>Authentication</h2>
            <p>To use this server, you need to authenticate:</p>
            <p><a href="/oauth/authorize">Authenticate with Shortcut</a></p>
            
            <h2>Connection Information</h2>
            <p>MCP endpoint: <code>${url.origin}/sse</code></p>
            
            <h2>Configuration</h2>
            <p>To connect an AI assistant to this MCP server, add the following to your configuration:</p>
            
            <h3>Claude Code</h3>
            <pre>{
  "projects": {
    "mcpServers": {
      "shortcut": {
        "mcpUrl": "${url.origin}/sse"
      }
    }
  }
}</pre>
            
            <h3>Cursor</h3>
            <pre>{
  "mcpServers": {
    "shortcut": {
      "mcpUrl": "${url.origin}/sse"
    }
  }
}</pre>
            
            <h3>Windsurf</h3>
            <pre>{
  "mcpServers": {
    "shortcut": {
      "mcpUrl": "${url.origin}/sse"
    }
  }
}</pre>
          </body>
        </html>
      `,
				{
					headers: {
						"Content-Type": "text/html",
						...getCorsHeaders(),
					},
				},
			);
		}

		// Handle 404 for all other routes
		return new Response("Not found", {
			status: 404,
			headers: getCorsHeaders(),
		});
	},
};

// Helper function for CORS headers
function getCorsHeaders() {
	return {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type, Authorization",
	};
}

// Handle CORS preflight requests
function handleCorsRequest() {
	return new Response(null, {
		status: 204,
		headers: getCorsHeaders(),
	});
}
