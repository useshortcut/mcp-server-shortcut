import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BaseTools } from "./base";
import { formatMemberList, formatWorkflowList } from "./utils/format";

export class TeamTools extends BaseTools {
	static create(client: ShortcutClientWrapper, server: McpServer) {
		const tools = new TeamTools(client);

		server.tool(
			"get-team",
			"Get a Shortcut team by public ID",
			{ teamPublicId: z.string().describe("The public ID of the team to get") },
			async ({ teamPublicId }) => await tools.getTeam(teamPublicId),
		);

		server.tool("list-teams", "List all Shortcut teams", async () => await tools.getTeams());

		return tools;
	}

	async getTeam(teamPublicId: string) {
		const team = await this.client.getTeam(teamPublicId);

		if (!team) return this.toResult(`Team with public ID: ${teamPublicId} not found.`);

		const users = await this.client.getUserMap(team.member_ids);

		return this.toResult(`Id: ${team.id}
Name: ${team.name}
Mention name: ${team.mention_name}
Description: ${team.description}
${formatMemberList(team.member_ids, users)}`);
	}

	async getTeams() {
		const teams = await this.client.getTeams();

		if (!teams.length) return this.toResult(`No teams found.`);

		const workflows = await this.client.getWorkflowMap(teams.flatMap((team) => team.workflow_ids));

		return this.toResult(`Result (first ${teams.length} shown of ${teams.length} total teams found):

${teams
	.map(
		(team) => `Id: ${team.id}
Name: ${team.name}
Description: ${team.description}
Number of Members: ${team.member_ids.length}
${formatWorkflowList(team.workflow_ids, workflows)}`,
	)
	.join("\n\n")}`);
	}
}
