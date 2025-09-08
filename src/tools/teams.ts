import { z } from "zod";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { CustomMcpServer } from "@/mcp/CustomMcpServer";
import { BaseTools } from "./base";

export class TeamTools extends BaseTools {
	static create(client: ShortcutClientWrapper, server: CustomMcpServer) {
		const tools = new TeamTools(client);

		server.addToolWithReadAccess(
			"teams-get-by-id",
			"Get a Shortcut team by public ID",
			{
				teamPublicId: z.string().describe("The public ID of the team to get"),
				full: z
					.boolean()
					.optional()
					.default(false)
					.describe(
						"True to return all team fields from the API. False to return a slim version that excludes uncommon fields",
					),
			},
			async ({ teamPublicId, full }) => await tools.getTeam(teamPublicId, full),
		);

		server.addToolWithReadAccess(
			"teams-list",
			"List all Shortcut teams",
			async () => await tools.getTeams(),
		);

		return tools;
	}

	async getTeam(teamPublicId: string, full = false) {
		const team = await this.client.getTeam(teamPublicId);

		if (!team) return this.toResult(`Team with public ID: ${teamPublicId} not found.`);

		return this.toResult(
			`Team: ${team.id}`,
			await this.entityWithRelatedEntities(team, "team", full),
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
