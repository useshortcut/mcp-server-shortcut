import { z } from "zod";
import type { ShortcutClient } from "../shortcut-client";
import { formatMemberList, formatWorkflowList, toResult } from "./utils";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export class TeamTools {
	static create(client: ShortcutClient, server: McpServer) {
		const tools = new TeamTools(client);

		server.tool(
			"get-team",
			"Get a Shortcut team by public ID",
			{ teamPublicId: z.string().describe("The public ID of the team to get") },
			async ({ teamPublicId }) => await tools.getTeam(teamPublicId),
		);

		server.tool(
			"list-teams",
			"List all Shortcut teams",
			async () => await tools.listTeams(),
		);

		return tools;
	}

	private client: ShortcutClient;

	constructor(client: ShortcutClient) {
		this.client = client;
	}

	async getTeam(teamPublicId: string) {
		const team = await this.client.getTeam(teamPublicId);

		if (!team) return toResult(`Team with public ID: ${teamPublicId} not found.`);

		const users = await this.client.getUserMap(team.member_ids)

		return toResult(`Team with id: ${team.id}
Name: ${team.name}
Description: ${team.description}
Members:
${formatMemberList(team.member_ids, users)}
`);
	}

	async listTeams() {
		const teams = await this.client.listTeams();

		if (!teams.length) return toResult(`No teams found.`);

		const workflows = await this.client.getWorkflowMap(teams.flatMap((team) => team.workflow_ids));

		return toResult(`Result (first ${teams.length} shown of ${teams.length} total teams found):
${teams.map((team) => `Team with id: ${team.id}
Name: ${team.name}
Description: ${team.description}
Number of Members: ${team.member_ids.length}
Workflows: 
${formatWorkflowList(team.workflow_ids, workflows)}
`).join("\n\n")}`);
	}
}
