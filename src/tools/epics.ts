import { z } from "zod";
import type { ShortcutClient } from "../shortcut-client";
import { toResult } from "./utils";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export class EpicTools {
	static create(client: ShortcutClient, server: McpServer) {
		const tools = new EpicTools(client);

		server.tool(
			"get-epic",
			"Get a Shortcut epic by public ID",
			{ epicPublicId: z.number().positive().describe("The public ID of the epic to get") },
			async ({ epicPublicId }) => await tools.getEpic(epicPublicId),
		);

		server.tool(
			"search-epics",
			`Find Shortcut epics. 

A number of search operators are available. 
Search operators can be negated by prefixing the operator with a "!". Example: "!is:started".

Some operators are on/off, meaning you can't supply a value:

- is:unstarted: Find epics that are unstarted
- is:started: Find epics that are started
- is:done: Find epics that are completed
- has:owner: Find epics that have an owner
- has:comment: Find epics that have a comment
- has:deadline: Find epics that have a deadline
- has:label: Find epics that have a label
- is:archived: Find epics that are archived
- is:overdue: Find epics that are overdue

Other operators allow you to search on a specific field by supplying a value. 
These operators are used by prefixing the search with the operator name. Example: "title:my-epic".
Note that values containing spaces have to be wrapped in quotation marks. Example: "title:\"my epic\"".

Available operators are:
- id: The public ID of the epic (e.g. "id:1234567").
- title: The name of the epic (e.g. "title:\"my epic\"").
- description: The description of the epic (e.g. "description:\"my epic\"").
- state: The state of the epic (e.g. "state:\"in progress\"").
- objective: The objective associated with the epic (e.g. "objective:\"my objective\"").
- owner: The owner of the epic. Value should be the user's mention name (e.g. "owner:johndoe").
- requester: The requester of the epic. Value should be the user's mention name (e.g. "requester:johndoe").
- team: The team of the epic (e.g. "team:Engineering").
- comment: The comment of the epic (e.g. "comment:\"my comment\"").

Dates and date ranges can also be used when searching.
For dates, use the format "YYYY-MM-DD" (e.g. "2023-01-01").
For date ranges, use the format "YYYY-MM-DD..YYYY-MM-DD" (e.g. "2023-01-01..2023-01-02").
Either side of the range can be replaced with "*" to represent an open range. (e.g. "*..2023-01-02" or "2023-01-01..*").
Keywords "yesterday", "today", and "tomorrow" can also be used. But these cannot be combined with numerical dates. (e.g. "2023-01-02..today" is not valid).

Available date operators are:
- created: The date the epic was created (e.g. "created:2023-01-01").
- updated: The date the epic was last updated (e.g. "updated:today").
- completed: The date the epic was completed (e.g. "completed:yesterday").
- due: The date the epic is due (e.g. "due:tomorrow").
`,
			{ query: z.string().describe("The query which is a combination of keywords and operators") },
			async ({ query }) => await tools.searchEpics(query),
		);

		return tools;
	}

	private client: ShortcutClient;

	constructor(client: ShortcutClient) {
		this.client = client;
	}

	async searchEpics(query: string) {
		const { epics, total } = await this.client.searchEpics(query);

		if (!epics) throw new Error(`Failed to search for epics matching your query: "${query}"`);
		if (!epics.length) return toResult(`Result: No epics found.`);

		return toResult(`Result (first ${epics.length} shown of ${total} total epics found):
${epics.map((epic) => `- ${epic.id}: ${epic.name}`).join("\n")}`);
	}

	async getEpic(epicPublicId: number) {
		const epic = await this.client.getEpic(epicPublicId);

		if (!epic)
			throw new Error(`Failed to retrieve Shortcut epic with public ID: ${epicPublicId}`);

		return toResult(`Epic: ${epicPublicId}
URL: ${epic.app_url}
Name: ${epic.name}
Archived: ${epic.archived ? "Yes" : "No"}
Completed: ${epic.completed ? "Yes" : "No"}
Started: ${epic.started ? "Yes" : "No"}
Due date: ${epic.deadline}

Description:
${epic.description}
`);
	}
}
