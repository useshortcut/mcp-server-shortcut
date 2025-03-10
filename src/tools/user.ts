import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ShortcutClient } from "../shortcut-client";
import { toResult } from "./utils";

export class UserTools {
	static create(client: ShortcutClient, server: McpServer) {
		const tools = new UserTools(client);

		server.tool(
			"get-current-user",
			"Get the current user",
			async () => await tools.getCurrentUser(),
		);

		return tools;
	}

	private client: ShortcutClient;

	constructor(client: ShortcutClient) {
		this.client = client;
	}

	async getCurrentUser() {
		const user = await this.client.getCurrentUser();

		if (!user) throw new Error("Failed to retrieve current user.");

		return toResult(
			`Current user:
Id: ${user.id}
Mention name: @${user.mention_name}
Full name: ${user.name}
`
		);
	}
}
