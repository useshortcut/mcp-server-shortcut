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
				epicPublicId: z.number().positive().describe("Epic ID"),
				full: z.boolean().optional().default(false).describe("Return all fields (default: slim)"),
			},
			async ({ epicPublicId, full }) => await tools.getEpic(epicPublicId, full),
		);

		server.addToolWithReadAccess(
			"epics-search",
			"Find Shortcut epics.",
			{
				nextPageToken: z.string().optional().describe("Pagination token from previous search"),
				id: z.number().optional().describe("Epic ID"),
				name: z.string().optional().describe("Name contains"),
				description: z.string().optional().describe("Description contains"),
				state: z.enum(["unstarted", "started", "done"]).optional().describe("Epic state"),
				objective: z.number().optional().describe("Objective ID"),
				owner: user("owner"),
				requester: user("requester"),
				team: z.string().optional().describe("Team mention name"),
				comment: z.string().optional().describe("Comment contains"),
				isUnstarted: is("unstarted"),
				isStarted: is("started"),
				isDone: is("completed"),
				isArchived: is("archived").default(false),
				isOverdue: is("overdue"),
				hasOwner: has("owner"),
				hasComment: has("comment"),
				hasDeadline: has("deadline"),
				hasLabel: has("label"),
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
				name: z.string().describe("Epic name"),
				owner: z.string().optional().describe("Owner user ID"),
				description: z.string().optional().describe("Epic description"),
				teamId: z.string().optional().describe("Team ID"),
			},
			async (params) => await tools.createEpic(params),
		);

		server.addToolWithWriteAccess(
			"epics-update",
			"Update an epic. Only provide fields to update.",
			{
				epicPublicId: z.number().positive().describe("Epic ID (required)"),
				name: z.string().max(256).optional().describe("Epic name"),
				description: z.string().max(100000).optional().describe("Epic description"),
				state: z.enum(["to do", "in progress", "done"]).optional().describe("State (deprecated)"),
				epic_state_id: z.number().optional().describe("Epic state ID"),
				team_id: z.string().nullable().optional().describe("Team UUID (null to unset)"),
				owner_ids: z.array(z.string()).optional().describe("Owner user UUIDs"),
				follower_ids: z.array(z.string()).optional().describe("Follower user UUIDs"),
				deadline: z.string().nullable().optional().describe("Due date ISO 8601 (null to unset)"),
				planned_start_date: z.string().nullable().optional().describe("Start date (null to unset)"),
				archived: z.boolean().optional().describe("Archive the epic"),
				labels: z
					.array(
						z.object({
							name: z.string().describe("Label name"),
							color: z.string().optional().describe("Hex color"),
						}),
					)
					.optional()
					.describe("Labels to assign"),
				objective_ids: z.array(z.number()).optional().describe("Objective IDs"),
				external_id: z.string().optional().describe("External ID (empty to clear)"),
			},
			async (params) => await tools.updateEpic(params),
		);

		server.addToolWithWriteAccess(
			"epics-delete",
			"Delete an epic (cannot be undone).",
			{
				epicPublicId: z.number().positive().describe("Epic ID"),
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
