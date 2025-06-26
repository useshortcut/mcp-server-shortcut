import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import { BaseTools } from "./base";
import { buildSearchQuery, type QueryParams } from "./utils/search";
import { date, has, is, user } from "./utils/validation";

export class ObjectiveTools extends BaseTools {
	static create(client: ShortcutClientWrapper, server: McpServer) {
		const tools = new ObjectiveTools(client);

		server.tool(
			"get-objective",
			"Get a Shortcut objective by public ID",
			{
				objectivePublicId: z.number().positive().describe("The public ID of the objective to get"),
			},
			async ({ objectivePublicId }) => await tools.getObjective(objectivePublicId),
		);

		server.tool(
			"search-objectives",
			"Find Shortcut objectives.",
			{
				id: z.number().optional().describe("Find objectives matching the specified id"),
				name: z.string().optional().describe("Find objectives matching the specified name"),
				description: z
					.string()
					.optional()
					.describe("Find objectives matching the specified description"),
				state: z
					.enum(["unstarted", "started", "done"])
					.optional()
					.describe("Find objectives matching the specified state"),
				owner: user("owner"),
				requester: user("requester"),
				team: z
					.string()
					.optional()
					.describe("Find objectives matching the specified team. Should be a team mention name."),
				isUnstarted: is("unstarted"),
				isStarted: is("started"),
				isDone: is("completed"),
				isArchived: is("archived"),
				hasOwner: has("an owner"),
				created: date,
				updated: date,
				completed: date,
			},
			async (params) => await tools.searchObjectives(params),
		);

		return tools;
	}

	async searchObjectives(params: QueryParams) {
		const currentUser = await this.client.getCurrentUser();
		const query = await buildSearchQuery(params, currentUser);
		const { milestones, total } = await this.client.searchMilestones(query);

		if (!milestones)
			throw new Error(`Failed to search for milestones matching your query: "${query}"`);
		if (!milestones.length) return this.toResult(`Result: No milestones found.`);

		return this.toResult(
			`Result (first ${milestones.length} shown of ${total} total milestones found):`,
			await this.entitiesWithRelatedEntities(milestones, "objectives"),
		);
	}

	async getObjective(objectivePublicId: number) {
		const objective = await this.client.getMilestone(objectivePublicId);

		if (!objective)
			throw new Error(`Failed to retrieve Shortcut objective with public ID: ${objectivePublicId}`);

		return this.toResult(
			`Objective: ${objectivePublicId}`,
			await this.entityWithRelatedEntities(objective, "objective"),
		);
	}
}
