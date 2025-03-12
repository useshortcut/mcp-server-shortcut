import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ShortcutClient } from "@/client/shortcut-client";
import { BaseTools } from "./base";

export class UserTools extends BaseTools {
	static create(client: ShortcutClient, server: McpServer) {
		const tools = new UserTools(client);

		server.tool(
			"get-current-user",
			"Get the current user",
			async () => await tools.getCurrentUser(),
		);

		return tools;
	}

	async getCurrentUser() {
		const user = await this.client.getCurrentUser();

		if (!user) throw new Error("Failed to retrieve current user.");

		return this.toResult(
			`Current user:
Id: ${user.id}
Mention name: @${user.mention_name}
Full name: ${user.name}
`,
		);
	}
}
