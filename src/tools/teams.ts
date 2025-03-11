import { z } from "zod";
import type { ShortcutClient } from "../shortcut-client";
import { formatMemberList, formatWorkflowList } from "./utils/format";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BaseTools } from "./base";

export class TeamTools extends BaseTools {
	static create(client: ShortcutClient, server: McpServer) {
		const tools = new TeamTools(client);

		server.tool(
			"get-team",
			"Get a Shortcut team by public ID",
			{ teamPublicId: z.string().describe("The public ID of the team to get") },
			async ({ teamPublicId }) => await tools.getTeam(teamPublicId),
		);

		server.tool("list-teams", "List all Shortcut teams", async () => await tools.listTeams());

		return tools;
	}

	async getTeam(teamPublicId: string) {
		const team = await this.client.getTeam(teamPublicId);

		if (!team) return this.toResult(`Team with public ID: ${teamPublicId} not found.`);

		const users = await this.client.getUserMap(team.member_ids);

		return this.toResult(`Team with id: ${team.id}
Name: ${team.name}
Mention name: ${team.mention_name}
Description: ${team.description}
Members:
${formatMemberList(team.member_ids, users)}
`);
	}

	async listTeams() {
		const teams = await this.client.listTeams();

		if (!teams.length) return this.toResult(`No teams found.`);

		const workflows = await this.client.getWorkflowMap(teams.flatMap((team) => team.workflow_ids));

		return this.toResult(`Result (first ${teams.length} shown of ${teams.length} total teams found):
${teams
	.map(
		(team) => `Team with id: ${team.id}
Name: ${team.name}
Description: ${team.description}
Number of Members: ${team.member_ids.length}
Workflows:
${formatWorkflowList(team.workflow_ids, workflows)}
`,
	)
	.join("\n\n")}`);
	}
}
