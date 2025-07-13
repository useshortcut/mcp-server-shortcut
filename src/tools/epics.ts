import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import { BaseTools } from "./base";
import { buildSearchQuery, type QueryParams } from "./utils/search";
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
				name: z.string().describe("The name of the epic"),
				owner: z.string().optional().describe("The user ID of the owner of the epic"),
				description: z.string().optional().describe("A description of the epic"),
				teamId: z.string().optional().describe("The ID of a team to assign the epic to"),
			},
			async (params) => await tools.createEpic(params),
		);

		return tools;
	}

	async searchEpics(params: QueryParams) {
		const currentUser = await this.client.getCurrentUser();
		const query = await buildSearchQuery(params, currentUser);
		const { epics, total } = await this.client.searchEpics(query);

		if (!epics) throw new Error(`Failed to search for epics matching your query: "${query}"`);
		if (!epics.length) return this.toResult(`Result: No epics found.`);

		return this.toResult(
			`Result (first ${epics.length} shown of ${total} total epics found):`,
			await this.entitiesWithRelatedEntities(epics, "epics"),
		);
	}

	async getEpic(epicPublicId: number) {
		const epic = await this.client.getEpic(epicPublicId);

		if (!epic) throw new Error(`Failed to retrieve Shortcut epic with public ID: ${epicPublicId}`);

		return this.toResult(
			`Epic: ${epicPublicId}`,
			await this.entityWithRelatedEntities(epic, "epic"),
		);
	}

	async createEpic({
		name,
		owner,
		teamId: group_id,
		description,
	}: {
		name: string;
		owner?: string;
		teamId?: string;
		description?: string;
	}): Promise<CallToolResult> {
		const epic = await this.client.createEpic({
			name,
			group_id,
			owner_ids: owner ? [owner] : undefined,
			description,
		});

		return this.toResult(`Epic created with ID: ${epic.id}.`);
	}
}
