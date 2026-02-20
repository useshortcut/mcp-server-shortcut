import { z } from "zod";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { CustomMcpServer } from "@/mcp/CustomMcpServer";
import { BaseTools } from "./base";

export class TeamTools extends BaseTools {
	static create(client: ShortcutClientWrapper, server: CustomMcpServer) {
		const tools = new TeamTools(client);

		server.addToolWithReadAccess(
			"teams-get-by-id",
			"Get a Shortcut team by ID.",
			{
				teamPublicId: z.string().describe("Team ID"),
				full: z.boolean().optional().default(false).describe("Return all fields (default: slim)"),
			},
			async ({ teamPublicId, full }) => await tools.getTeam(teamPublicId, full),
		);

		server.addToolWithReadAccess(
			"teams-list",
			"List all Shortcut teams.",
			{
				includeArchived: z.boolean().optional().default(false).describe("Include archived teams"),
			},
			async ({ includeArchived }: { includeArchived: boolean }) =>
				await tools.getTeams(includeArchived),
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

	async getTeams(includeArchived: boolean) {
		const teams = await this.client.getTeams();

		if (!teams.length) return this.toResult(`No teams found.`);

		const filteredTeams = includeArchived ? teams : teams.filter((team) => !team.archived);

		return this.toResult(
			`Result (first ${filteredTeams.length} shown of ${filteredTeams.length} total teams found):`,
			await this.entitiesWithRelatedEntities(filteredTeams, "teams"),
		);
	}
}
