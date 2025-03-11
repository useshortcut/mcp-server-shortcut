import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ShortcutClient } from "../shortcut-client";
import { toResult } from "./utils";
import { z } from "zod";
import { date, is, has, user } from "./validation";
import { buildSearchQuery, type QueryParams } from "./search";

export class ObjectiveTools {
	static create(client: ShortcutClient, server: McpServer) {
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

	private client: ShortcutClient;

	constructor(client: ShortcutClient) {
		this.client = client;
	}

	async searchObjectives(params: QueryParams) {
		const currentUser = await this.client.getCurrentUser();
		const query = await buildSearchQuery(params, currentUser);
		const { milestones, total } = await this.client.searchMilestones(query);

		if (!milestones)
			throw new Error(`Failed to search for milestones matching your query: "${query}"`);
		if (!milestones.length) return toResult(`Result: No milestones found.`);

		return toResult(`Result (first ${milestones.length} shown of ${total} total milestones found):
${milestones.map((milestone) => `- ${milestone.id}: ${milestone.name}`).join("\n")}`);
	}

	async getObjective(objectivePublicId: number) {
		const objective = await this.client.getMilestone(objectivePublicId);

		if (!objective)
			throw new Error(`Failed to retrieve Shortcut objective with public ID: ${objectivePublicId}`);

		return toResult(`Objective: ${objectivePublicId}
Url: ${objective.app_url}
Name: ${objective.name}
Archived: ${objective.archived ? "Yes" : "No"}
Completed: ${objective.completed ? "Yes" : "No"}
Started: ${objective.started ? "Yes" : "No"}

Description:
${objective.description}
`);
	}
}
