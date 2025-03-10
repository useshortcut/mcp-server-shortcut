import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ShortcutClient } from "../shortcut-client";
import { formatMemberList, formatStoryList, toResult } from "./utils";
import { z } from "zod";

export class StoryTools {
	static create(client: ShortcutClient, server: McpServer) {
		const tools = new StoryTools(client);

		server.tool(
			"get-story",
			"Get a Shortcut story by public ID",
			{ storyPublicId: z.number().positive().describe("The public ID of the story to get") },
			async ({ storyPublicId }) => await tools.getStory(storyPublicId),
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
- has:owner: Find stories with an owner. The value should be the user's mention name.
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
- owner: The owner of the story. The value should be the user's mention name. E.g. "owner:andreas".
- requester: The requester of the story. The value should be the user's mention name. E.g. "requester:andreas".
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
			async ({ query }) => await tools.searchStories(query),
		);

		server.tool(
			"create-story",
			`Create a new Shortcut story. 
Name and Workflow are required. If a team is specified, the workflow is optional, and we will use the default workflow for that team instead.
The story will be added to the default state for the workflow.
`,
			{
				name: z.string().min(1).max(512).describe("The name of the story"),
				description: z.string().max(10_000).optional().describe("The description of the story"),
				type: z
					.enum(["feature", "bug", "chore"])
					.default("feature")
					.describe("The type of the story"),
				owner: z.string().optional().describe("The user id of the owner of the story"),
				epic: z.number().optional().describe("The epic id of the epic the story belongs to"),
				team: z.string().optional().describe("The team id of the team the story belongs to"),
				workflow: z
					.number()
					.optional()
					.describe("The workflow to add the story to. Required unless a team is specified."),
			},
			async ({ name, description, type, owner, epic, team, workflow }) =>
				await tools.createStory({ name, description, type, owner, epic, team, workflow }),
		);

		server.tool(
			"assign-current-user-as-owner",
			"Assign the current user as the owner of a story",
			{ storyPublicId: z.number().positive().describe("The public ID of the story") },
			async ({ storyPublicId }) => await tools.assignCurrentUserAsOwner(storyPublicId),
		);

		server.tool(
			"unassign-current-user-as-owner",
			"Unassign the current user as the owner of a story",
			{ storyPublicId: z.number().positive().describe("The public ID of the story") },
			async ({ storyPublicId }) => await tools.unassignCurrentUserAsOwner(storyPublicId),
		);

		return tools;
	}

	private client: ShortcutClient;

	constructor(client: ShortcutClient) {
		this.client = client;
	}

	async assignCurrentUserAsOwner(storyPublicId: number) {
		const story = await this.client.getStory(storyPublicId);

		if (!story)
			throw new Error(`Failed to retrieve Shortcut story with public ID: ${storyPublicId}`);

		const currentUser = await this.client.getCurrentUser();

		if (!currentUser) throw new Error("Failed to retrieve current user");

		if (story.owner_ids.includes(currentUser.id))
			return toResult(`Current user is already an owner of story sc-${storyPublicId}`);

		await this.client.updateStory(storyPublicId, {
			owner_ids: story.owner_ids.concat([currentUser.id]),
		});

		return toResult(`Assigned current user as owner of story sc-${storyPublicId}`);
	}

	async unassignCurrentUserAsOwner(storyPublicId: number) {
		const story = await this.client.getStory(storyPublicId);

		if (!story)
			throw new Error(`Failed to retrieve Shortcut story with public ID: ${storyPublicId}`);

		const currentUser = await this.client.getCurrentUser();

		if (!currentUser) throw new Error("Failed to retrieve current user");

		if (!story.owner_ids.includes(currentUser.id))
			return toResult(`Current user is not an owner of story sc-${storyPublicId}`);

		await this.client.updateStory(storyPublicId, {
			owner_ids: story.owner_ids.filter((ownerId) => ownerId !== currentUser.id),
		});

		return toResult(`Unassigned current user as owner of story sc-${storyPublicId}`);
	}

	async createStory({
		name,
		description,
		type,
		owner,
		epic,
		team,
		workflow,
	}: {
		name: string;
		description?: string;
		type: "feature" | "bug" | "chore";
		owner?: string;
		epic?: number;
		team?: string;
		workflow?: number;
	}) {
		if (!workflow && !team) throw new Error("Team or Workflow has to be specified");

		if (!workflow && team) {
			const fullTeam = await this.client.getTeam(team);
			workflow = fullTeam?.workflow_ids?.[0];
		}

		if (!workflow) throw new Error("Failed to find workflow for team");

		const fullWorkflow = await this.client.getWorkflow(workflow);
		if (!fullWorkflow) throw new Error("Failed to find workflow");

		const story = await this.client.createStory({
			name,
			description,
			story_type: type,
			owner_ids: owner ? [owner] : [],
			epic_id: epic,
			group_id: team,
			workflow_state_id: fullWorkflow.default_state_id,
		});

		return toResult(`Created story: ${story.id}`);
	}

	async searchStories(query: string) {
		const { stories, total } = await this.client.searchStories(query);

		if (!stories) throw new Error(`Failed to search for stories matching your query: "${query}".`);
		if (!stories.length) return toResult(`Result: No stories found.`);

		const users = await this.client.getUserMap(stories.flatMap((story) => story.owner_ids));

		return toResult(`Result (first ${stories.length} shown of ${total} total stories found):
${formatStoryList(stories, users)}`);
	}

	async getStory(storyPublicId: number) {
		const story = await this.client.getStory(storyPublicId);

		if (!story)
			throw new Error(`Failed to retrieve Shortcut story with public ID: ${storyPublicId}.`);

		const owners = await this.client.getUserMap(story.owner_ids);

		return toResult(`Story: sc-${storyPublicId}
URL: ${story.app_url}
Name: ${story.name}
Type: ${story.story_type}
Archived: ${story.archived ? "Yes" : "No"}
Completed: ${story.completed ? "Yes" : "No"}
Started: ${story.started ? "Yes" : "No"}
Blocked: ${story.blocked ? "Yes" : "No"}
Blocking: ${story.blocker ? "Yes" : "No"}
Due date: ${story.deadline}
Owners: 
${formatMemberList(story.owner_ids, owners)}

Description:
${story.description}

Comments:
${(story.comments || []).map((comment) => `- From: ${comment.author_id} on ${comment.created_at}.\n${comment.text || ""}`).join("\n\n")}
`);
	}
}
