import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import { BaseTools } from "./base";

export class UserTools extends BaseTools {
	static create(client: ShortcutClientWrapper, server: McpServer, isReadonly = false) {
		const tools = new UserTools(client, isReadonly);

		server.tool(
			"get-current-user",
			"Get the current user",
			async () => await tools.getCurrentUser(),
		);

		server.tool(
			"get-current-user-teams",
			"Get a list of teams where the current user is a member",
			async () => await tools.getCurrentUserTeams(),
		);

		server.tool("list-users", "Get all users", async () => await tools.listMembers());

		return tools;
	}

	async getCurrentUser() {
		const user = await this.client.getCurrentUser();

		if (!user) throw new Error("Failed to retrieve current user.");

		return this.toResult(`Current user:`, user);
	}

	async getCurrentUserTeams() {
		const teams = await this.client.getTeams();
		const currentUser = await this.client.getCurrentUser();

		if (!currentUser) throw new Error("Failed to get current user.");

		const userTeams = teams.filter(
			(team) => !team.archived && team.member_ids.includes(currentUser.id),
		);
		if (!userTeams.length) return this.toResult(`Current user is not a member of any teams.`);

		if (userTeams.length === 1) {
			const team = userTeams[0];
			return this.toResult(
				`Current user is a member of team "${team.name}":`,
				await this.entityWithRelatedEntities(team, "team"),
			);
		}

		return this.toResult(
			`Current user is a member of ${userTeams.length} teams:`,
			await this.entitiesWithRelatedEntities(userTeams, "teams"),
		);
	}

	async listMembers() {
		const members = await this.client.listMembers();

		return this.toResult(`Found ${members.length} members:`, members);
	}
}
