import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { BaseTools } from "./base";
import { formatAsUnorderedList, formatStats, formatStoryList } from "./utils/format";
import { type QueryParams, buildSearchQuery } from "./utils/search";
import { date } from "./utils/validation";

export class IterationTools extends BaseTools {
	static create(client: ShortcutClientWrapper, server: McpServer) {
		const tools = new IterationTools(client);

		server.tool(
			"get-iteration-stories",
			"Get stories in a specific iteration by iteration public ID",
			{ iterationPublicId: z.number().positive().describe("The public ID of the iteration") },
			async ({ iterationPublicId }) => await tools.getIterationStories(iterationPublicId),
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

		return tools;
	}

	async getIterationStories(iterationPublicId: number) {
		const { stories } = await this.client.listIterationStories(iterationPublicId);

		if (!stories)
			throw new Error(
				`Failed to retrieve Shortcut stories in iteration with public ID: ${iterationPublicId}.`,
			);

		const owners = await this.client.getUserMap(stories.flatMap((story) => story.owner_ids));

		return this.toResult(`Result (${stories.length} stories found):
${formatStoryList(stories, owners)}`);
	}

	async searchIterations(params: QueryParams) {
		const currentUser = await this.client.getCurrentUser();
		const query = await buildSearchQuery(params, currentUser);
		const { iterations, total } = await this.client.searchIterations(query);

		if (!iterations)
			throw new Error(`Failed to search for iterations matching your query: "${query}".`);
		if (!iterations.length) return this.toResult(`Result: No iterations found.`);

		return this.toResult(`Result (first ${iterations.length} shown of ${total} total iterations found):
${formatAsUnorderedList(iterations.map((iteration) => `${iteration.id}: ${iteration.name} (Start date: ${iteration.start_date}, End date: ${iteration.end_date})`))}`);
	}

	async getIteration(iterationPublicId: number) {
		const iteration = await this.client.getIteration(iterationPublicId);

		if (!iteration)
			throw new Error(
				`Failed to retrieve Shortcut iteration with public ID: ${iterationPublicId}.`,
			);

		const currentUser = await this.client.getCurrentUser();
		const showPoints = !!currentUser?.workspace2?.estimate_scale?.length;

		return this.toResult(`Iteration: ${iterationPublicId}
Url: ${iteration.app_url}
Name: ${iteration.name}
Start date: ${iteration.start_date}
End date: ${iteration.end_date}
Completed: ${iteration.status === "completed" ? "Yes" : "No"}
Started: ${iteration.status === "started" ? "Yes" : "No"}
Team: ${iteration.group_ids?.length ? `${iteration.group_ids.join(", ")}` : "(none)"}

${formatStats(iteration.stats, showPoints)}

Description:
${iteration.description}`);
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
}
