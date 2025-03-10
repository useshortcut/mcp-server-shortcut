import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ShortcutClient } from "../shortcut-client";
import { formatStoryList, toResult } from "./utils";
import { z } from "zod";

export class IterationTools {
	static create(client: ShortcutClient, server: McpServer) {
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
			`Find Shortcut iterations. 

A number of search operators are available. 
Search operators can be negated by prefixing the operator with a "!". Example: "!is:started".

Operators are used by prefixing the search with the operator name. Example: "title:my-iteration".
Note that values containing spaces have to be wrapped in quotation marks. Example: "title:\"my iteration\"").

Available operators are:
- id: The public ID of the iteration (e.g. "id:1234567").
- title: The name of the iteration (e.g. "title:\"my iteration\"").
- description: The description of the iteration (e.g. "description:\"my iteration\"").
- state: The state of the iteration (e.g. "state:\"in progress\"").
- team: The team of the iteration (e.g. "team:Engineering").

Dates and date ranges can also be used when searching.
For dates, use the format "YYYY-MM-DD" (e.g. "2023-01-01").
For date ranges, use the format "YYYY-MM-DD..YYYY-MM-DD" (e.g. "2023-01-01..2023-01-02").
Either side of the range can be replaced with "*" to represent an open range. (e.g. "*..2023-01-02" or "2023-01-01..*").
Keywords "yesterday", "today", and "tomorrow" can also be used. But these cannot be combined with numerical dates. (e.g. "2023-01-02..today" is not valid).

Available date operators are:
- created: The date the iteration was created (e.g. "created:2023-01-01").
- updated: The date the iteration was last updated (e.g. "updated:today").
- start_date: The date the iteration started (e.g. "start_date:2023-01-01").
- end_date: The date the iteration ended (e.g. "end_date:2023-01-01").
`,
			{ query: z.string().describe("The query which is a combination of keywords and operators") },
			async ({ query }) => await tools.searchIterations(query),
		);

		return tools;
	}

	private client: ShortcutClient;

	constructor(client: ShortcutClient) {
		this.client = client;
	}

	async getIterationStories(iterationPublicId: number) {
		const { stories } = await this.client.listIterationStories(iterationPublicId);

		if (!stories)
			throw new Error(
				`Failed to retrieve Shortcut stories in iteration with public ID: ${iterationPublicId}.`,
			);

		const owners = await this.client.getUserMap(stories.flatMap((story) => story.owner_ids));

		return toResult(`Result (${stories.length} stories found):
${formatStoryList(stories, owners)}`);
	}

	async searchIterations(query: string) {
		const { iterations, total } = await this.client.searchIterations(query);

		if (!iterations)
			throw new Error(`Failed to search for iterations matching your query: "${query}".`);
		if (!iterations.length) return toResult(`Result: No iterations found.`);

		return toResult(`Result (first ${iterations.length} shown of ${total} total iterations found):
${iterations.map((iteration) => `- ${iteration.id}: ${iteration.name} (Start date: ${iteration.start_date}, End date: ${iteration.end_date})`).join("\n")}`);
	}

	async getIteration(iterationPublicId: number) {
		const iteration = await this.client.getIteration(iterationPublicId);

		if (!iteration)
			throw new Error(
				`Failed to retrieve Shortcut iteration with public ID: ${iterationPublicId}.`,
			);

		return toResult(`Iteration: ${iterationPublicId}
Url: ${iteration.app_url}
Name: ${iteration.name}
Start date: ${iteration.start_date}
End date: ${iteration.end_date}
Completed: ${iteration.status === "completed" ? "Yes" : "No"}
Started: ${iteration.status === "started" ? "Yes" : "No"}

Description:
${iteration.description}
`);
	}
}
