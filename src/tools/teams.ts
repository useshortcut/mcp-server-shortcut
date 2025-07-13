import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import { BaseTools } from "./base";

export class TeamTools extends BaseTools {
	static create(client: ShortcutClientWrapper, server: McpServer) {
		const tools = new TeamTools(client);

		server.tool(
			"get_team",
			"Get a Shortcut team by public ID",
			{ teamPublicId: z.string().describe("The public ID of the team to get") },
			async ({ teamPublicId }) => await tools.getTeam(teamPublicId),
		);

		server.tool("list_teams", "List all Shortcut teams", async () => await tools.listTeams());

		return tools;
	}

	async getTeam(teamPublicId: string) {
		const team = await this.client.getTeam(teamPublicId);

		if (!team) return this.toResult(`Team with public ID: ${teamPublicId} not found.`);

		return this.toResult(`Team: ${team.id}`, await this.entityWithRelatedEntities(team, "team"));
	}

	async listTeams() {
		const teams = await this.client.getTeams();

		if (!teams || teams.length === 0) {
			return this.toResult("No teams found.");
		}

		return this.toResult(
			`Found ${teams.length} teams:`,
			await this.entitiesWithRelatedEntities(teams, "teams"),
		);
	}

	async getTeams() {
		const teams = await this.client.getTeams();

		if (!teams.length) return this.toResult(`No teams found.`);

		return this.toResult(
			`Result (first ${teams.length} shown of ${teams.length} total teams found):`,
			await this.entitiesWithRelatedEntities(teams, "teams"),
		);
	}
}
