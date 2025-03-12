import { name, version } from "../package.json";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ShortcutClient } from "@shortcut/client";
import { ShortcutClientWrapper } from "@/client/shortcut";

import { StoryTools } from "./tools/stories";
import { UserTools } from "./tools/user";
import { EpicTools } from "./tools/epics";
import { ObjectiveTools } from "./tools/objectives";
import { IterationTools } from "./tools/iterations";
import { TeamTools } from "./tools/teams";
import { WorkflowTools } from "./tools/workflows";

let apiToken = process.env.SHORTCUT_API_TOKEN;

if (process.argv.length > 2) {
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
		console.log("Starting server...");
		const transport = new StdioServerTransport();
		await server.connect(transport);
		console.log("Server running!");
	} catch (error) {
		console.error("Fatal:", error);
		process.exit(1);
	}
}

startServer();
