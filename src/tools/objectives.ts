import { z } from "zod";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { CustomMcpServer } from "@/mcp/CustomMcpServer";
import { BaseTools } from "./base";
import { buildSearchQuery, type QueryParams } from "./utils/search";
import { date, has, is, user } from "./utils/validation";

export class ObjectiveTools extends BaseTools {
	static create(client: ShortcutClientWrapper, server: CustomMcpServer) {
		const tools = new ObjectiveTools(client);

		server.addToolWithReadAccess(
			"objectives-get-by-id",
			"Get a Shortcut objective by public ID.",
			{
				objectivePublicId: z.number().positive().describe("The public ID of the objective to get"),
				full: z
					.boolean()
					.optional()
					.default(false)
					.describe(
						"True to return all objective fields from the API. False to return a slim version that excludes uncommon fields",
					),
			},
			async ({ objectivePublicId, full }) => await tools.getObjective(objectivePublicId, full),
		);

		server.addToolWithReadAccess(
			"objectives-search",
			"Find Shortcut objectives.",
			{
				nextPageToken: z
					.string()
					.optional()
					.describe(
						"If a next_page_token was returned from the search result, pass it in to get the next page of results. Should be combined with the original search parameters.",
					),
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
				created: date(),
				updated: date(),
				completed: date(),
			},
			async ({ nextPageToken, ...params }) => await tools.searchObjectives(params, nextPageToken),
		);

		return tools;
	}

	async searchObjectives(params: QueryParams, nextToken?: string) {
		const currentUser = await this.client.getCurrentUser();
		const query = await buildSearchQuery(params, currentUser);
		const { milestones, total, next_page_token } = await this.client.searchMilestones(
			query,
			nextToken,
		);

		if (!milestones)
			throw new Error(`Failed to search for milestones matching your query: "${query}"`);
		if (!milestones.length) return this.toResult(`Result: No milestones found.`);

		return this.toResult(
			`Result (${milestones.length} shown of ${total} total milestones found):`,
			await this.entitiesWithRelatedEntities(milestones, "objectives"),
			next_page_token,
		);
	}

	async getObjective(objectivePublicId: number, full = false) {
		const objective = await this.client.getMilestone(objectivePublicId);

		if (!objective)
			throw new Error(`Failed to retrieve Shortcut objective with public ID: ${objectivePublicId}`);

		return this.toResult(
			`Objective: ${objectivePublicId}`,
			await this.entityWithRelatedEntities(objective, "objective", full),
		);
	}
}
