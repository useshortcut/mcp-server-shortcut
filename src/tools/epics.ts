import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BaseTools } from "./base";
import { formatAsUnorderedList, formatStats } from "./utils/format";
import { type QueryParams, buildSearchQuery } from "./utils/search";
import { date, has, is, user } from "./utils/validation";

export class EpicTools extends BaseTools {
	static create(client: ShortcutClientWrapper, server: McpServer) {
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
						"Find only epics matching the specified team. Should be a team name (use quotes for names with spaces).",
					),
				comment: z.string().optional().describe("Find only epics matching the specified comment"),
				label: z.string().optional().describe("Find only epics with the specified label"),
				text: z.string().optional().describe("Search text in epic name, description, or comments"),
				isUnstarted: is("unstarted"),
				isStarted: is("started"),
				isDone: is("completed"),
				isArchived: is("archived").default(false),
				isOverdue: is("overdue"),
				hasOwner: has("an owner"),
				hasComment: has("a comment"),
				hasDeadline: has("a deadline"),
				hasLabel: has("a label"),
				hasStories: has("stories"),
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
		const query = await buildSearchQuery(params, currentUser, this.client);
		const { epics, total } = await this.client.searchEpics(query);

		if (!epics) throw new Error(`Failed to search for epics matching your query: "${query}"`);
		if (!epics.length) return this.toResult(`Result: No epics found.`);

		return this.toResult(`Result (first ${epics.length} shown of ${total} total epics found):
${formatAsUnorderedList(epics.map((epic) => `${epic.id}: ${epic.name}`))}`);
	}

	async getEpic(epicPublicId: number) {
		const epic = await this.client.getEpic(epicPublicId);

		if (!epic) throw new Error(`Failed to retrieve Shortcut epic with public ID: ${epicPublicId}`);

		const currentUser = await this.client.getCurrentUser();
		const showPoints = !!currentUser?.workspace2?.estimate_scale?.length;

		return this.toResult(`Epic: ${epicPublicId}
URL: ${epic.app_url}
Name: ${epic.name}
Archived: ${epic.archived ? "Yes" : "No"}
Completed: ${epic.completed ? "Yes" : "No"}
Started: ${epic.started ? "Yes" : "No"}
Due date: ${epic.deadline ? epic.deadline : "[Not set]"}
Team: ${epic.group_id ? `${epic.group_id}` : "[None]"}
Objective: ${epic.milestone_id ? `${epic.milestone_id}` : "[None]"}

${formatStats(epic.stats, showPoints)}

Description:
${epic.description}`);
	}
}
