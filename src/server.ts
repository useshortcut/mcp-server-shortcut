import { name, version } from "../package.json";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ShortcutClient } from "./shortcut-client";
import { StoryTools } from "./stories";
import { UserTools } from "./user";
import { EpicTools } from "./epics";
import { ObjectiveTools } from "./objectives";
import { IterationTools } from "./iterations";

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
const client = new ShortcutClient(apiToken);

UserTools.create(client, server);
StoryTools.create(client, server);
IterationTools.create(client, server);
EpicTools.create(client, server);
ObjectiveTools.create(client, server);

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
