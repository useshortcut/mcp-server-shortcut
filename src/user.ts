import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ShortcutClient } from "./shortcut-client";
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
		try {
			const user = await this.client.getCurrentUser();

			if (!user) throw new Error("Failed to retrieve current user.");

			return toResult(
				`Mention name: @${user.mention_name}, full name: ${user.name}, id: ${user.id}`,
			);
		} catch (err) {
			return toResult(err instanceof Error ? err.message : String(err));
		}
	}
}
