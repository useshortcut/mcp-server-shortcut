import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
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
						"Find only epics matching the specified team. Should be a team's mention name.",
					),
				comment: z.string().optional().describe("Find only epics matching the specified comment"),
				isUnstarted: is("unstarted"),
				isStarted: is("started"),
				isDone: is("completed"),
				isArchived: is("archived").default(false),
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

		server.tool(
			"create-epic",
			"Create a new Shortcut epic.",
			{
				groupId: z.string().describe("The ID of the group or team to assign the epic to"),
				name: z.string().describe("The name of the epic"),
				description: z.string().optional().describe("The description of the epic"),
			},
			async ({ groupId, name, description }) => await tools.createEpic(groupId, name, description),
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

	/**
	 * Create a new Shortcut epic.
	 *
	 * @param groupId - The ID of the group or team to assign the epic to.
	 * @param name - The name of the epic.
	 * @param description - The description of the epic.
	 *
	 * @returns The created epic.
	 */
	async createEpic(groupId: string, name: string, description?: string): Promise<CallToolResult> {
		if (!groupId) {
			throw new Error("Group ID is required to create an epic.");
		}

		const group = await this.client.getTeam(groupId);
		if (!group) throw new Error(`Group with ID ${groupId} not found`);

		const epic = await this.client.createEpic(group.id, name, description);

		return this.toResult(`Epic created: ${epic.id}
URL: ${epic.app_url}
Name: ${epic.name}
Description: ${epic.description}`);
	}
}
