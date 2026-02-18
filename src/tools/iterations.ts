import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { CustomMcpServer } from "@/mcp/CustomMcpServer";
import { BaseTools } from "./base";
import { buildSearchQuery, type QueryParams } from "./utils/search";
import { date } from "./utils/validation";

export class IterationTools extends BaseTools {
	static create(client: ShortcutClientWrapper, server: CustomMcpServer) {
		const tools = new IterationTools(client);

		server.addToolWithReadAccess(
			"iterations-get-stories",
			"Get stories in a specific iteration by iteration public ID.",
			{
				iterationPublicId: z.number().positive().describe("The public ID of the iteration"),
				includeStoryDescriptions: z
					.boolean()
					.optional()
					.default(false)
					.describe(
						"Indicate whether story descriptions should be included. Including descriptions may take longer and will increase the size of the response.",
					),
			},
			async ({ iterationPublicId, includeStoryDescriptions }) =>
				await tools.getIterationStories(iterationPublicId, includeStoryDescriptions),
		);

		server.addToolWithReadAccess(
			"iterations-get-by-id",
			"Get a Shortcut iteration by public ID.",
			{
				iterationPublicId: z.number().positive().describe("The public ID of the iteration to get"),
				full: z
					.boolean()
					.optional()
					.default(false)
					.describe(
						"True to return all iteration fields from the API. False to return a slim version that excludes uncommon fields",
					),
			},
			async ({ iterationPublicId, full }) => await tools.getIteration(iterationPublicId, full),
		);

		server.addToolWithReadAccess(
			"iterations-search",
			"Find Shortcut iterations.",
			{
				nextPageToken: z
					.string()
					.optional()
					.describe(
						"If a next_page_token was returned from the search result, pass it in to get the next page of results. Should be combined with the original search parameters.",
					),
				id: z.number().optional().describe("Find only iterations with the specified public ID"),
				name: z.string().optional().describe("Find only iterations matching the specified name"),
				description: z
					.string()
					.optional()
					.describe("Find only iterations matching the specified description"),
				state: z
					.enum(["started", "unstarted", "done"])
					.optional()
					.describe("Find only iterations matching the specified state"),
				team: z
					.string()
					.optional()
					.describe(
						"Find only iterations matching the specified team. This can be a team ID or mention name.",
					),
				created: date(),
				updated: date(),
				startDate: date(),
				endDate: date(),
			},
			async ({ nextPageToken, ...params }) => await tools.searchIterations(params, nextPageToken),
		);

		server.addToolWithWriteAccess(
			"iterations-create",
			"Create a new Shortcut iteration.",
			{
				name: z.string().describe("The name of the iteration"),
				startDate: z.string().describe("The start date of the iteration in YYYY-MM-DD format"),
				endDate: z.string().describe("The end date of the iteration in YYYY-MM-DD format"),
				teamId: z.string().optional().describe("The ID of a team to assign the iteration to"),
				description: z.string().optional().describe("A description of the iteration"),
			},
			async (params) => await tools.createIteration(params),
		);

		server.addToolWithWriteAccess(
			"iterations-update",
			"Update an existing Shortcut iteration. Only provide fields you want to update. Note: iteration status (unstarted/started/done) is calculated based on dates.",
			{
				iterationPublicId: z
					.number()
					.positive()
					.describe("The public ID of the iteration to update"),
				name: z.string().max(256).optional().describe("The name of the iteration"),
				description: z.string().max(100000).optional().describe("A description of the iteration"),
				startDate: z
					.string()
					.optional()
					.describe("The start date of the iteration in YYYY-MM-DD format"),
				endDate: z
					.string()
					.optional()
					.describe("The end date of the iteration in YYYY-MM-DD format"),
				team_ids: z
					.array(z.string())
					.optional()
					.describe("Array of team (group) UUIDs to associate with the iteration"),
				follower_ids: z
					.array(z.string())
					.optional()
					.describe("Array of user UUIDs to add as followers of the iteration"),
				labels: z
					.array(
						z.object({
							name: z.string().describe("The name of the label"),
							color: z.string().optional().describe("The color of the label"),
						}),
					)
					.optional()
					.describe("Labels to assign to the iteration"),
			},
			async (params) => await tools.updateIteration(params),
		);

		server.addToolWithWriteAccess(
			"iterations-delete",
			"Delete a Shortcut iteration. This action cannot be undone. Stories in the iteration will be unassigned from it.",
			{
				iterationPublicId: z
					.number()
					.positive()
					.describe("The public ID of the iteration to delete"),
			},
			async ({ iterationPublicId }) => await tools.deleteIteration(iterationPublicId),
		);

		server.addToolWithReadAccess(
			"iterations-get-active",
			"Get the active Shortcut iterations for the current user based on their team memberships.",
			{
				teamId: z.string().optional().describe("The ID of a team to filter iterations by"),
			},
			async ({ teamId }) => await tools.getActiveIterations(teamId),
		);

		server.addToolWithReadAccess(
			"iterations-get-upcoming",
			"Get the upcoming Shortcut iterations for the current user based on their team memberships.",
			{
				teamId: z.string().optional().describe("The ID of a team to filter iterations by"),
			},
			async ({ teamId }) => await tools.getUpcomingIterations(teamId),
		);

		return tools;
	}

	async getIterationStories(iterationPublicId: number, includeDescription: boolean) {
		const { stories } = await this.client.listIterationStories(
			iterationPublicId,
			includeDescription,
		);

		if (!stories)
			throw new Error(
				`Failed to retrieve Shortcut stories in iteration with public ID: ${iterationPublicId}`,
			);

		return this.toResult(
			`Result (${stories.length} stories found):`,
			await this.entitiesWithRelatedEntities(stories, "stories"),
		);
	}

	async searchIterations(params: QueryParams, nextToken?: string) {
		const currentUser = await this.client.getCurrentUser();
		const query = await buildSearchQuery(params, currentUser);
		const { iterations, total, next_page_token } = await this.client.searchIterations(
			query,
			nextToken,
		);

		if (!iterations)
			throw new Error(`Failed to search for iterations matching your query: "${query}".`);
		if (!iterations.length) return this.toResult(`Result: No iterations found.`);

		return this.toResult(
			`Result (${iterations.length} shown of ${total} total iterations found):`,
			await this.entitiesWithRelatedEntities(iterations, "iterations"),
			next_page_token,
		);
	}

	async getIteration(iterationPublicId: number, full = false) {
		const iteration = await this.client.getIteration(iterationPublicId);

		if (!iteration)
			throw new Error(`Failed to retrieve Shortcut iteration with public ID: ${iterationPublicId}`);

		return this.toResult(
			`Iteration: ${iterationPublicId}`,
			await this.entityWithRelatedEntities(iteration, "iteration", full),
		);
	}

	async createIteration({
		name,
		startDate,
		endDate,
		teamId,
		description,
	}: {
		name: string;
		startDate: string;
		endDate: string;
		teamId?: string;
		description?: string;
	}): Promise<CallToolResult> {
		const iteration = await this.client.createIteration({
			name,
			start_date: startDate,
			end_date: endDate,
			group_ids: teamId ? [teamId] : undefined,
			description,
		});

		if (!iteration) throw new Error(`Failed to create the iteration.`);

		return this.toResult(`Iteration created with ID: ${iteration.id}.`);
	}

	async updateIteration({
		iterationPublicId,
		...updates
	}: {
		iterationPublicId: number;
		name?: string;
		description?: string;
		startDate?: string;
		endDate?: string;
		team_ids?: string[];
		follower_ids?: string[];
		labels?: Array<{ name: string; color?: string }>;
	}): Promise<CallToolResult> {
		const iteration = await this.client.getIteration(iterationPublicId);
		if (!iteration)
			throw new Error(`Failed to retrieve Shortcut iteration with public ID: ${iterationPublicId}`);

		// Build update params, mapping API field names where they differ
		const updateParams: Record<string, unknown> = {};
		if (updates.name !== undefined) updateParams.name = updates.name;
		if (updates.description !== undefined) updateParams.description = updates.description;
		if (updates.startDate !== undefined) updateParams.start_date = updates.startDate;
		if (updates.endDate !== undefined) updateParams.end_date = updates.endDate;
		if (updates.team_ids !== undefined) updateParams.group_ids = updates.team_ids;
		if (updates.follower_ids !== undefined) updateParams.follower_ids = updates.follower_ids;
		if (updates.labels !== undefined) updateParams.labels = updates.labels;

		const updatedIteration = await this.client.updateIteration(iterationPublicId, updateParams);

		return this.toResult(
			`Updated iteration ${iterationPublicId}. Iteration URL: ${updatedIteration.app_url}`,
		);
	}

	async deleteIteration(iterationPublicId: number): Promise<CallToolResult> {
		const iteration = await this.client.getIteration(iterationPublicId);
		if (!iteration)
			throw new Error(`Failed to retrieve Shortcut iteration with public ID: ${iterationPublicId}`);

		await this.client.deleteIteration(iterationPublicId);

		return this.toResult(`Deleted iteration ${iterationPublicId}.`);
	}

	async getActiveIterations(teamId?: string) {
		if (teamId) {
			const team = await this.client.getTeam(teamId);
			if (!team) throw new Error(`No team found matching id: "${teamId}"`);

			const result = await this.client.getActiveIteration([teamId]);
			const iterations = result.get(teamId);
			if (!iterations?.length) return this.toResult(`Result: No active iterations found for team.`);
			if (iterations.length === 1)
				return this.toResult(
					"The active iteration for the team is:",
					await this.entityWithRelatedEntities(iterations[0], "iteration"),
				);
			return this.toResult(
				"The active iterations for the team are:",
				await this.entitiesWithRelatedEntities(iterations, "iterations"),
			);
		}

		const currentUser = await this.client.getCurrentUser();
		if (!currentUser) throw new Error("Failed to retrieve current user.");

		const teams = await this.client.getTeams();
		const teamIds = teams
			.filter((team) => team.member_ids.includes(currentUser.id))
			.map((team) => team.id);

		if (!teamIds.length) throw new Error("Current user does not belong to any teams.");

		const resultsByTeam = await this.client.getActiveIteration(teamIds);

		const allActiveIterations = [...resultsByTeam.values()].flat();

		if (!allActiveIterations.length)
			return this.toResult("Result: No active iterations found for any of your teams.");
		return this.toResult(
			`You have ${allActiveIterations.length} active iterations for your teams:`,
			await this.entitiesWithRelatedEntities(allActiveIterations, "iterations"),
		);
	}

	async getUpcomingIterations(teamId?: string) {
		if (teamId) {
			const team = await this.client.getTeam(teamId);
			if (!team) throw new Error(`No team found matching id: "${teamId}"`);

			const result = await this.client.getUpcomingIteration([teamId]);
			const iterations = result.get(teamId);
			if (!iterations?.length)
				return this.toResult(`Result: No upcoming iterations found for team.`);
			if (iterations.length === 1)
				return this.toResult(
					"The next upcoming iteration for the team is:",
					await this.entityWithRelatedEntities(iterations[0], "iteration"),
				);
			return this.toResult(
				"The next upcoming iterations for the team are:",
				await this.entitiesWithRelatedEntities(iterations, "iterations"),
			);
		}

		const currentUser = await this.client.getCurrentUser();
		if (!currentUser) throw new Error("Failed to retrieve current user.");

		const teams = await this.client.getTeams();
		const teamIds = teams
			.filter((team) => team.member_ids.includes(currentUser.id))
			.map((team) => team.id);

		if (!teamIds.length) throw new Error("Current user does not belong to any teams.");

		const resultsByTeam = await this.client.getUpcomingIteration(teamIds);
		const allUpcomingIterations = [...resultsByTeam.values()].flat();

		if (!allUpcomingIterations.length)
			return this.toResult("Result: No upcoming iterations found for any of your teams.");
		return this.toResult(
			"The upcoming iterations for all your teams are:",
			await this.entitiesWithRelatedEntities(allUpcomingIterations, "iterations"),
		);
	}
}
