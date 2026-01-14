import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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

let apiToken = process.env.SHORTCUT_API_TOKEN;
let isReadonly = process.env.SHORTCUT_READONLY === "true";
let enabledTools = (process.env.SHORTCUT_TOOLS || "")
	.split(",")
	.map((tool) => tool.trim())
	.filter(Boolean);

// If a setting is provided as an argument, use it instead of the environment variable.
if (process.argv.length >= 3) {
	process.argv
		.slice(2)
		.map((arg) => arg.split("="))
		.forEach(([name, value]) => {
			if (name === "SHORTCUT_API_TOKEN") apiToken = value;
			if (name === "SHORTCUT_READONLY") isReadonly = value === "true";
			if (name === "SHORTCUT_TOOLS")
				enabledTools = value
					.split(",")
					.map((tool) => tool.trim())
					.filter(Boolean);
		});
}

if (!apiToken) {
	console.error("SHORTCUT_API_TOKEN is required");
	process.exit(1);
}

const server = new CustomMcpServer({ readonly: isReadonly, tools: enabledTools });
const client = new ShortcutClientWrapper(new ShortcutClient(apiToken));

// The order these are created impacts the order they are listed to the LLM. Most important tools should be at the top.
UserTools.create(client, server);
StoryTools.create(client, server);
IterationTools.create(client, server);
EpicTools.create(client, server);
ObjectiveTools.create(client, server);
TeamTools.create(client, server);
WorkflowTools.create(client, server);
DocumentTools.create(client, server);

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
