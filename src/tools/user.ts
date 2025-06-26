import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import { BaseTools } from "./base";

export class UserTools extends BaseTools {
	static create(client: ShortcutClientWrapper, server: McpServer) {
		const tools = new UserTools(client);

		server.tool(
			"get-current-user",
			"Get the current user",
			async () => await tools.getCurrentUser(),
		);

		server.tool("list-members", "Get all members", async () => await tools.listMembers());

		return tools;
	}

	async getCurrentUser() {
		const user = await this.client.getCurrentUser();

		if (!user) throw new Error("Failed to retrieve current user.");

		return this.toResult(`Current user:`, user);
	}

	async listMembers() {
		const members = await this.client.listMembers();

		return this.toResult(`Found ${members.length} members:`, members);
	}
}
