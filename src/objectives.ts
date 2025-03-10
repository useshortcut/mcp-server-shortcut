import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ShortcutClient } from "./shortcut-client";
import { toResult } from "./utils";
import { z } from "zod";

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
			`Find Shortcut objectives. 

A number of search operators are available. 
Search operators can be negated by prefixing the operator with a "!". Example: "!is:started".

Some operators are on/off, meaning you can't supply a value:

- is:unstarted: Find objectives that are unstarted
- is:started: Find objectives that are started
- is:done: Find objectives that are completed
- has:owner: Find objectives that have an owner
- is:archived: Find objectives that are archived

Other operators allow you to search on a specific field by supplying a value. 
These operators are used by prefixing the search with the operator name. Example: "title:my-objective".
Note that values containing spaces have to be wrapped in quotation marks. Example: "title:\"my objective\"".

Available operators are:
- id: The public ID of the objective (e.g. "id:1234567").
- title: The name of the objective (e.g. "title:\"my objective\"").
- description: The description of the objective (e.g. "description:\"my objective\"").
- state: The state of the objective (e.g. "state:\"in progress\"").
- owner: The owner of the objective. Value should be the user's mention name (e.g. "owner:johndoe").
- requester: The requester of the objective. Value should be the user's mention name (e.g. "requester:johndoe").
- team: The team of the objective (e.g. "team:Engineering").

Dates and date ranges can also be used when searching.
For dates, use the format "YYYY-MM-DD" (e.g. "2023-01-01").
For date ranges, use the format "YYYY-MM-DD..YYYY-MM-DD" (e.g. "2023-01-01..2023-01-02").
Either side of the range can be replaced with "*" to represent an open range. (e.g. "*..2023-01-02" or "2023-01-01..*").
Keywords "yesterday", "today", and "tomorrow" can also be used. But these cannot be combined with numerical dates. (e.g. "2023-01-02..today" is not valid).

Available date operators are:
- created: The date the objective was created (e.g. "created:2023-01-01").
- updated: The date the objective was last updated (e.g. "updated:today").
- completed: The date the objective was completed (e.g. "completed:yesterday").
`,
			{ query: z.string().describe("The query which is a combination of keywords and operators") },
			async ({ query }) => await tools.searchObjectives(query),
		);

		return tools;
	}

	private client: ShortcutClient;

	constructor(client: ShortcutClient) {
		this.client = client;
	}

	async searchObjectives(query: string) {
		try {
			const { milestones, total } = await this.client.searchMilestones(query);

			if (!milestones)
				throw new Error(`Failed to search for milestones matching your query: "${query}"`);
			if (!milestones.length) return toResult(`Result: No milestones found.`);

			return toResult(`Result (first ${milestones.length} shown of ${total} total milestones found):
${milestones.map((milestone) => `- ${milestone.id}: ${milestone.name}`).join("\n")}`);
		} catch (err) {
			return toResult(err instanceof Error ? err.message : String(err));
		}
	}

	async getObjective(objectivePublicId: number) {
		try {
			const objective = await this.client.getMilestone(objectivePublicId);

			if (!objective)
				throw new Error(`Failed to retrieve Shortcut objective with public ID: ${objectivePublicId}`);

			return toResult(`Objective: ${objectivePublicId}
Name: ${objective.name}
Archived: ${objective.archived ? "Yes" : "No"}
Completed: ${objective.completed ? "Yes" : "No"}
Started: ${objective.started ? "Yes" : "No"}

Description:
${objective.description}
`);
		} catch (err) {
			return toResult(err instanceof Error ? err.message : String(err));
		}
	}
}
