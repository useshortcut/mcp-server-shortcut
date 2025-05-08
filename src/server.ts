import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ShortcutClient } from "@shortcut/client";
import { name, version } from "../package.json";

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

let apiToken = process.env.SHORTCUT_API_TOKEN;

// If a SHORTCUT_API_TOKEN is provided as an argument, use it instead of the environment variable.
if (process.argv.length === 3) {
	const [name, token] = String(process.argv[2]).split("=");
	if (name === "SHORTCUT_API_TOKEN") apiToken = token;
}

if (!apiToken) {
	console.error("SHORTCUT_API_TOKEN is required");
	process.exit(1);
}

const server = new McpServer({ name, version });
const client = new ShortcutClientWrapper(new ShortcutClient(apiToken));

UserTools.create(client, server);
StoryTools.create(client, server);
IterationTools.create(client, server);
EpicTools.create(client, server);
ObjectiveTools.create(client, server);
TeamTools.create(client, server);
WorkflowTools.create(client, server);

async function startServer() {
	try {
		const transport = new StdioServerTransport();
		await server.connect(transport);
	} catch (error) {
		console.error("Fatal:", error);
		process.exit(1);
	}
}

startServer();
