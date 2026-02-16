import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { CustomMcpServer } from "@/mcp/CustomMcpServer";
import { BaseTools } from "./base";
import { buildSearchQuery, type QueryParams } from "./utils/search";
import { date, has, is, user } from "./utils/validation";

export class EpicTools extends BaseTools {
	static create(client: ShortcutClientWrapper, server: CustomMcpServer) {
		const tools = new EpicTools(client);

		server.addToolWithReadAccess(
			"epics-get-by-id",
			"Get a Shortcut epic by public ID.",
			{
				epicPublicId: z.number().positive().describe("The public ID of the epic to get"),
				full: z
					.boolean()
					.optional()
					.default(false)
					.describe(
						"True to return all epic fields from the API. False to return a slim version that excludes uncommon fields",
					),
			},
			async ({ epicPublicId, full }) => await tools.getEpic(epicPublicId, full),
		);

		server.addToolWithReadAccess(
			"epics-search",
			"Find Shortcut epics.",
			{
				nextPageToken: z
					.string()
					.optional()
					.describe(
						"If a next_page_token was returned from the search result, pass it in to get the next page of results.  Should be combined with the original search parameters.",
					),
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
				created: date(),
				updated: date(),
				completed: date(),
				due: date(),
			},
			async ({ nextPageToken, ...params }) => await tools.searchEpics(params, nextPageToken),
		);

		server.addToolWithWriteAccess(
			"epics-create",
			"Create a new Shortcut epic.",
			{
				name: z.string().describe("The name of the epic"),
				owner: z.string().optional().describe("The user ID of the owner of the epic"),
				description: z.string().optional().describe("A description of the epic"),
				teamId: z.string().optional().describe("The ID of a team to assign the epic to"),
			},
			async (params) => await tools.createEpic(params),
		);

		server.addToolWithWriteAccess(
			"epics-update",
			"Update an existing Shortcut epic. Only provide fields you want to update.",
			{
				epicPublicId: z.number().positive().describe("The public ID of the epic to update"),
				name: z.string().max(256).optional().describe("The name of the epic"),
				description: z.string().max(100000).optional().describe("The description of the epic"),
				state: z
					.enum(["to do", "in progress", "done"])
					.optional()
					.describe("The state of the epic (deprecated, use epic_state_id if possible)"),
				epic_state_id: z.number().optional().describe("The ID of the epic state"),
				team_id: z
					.string()
					.nullable()
					.optional()
					.describe("The team (group) UUID to assign the epic to, or null to unset"),
				owner_ids: z
					.array(z.string())
					.optional()
					.describe("Array of user UUIDs to assign as owners of the epic"),
				follower_ids: z
					.array(z.string())
					.optional()
					.describe("Array of user UUIDs to add as followers of the epic"),
				deadline: z
					.string()
					.nullable()
					.optional()
					.describe(
						"The due date in ISO 8601 datetime format (e.g., 2025-01-31T00:00:00Z), or null to unset",
					),
				planned_start_date: z
					.string()
					.nullable()
					.optional()
					.describe("The planned start date in ISO 8601 format, or null to unset"),
				archived: z.boolean().optional().describe("Whether to archive the epic"),
				labels: z
					.array(
						z.object({
							name: z.string().describe("The name of the label"),
							color: z.string().optional().describe("The color of the label"),
						}),
					)
					.optional()
					.describe("Labels to assign to the epic"),
				objective_ids: z
					.array(z.number())
					.optional()
					.describe("Array of objective IDs to associate with the epic"),
				external_id: z
					.string()
					.optional()
					.describe(
						"An external identifier for the epic (for integrations). Use empty string to clear.",
					),
			},
			async (params) => await tools.updateEpic(params),
		);

		server.addToolWithWriteAccess(
			"epics-delete",
			"Delete a Shortcut epic. This action cannot be undone.",
			{
				epicPublicId: z.number().positive().describe("The public ID of the epic to delete"),
			},
			async ({ epicPublicId }) => await tools.deleteEpic(epicPublicId),
		);

		return tools;
	}

	async searchEpics(params: QueryParams, nextToken?: string) {
		const currentUser = await this.client.getCurrentUser();
		const query = await buildSearchQuery(params, currentUser);
		const { epics, total, next_page_token } = await this.client.searchEpics(query, nextToken);

		if (!epics) throw new Error(`Failed to search for epics matching your query: "${query}"`);
		if (!epics.length) return this.toResult(`Result: No epics found.`);

		return this.toResult(
			`Result (${epics.length} shown of ${total} total epics found):`,
			await this.entitiesWithRelatedEntities(epics, "epics"),
			next_page_token,
		);
	}

	async getEpic(epicPublicId: number, full = false) {
		const epic = await this.client.getEpic(epicPublicId);

		if (!epic) throw new Error(`Failed to retrieve Shortcut epic with public ID: ${epicPublicId}`);

		return this.toResult(
			`Epic: ${epicPublicId}`,
			await this.entityWithRelatedEntities(epic, "epic", full),
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

	async updateEpic({
		epicPublicId,
		...updates
	}: {
		epicPublicId: number;
		name?: string;
		description?: string;
		state?: "to do" | "in progress" | "done";
		epic_state_id?: number;
		team_id?: string | null;
		owner_ids?: string[];
		follower_ids?: string[];
		deadline?: string | null;
		planned_start_date?: string | null;
		archived?: boolean;
		labels?: Array<{ name: string; color?: string }>;
		objective_ids?: number[];
		external_id?: string;
	}): Promise<CallToolResult> {
		const epic = await this.client.getEpic(epicPublicId);
		if (!epic) throw new Error(`Failed to retrieve Shortcut epic with public ID: ${epicPublicId}`);

		// Build update params, mapping API field names where they differ
		const updateParams: Record<string, unknown> = {};
		if (updates.name !== undefined) updateParams.name = updates.name;
		if (updates.description !== undefined) updateParams.description = updates.description;
		if (updates.state !== undefined) updateParams.state = updates.state;
		if (updates.epic_state_id !== undefined) updateParams.epic_state_id = updates.epic_state_id;
		if (updates.team_id !== undefined) updateParams.group_id = updates.team_id;
		if (updates.owner_ids !== undefined) updateParams.owner_ids = updates.owner_ids;
		if (updates.follower_ids !== undefined) updateParams.follower_ids = updates.follower_ids;
		if (updates.deadline !== undefined) updateParams.deadline = updates.deadline;
		if (updates.planned_start_date !== undefined)
			updateParams.planned_start_date = updates.planned_start_date;
		if (updates.archived !== undefined) updateParams.archived = updates.archived;
		if (updates.labels !== undefined) updateParams.labels = updates.labels;
		if (updates.objective_ids !== undefined) updateParams.objective_ids = updates.objective_ids;
		if (updates.external_id !== undefined) updateParams.external_id = updates.external_id;

		const updatedEpic = await this.client.updateEpic(epicPublicId, updateParams);

		return this.toResult(`Updated epic ${epicPublicId}. Epic URL: ${updatedEpic.app_url}`);
	}

	async deleteEpic(epicPublicId: number): Promise<CallToolResult> {
		const epic = await this.client.getEpic(epicPublicId);
		if (!epic) throw new Error(`Failed to retrieve Shortcut epic with public ID: ${epicPublicId}`);

		await this.client.deleteEpic(epicPublicId);

		return this.toResult(`Deleted epic ${epicPublicId}.`);
	}
}
