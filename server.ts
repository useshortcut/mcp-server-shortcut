import { name, version } from "./package.json";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ShortcutMcpClient } from "./shortcut-mcp-client";

if (!process.env.SHORTCUT_API_TOKEN) {
	console.error("SHORTCUT_API_TOKEN is required");
	process.exit(1);
}

const server = new McpServer({ name, version });
const client = new ShortcutMcpClient(process.env.SHORTCUT_API_TOKEN);

server.tool("get-current-user", "Get the current user", async () => await client.getCurrentUser());

server.tool(
	"get-story",
	"Get a Shortcut story by public ID",
	{ storyPublicId: z.number().positive().describe("The public ID of the story to get") },
	async ({ storyPublicId }) => await client.getStory(storyPublicId),
);

server.tool(
	"search-stories",
	`Find Shortcut stories. 

A number of search operators are available. 
Search operators can be negated by prefixing the operator with a "!". Example: "!type:bug" or "!is:archived".

Some operators are on/off, meaning you can't supply a value:

- has:attachment: Find stories with attachments
- has:task: Find stories with tasks
- has:epic: Find stories with epics
- has:branch: Find stories with associated git branches
- has:commit: Find stories with associated git commits
- has:pr: Find stories with associated git pull requests
- has:owner: Find stories with an owner
- has:deadline: Find stories with a deadline
- has:label: Find stories with a label
- has:comment: Find stories with comments
- is:blocked: Find stories that are blocked
- is:blocker: Find stories that are blocking
- is:archived: Find stories that are archived
- is:overdue: Find stories that are overdue
- is:unestimated: Find stories that are unestimated
- is:unstarted: Find stories that are unstarted
- is:started: Find stories that are started
- is:done: Find stories that are completed

Other operators allow you to search on a specific field by supplying a value. 
These operators are used by prefixing the search with the operator name. Example: "type:bug".
Note that values containing spaces have to be wrapped in quotation marks. Example: "title:\"my story\"".

Available operators are:
- id: The public ID of the story (e.g. "id:1234567").
- title: The name of the story (e.g. "title:\"my story\"").
- description: The description of the story (e.g. "description:\"my story\"").
- comment: The comment of the story (e.g. "comment:\"my story\"").
- type: The type of the story ("bug", "feature", or "chore") (e.g. "type:bug").
- estimate: The numeric estimate of the story (e.g. "estimate:1")
- branch: The git branch associated with the story (e.g. "branch:main").
- commit: The git commit associated with the story (e.g. "commit:1234567").
- pr: The git pull request associated with the story (e.g. "pr:1234567").
- project: The project associated with the story (e.g. "project:react").
- epic: The epic associated with the story (e.g. "epic:\"my epic\"").
- objective: The objective associated with the story (e.g. "objective:\"my objective\"").
- state: The state of the story (e.g. "state:\"in progress\"").
- label: The label associated with the story (e.g. "label:\"my label\"").
- owner: The owner of the story (e.g. "owner:andreas").
- requester: The requester of the story (e.g. "requester:andreas").
- team: The team of the story (e.g. "team:Engineering").
- skill-set: The skill set of the story (e.g. "skill-set:\"my skill set\"").
- product-area: The product area of the story (e.g. "product-area:\"my product area\"").
- technical-area: The technical area of the story (e.g. "technical-area:\"my technical area\"").
- priority: The priority of the story (e.g. "priority:high").
- severity: The severity of the story (e.g. "severity:sev-1").

Dates and date ranges can also be used when searching.
For dates, use the format "YYYY-MM-DD" (e.g. "2023-01-01").
For date ranges, use the format "YYYY-MM-DD..YYYY-MM-DD" (e.g. "2023-01-01..2023-01-02").
Either side of the range can be replaced with "*" to represent an open range. (e.g. "*..2023-01-02" or "2023-01-01..*").
Keywords "yesterday", "today", and "tomorrow" can also be used. But these cannot be combined with numerical dates. (e.g. "2023-01-02..today" is not valid).

Available date operators are:
- created: The date the story was created (e.g. "created:2023-01-01").
- updated: The date the story was last updated (e.g. "updated:today").
- completed: The date the story was completed (e.g. "completed:yesterday").
- due: The date the story is due (e.g. "due:tomorrow").
`,
	{ query: z.string().describe("The query which is a combination of keywords and operators") },
	async ({ query }) => await client.searchStories(query),
);

server.tool(
	"get-iteration-stories",
	"Get stories in a specific iteration by iteration public ID",
	{ iterationPublicId: z.number().positive().describe("The public ID of the iteration") },
	async ({ iterationPublicId }) => await client.getIterationStories(iterationPublicId),
);

server.tool(
	"get-iteration",
	"Get a Shortcut iteration by public ID",
	{ iterationPublicId: z.number().positive().describe("The public ID of the iteration to get") },
	async ({ iterationPublicId }) => await client.getIteration(iterationPublicId),
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
	async ({ query }) => await client.searchIterations(query),
);

server.tool(
	"get-epic",
	"Get a Shortcut epic by public ID",
	{ epicPublicId: z.number().positive().describe("The public ID of the epic to get") },
	async ({ epicPublicId }) => await client.getEpic(epicPublicId),
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
- owner: The owner of the epic (e.g. "owner:John Doe").
- requester: The requester of the epic (e.g. "requester:johndoe").
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
	async ({ query }) => await client.searchEpics(query),
);

server.tool(
	"get-objective",
	"Get a Shortcut objective by public ID",
	{ objectivePublicId: z.number().positive().describe("The public ID of the objective to get") },
	async ({ objectivePublicId }) => await client.getObjective(objectivePublicId),
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
These operators are used by prefixing the search with the operator name. Example: "title:my-epic".
Note that values containing spaces have to be wrapped in quotation marks. Example: "title:\"my epic\"".

Available operators are:
- id: The public ID of the epic (e.g. "id:1234567").
- title: The name of the epic (e.g. "title:\"my epic\"").
- description: The description of the epic (e.g. "description:\"my epic\"").
- state: The state of the epic (e.g. "state:\"in progress\"").
- owner: The owner of the epic (e.g. "owner:John Doe").
- requester: The requester of the epic (e.g. "requester:johndoe").
- team: The team of the epic (e.g. "team:Engineering").

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
	async ({ query }) => await client.searchObjectives(query),
);

async function startServer() {
	try {
		console.log("Starting server...");
		const transport = new StdioServerTransport();
		await server.connect(transport);
		console.log("Server running!");
	} catch (error) {
		console.error("Fatal:", error);
		process.exit(1);
	}
}

startServer();
