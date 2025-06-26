import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import { BaseTools } from "./base";
import { buildSearchQuery, type QueryParams } from "./utils/search";
import { date } from "./utils/validation";

export class IterationTools extends BaseTools {
	static create(client: ShortcutClientWrapper, server: McpServer) {
		const tools = new IterationTools(client);

		server.tool(
			"get-iteration-stories",
			"Get stories in a specific iteration by iteration public ID",
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

		server.tool(
			"get-iteration",
			"Get a Shortcut iteration by public ID",
			{
				iterationPublicId: z.number().positive().describe("The public ID of the iteration to get"),
			},
			async ({ iterationPublicId }) => await tools.getIteration(iterationPublicId),
		);

		server.tool(
			"search-iterations",
			"Find Shortcut iterations.",
			{
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
				created: date,
				updated: date,
				startDate: date,
				endDate: date,
			},
			async (params) => await tools.searchIterations(params),
		);

		server.tool(
			"create-iteration",
			"Create a new Shortcut iteration",
			{
				name: z.string().describe("The name of the iteration"),
				startDate: z.string().describe("The start date of the iteration in YYYY-MM-DD format"),
				endDate: z.string().describe("The end date of the iteration in YYYY-MM-DD format"),
				teamId: z.string().optional().describe("The ID of a team to assign the iteration to"),
				description: z.string().optional().describe("A description of the iteration"),
			},
			async (params) => await tools.createIteration(params),
		);

		server.tool(
			"get-active-iterations",
			"Get the active Shortcut iterations for the current user based on their team memberships",
			{
				teamId: z.string().optional().describe("The ID of a team to filter iterations by"),
			},
			async ({ teamId }) => await tools.getActiveIterations(teamId),
		);

		server.tool(
			"get-upcoming-iterations",
			"Get the upcoming Shortcut iterations for the current user based on their team memberships",
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
				`Failed to retrieve Shortcut stories in iteration with public ID: ${iterationPublicId}.`,
			);

		return this.toResult(
			`Result (${stories.length} stories found):`,
			await this.entitiesWithRelatedEntities(stories, "stories"),
		);
	}

	async searchIterations(params: QueryParams) {
		const currentUser = await this.client.getCurrentUser();
		const query = await buildSearchQuery(params, currentUser);
		const { iterations, total } = await this.client.searchIterations(query);

		if (!iterations)
			throw new Error(`Failed to search for iterations matching your query: "${query}".`);
		if (!iterations.length) return this.toResult(`Result: No iterations found.`);

		return this.toResult(
			`Result (first ${iterations.length} shown of ${total} total iterations found):`,
			await this.entitiesWithRelatedEntities(iterations, "iterations"),
		);
	}

	async getIteration(iterationPublicId: number) {
		const iteration = await this.client.getIteration(iterationPublicId);

		if (!iteration)
			throw new Error(
				`Failed to retrieve Shortcut iteration with public ID: ${iterationPublicId}.`,
			);

		return this.toResult(
			`Iteration: ${iterationPublicId}`,
			await this.entityWithRelatedEntities(iteration, "iteration"),
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
