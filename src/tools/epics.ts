import { z } from "zod";
import type { ShortcutClient } from "@/client/shortcut-client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { date, has, is, user } from "./utils/validation";
import { buildSearchQuery, type QueryParams } from "./utils/search";
import { BaseTools } from "./base";

export class EpicTools extends BaseTools {
	static create(client: ShortcutClient, server: McpServer) {
		const tools = new EpicTools(client);

		server.tool(
			"get-epic",
			"Get a Shortcut epic by public ID",
			{ epicPublicId: z.number().positive().describe("The public ID of the epic to get") },
			async ({ epicPublicId }) => await tools.getEpic(epicPublicId),
		);

		server.tool(
			"search-epics",
			"Find Shortcut epics.",
			{
				id: z.number().optional().describe("Find only epics with the specified public ID"),
				name: z.string().optional().describe("Find only epics matching the specified name"),
				description: z
					.string()
					.optional()
					.describe("Find only epics matching the specified description"),
				state: z
					.enum(["unstarted", "started", "done"])
					.optional()
					.describe("Find only epics matching the specified state"),
				objective: z
					.number()
					.optional()
					.describe("Find only epics matching the specified objective"),
				owner: user("owner"),
				requester: user("requester"),
				team: z
					.string()
					.optional()
					.describe(
						"Find only epics matching the specified team. Should be a team's mention name.",
					),
				comment: z.string().optional().describe("Find only epics matching the specified comment"),
				isUnstarted: is("unstarted"),
				isStarted: is("started"),
				isDone: is("completed"),
				isArchived: is("archived"),
				isOverdue: is("overdue"),
				hasOwner: has("an owner"),
				hasComment: has("a comment"),
				hasDeadline: has("a deadline"),
				hasLabel: has("a label"),
				created: date,
				updated: date,
				completed: date,
				due: date,
			},
			async (params) => await tools.searchEpics(params),
		);

		return tools;
	}

	async searchEpics(params: QueryParams) {
		const currentUser = await this.client.getCurrentUser();
		const query = await buildSearchQuery(params, currentUser);
		const { epics, total } = await this.client.searchEpics(query);

		if (!epics) throw new Error(`Failed to search for epics matching your query: "${query}"`);
		if (!epics.length) return this.toResult(`Result: No epics found.`);

		return this.toResult(`Result (first ${epics.length} shown of ${total} total epics found):
${epics.map((epic) => `- ${epic.id}: ${epic.name}`).join("\n")}`);
	}

	async getEpic(epicPublicId: number) {
		const epic = await this.client.getEpic(epicPublicId);

		if (!epic) throw new Error(`Failed to retrieve Shortcut epic with public ID: ${epicPublicId}`);

		return this.toResult(`Epic: ${epicPublicId}
URL: ${epic.app_url}
Name: ${epic.name}
Archived: ${epic.archived ? "Yes" : "No"}
Completed: ${epic.completed ? "Yes" : "No"}
Started: ${epic.started ? "Yes" : "No"}
Due date: ${epic.deadline}

Description:
${epic.description}
`);
	}
}
