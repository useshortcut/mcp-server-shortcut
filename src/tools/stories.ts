import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MemberInfo, Story } from "@shortcut/client";
import { z } from "zod";
import { BaseTools } from "./base";
import { formatStory, formatStoryList } from "./utils/format";
import { type QueryParams, buildSearchQuery } from "./utils/search";
import { date, has, is, user } from "./utils/validation";

export class StoryTools extends BaseTools {
	static create(client: ShortcutClientWrapper, server: McpServer) {
		const tools = new StoryTools(client);

		server.tool(
			"get-story-branch-name",
			"Get a valid branch name for a specific story.",
			{
				storyPublicId: z.number().positive().describe("The public Id of the story"),
			},
			async ({ storyPublicId }) => await tools.getStoryBranchName(storyPublicId),
		);

		server.tool(
			"get-story",
			"Get a Shortcut story by public ID",
			{
				storyPublicId: z.number().positive().describe("The public ID of the story to get"),
			},
			async ({ storyPublicId }) => await tools.getStory(storyPublicId),
		);

		server.tool(
			"search-stories",
			"Find Shortcut stories.",
			{
				id: z.number().optional().describe("Find only stories with the specified public ID"),
				name: z.string().optional().describe("Find only stories matching the specified name"),
				description: z
					.string()
					.optional()
					.describe("Find only stories matching the specified description"),
				comment: z.string().optional().describe("Find only stories matching the specified comment"),
				type: z
					.enum(["feature", "bug", "chore"])
					.optional()
					.describe("Find only stories of the specified type"),
				estimate: z
					.number()
					.optional()
					.describe("Find only stories matching the specified estimate"),
				branch: z.string().optional().describe("Find only stories matching the specified branch"),
				commit: z.string().optional().describe("Find only stories matching the specified commit"),
				pr: z.number().optional().describe("Find only stories matching the specified pull request"),
				project: z.number().optional().describe("Find only stories matching the specified project"),
				epic: z.number().optional().describe("Find only stories matching the specified epic"),
				objective: z
					.number()
					.optional()
					.describe("Find only stories matching the specified objective"),
				state: z.string().optional().describe("Find only stories matching the specified state"),
				label: z.string().optional().describe("Find only stories matching the specified label"),
				owner: user("owner"),
				requester: user("requester"),
				team: z
					.string()
					.optional()
					.describe(
						"Find only stories matching the specified team. This can be a team mention name or team name.",
					),
				skillSet: z
					.string()
					.optional()
					.describe("Find only stories matching the specified skill set"),
				productArea: z
					.string()
					.optional()
					.describe("Find only stories matching the specified product area"),
				technicalArea: z
					.string()
					.optional()
					.describe("Find only stories matching the specified technical area"),
				priority: z
					.string()
					.optional()
					.describe("Find only stories matching the specified priority"),
				severity: z
					.string()
					.optional()
					.describe("Find only stories matching the specified severity"),
				isDone: is("completed"),
				isStarted: is("started"),
				isUnstarted: is("unstarted"),
				isUnestimated: is("unestimated"),
				isOverdue: is("overdue"),
				isArchived: is("archived").default(false),
				isBlocker: is("blocking"),
				isBlocked: is("blocked"),
				hasComment: has("a comment"),
				hasLabel: has("a label"),
				hasDeadline: has("a deadline"),
				hasOwner: has("an owner"),
				hasPr: has("a pr"),
				hasCommit: has("a commit"),
				hasBranch: has("a branch"),
				hasEpic: has("an epic"),
				hasTask: has("a task"),
				hasAttachment: has("an attachment"),
				created: date,
				updated: date,
				completed: date,
				due: date,
			},
			async (params) => await tools.searchStories(params),
		);

		server.tool(
			"create-story",
			`Create a new Shortcut story. 
Name is required, and either a Team or Workflow must be specified:
- If only Team is specified, we will use the default workflow for that team.
- If Workflow is specified, it will be used regardless of Team.
The story will be added to the default state for the workflow.
`,
			{
				name: z.string().min(1).max(512).describe("The name of the story. Required."),
				description: z.string().max(10_000).optional().describe("The description of the story"),
				type: z
					.enum(["feature", "bug", "chore"])
					.default("feature")
					.describe("The type of the story"),
				owner: z.string().optional().describe("The user id of the owner of the story"),
				epic: z.number().optional().describe("The epic id of the epic the story belongs to"),
				team: z
					.string()
					.optional()
					.describe(
						"The team ID or mention name of the team the story belongs to. Required unless a workflow is specified.",
					),
				workflow: z
					.number()
					.optional()
					.describe("The workflow ID to add the story to. Required unless a team is specified."),
			},
			async ({ name, description, type, owner, epic, team, workflow }) =>
				await tools.createStory({
					name,
					description,
					type,
					owner,
					epic,
					team,
					workflow,
				}),
		);

		server.tool(
			"update-story",
			"Update an existing Shortcut story. Only provide fields you want to update. The story public ID will always be included in updates.",
			{
				storyPublicId: z.number().positive().describe("The public ID of the story to update"),
				name: z.string().max(512).optional().describe("The name of the story"),
				description: z.string().max(10_000).optional().describe("The description of the story"),
				type: z.enum(["feature", "bug", "chore"]).optional().describe("The type of the story"),
				epic: z
					.number()
					.nullable()
					.optional()
					.describe("The epic id of the epic the story belongs to, or null to unset"),
				estimate: z
					.number()
					.nullable()
					.optional()
					.describe("The point estimate of the story, or null to unset"),
				owner_ids: z
					.array(z.string())
					.optional()
					.describe("Array of user UUIDs to assign as owners of the story"),
				workflow_state_id: z
					.number()
					.optional()
					.describe("The workflow state ID to move the story to"),
				labels: z
					.array(
						z.object({
							name: z.string().describe("The name of the label"),
							color: z.string().optional().describe("The color of the label"),
							description: z.string().optional().describe("The description of the label"),
						}),
					)
					.optional()
					.describe("Labels to assign to the story"),
			},
			async (params) => await tools.updateStory(params),
		);

		server.tool(
			"assign-current-user-as-owner",
			"Assign the current user as the owner of a story",
			{
				storyPublicId: z.number().positive().describe("The public ID of the story"),
			},
			async ({ storyPublicId }) => await tools.assignCurrentUserAsOwner(storyPublicId),
		);

		server.tool(
			"unassign-current-user-as-owner",
			"Unassign the current user as the owner of a story",
			{
				storyPublicId: z.number().positive().describe("The public ID of the story"),
			},
			async ({ storyPublicId }) => await tools.unassignCurrentUserAsOwner(storyPublicId),
		);

		server.tool(
			"create-story-comment",
			"Create a comment on a story",
			{
				storyPublicId: z.number().positive().describe("The public ID of the story"),
				text: z.string().min(1).describe("The text of the comment"),
			},
			async (params) => await tools.createStoryComment(params),
		);

		return tools;
	}

	async assignCurrentUserAsOwner(storyPublicId: number) {
		const story = await this.client.getStory(storyPublicId);

		if (!story)
			throw new Error(`Failed to retrieve Shortcut story with public ID: ${storyPublicId}`);

		const currentUser = await this.client.getCurrentUser();

		if (!currentUser) throw new Error("Failed to retrieve current user");

		if (story.owner_ids.includes(currentUser.id))
			return this.toResult(`Current user is already an owner of story sc-${storyPublicId}`);

		await this.client.updateStory(storyPublicId, {
			owner_ids: story.owner_ids.concat([currentUser.id]),
		});

		return this.toResult(`Assigned current user as owner of story sc-${storyPublicId}`);
	}

	async unassignCurrentUserAsOwner(storyPublicId: number) {
		const story = await this.client.getStory(storyPublicId);

		if (!story)
			throw new Error(`Failed to retrieve Shortcut story with public ID: ${storyPublicId}`);

		const currentUser = await this.client.getCurrentUser();

		if (!currentUser) throw new Error("Failed to retrieve current user");

		if (!story.owner_ids.includes(currentUser.id))
			return this.toResult(`Current user is not an owner of story sc-${storyPublicId}`);

		await this.client.updateStory(storyPublicId, {
			owner_ids: story.owner_ids.filter((ownerId) => ownerId !== currentUser.id),
		});

		return this.toResult(`Unassigned current user as owner of story sc-${storyPublicId}`);
	}

	private createBranchName(currentUser: MemberInfo, story: Story) {
		return `${currentUser.mention_name}/sc-${story.id}/${story.name
			.toLowerCase()
			.replace(/\s+/g, "-")
			.replace(/[^\w\-]/g, "")}`.substring(0, 50);
	}

	async getStoryBranchName(storyPublicId: number) {
		const currentUser = await this.client.getCurrentUser();
		if (!currentUser) throw new Error("Unable to find current user");

		const story = await this.client.getStory(storyPublicId);

		if (!story)
			throw new Error(`Failed to retrieve Shortcut story with public ID: ${storyPublicId}`);

		const branchName =
			(story as Story & { formatted_vcs_branch_name: string | null }).formatted_vcs_branch_name ||
			this.createBranchName(currentUser, story);
		return this.toResult(`Branch name for story sc-${storyPublicId}: ${branchName}`);
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

		return this.toResult(`Created story: ${story.id}`);
	}

	async searchStories(params: QueryParams) {
		const currentUser = await this.client.getCurrentUser();
		const query = await buildSearchQuery(params, currentUser);
		const { stories, total } = await this.client.searchStories(query);

		if (!stories) throw new Error(`Failed to search for stories matching your query: "${query}".`);
		if (!stories.length) return this.toResult(`Result: No stories found.`);

		const users = await this.client.getUserMap(stories.flatMap((story) => story.owner_ids));

		return this.toResult(`Result (first ${stories.length} shown of ${total} total stories found):
${formatStoryList(stories, users)}`);
	}

	async getStory(storyPublicId: number) {
		const story = await this.client.getStory(storyPublicId);

		if (!story)
			throw new Error(`Failed to retrieve Shortcut story with public ID: ${storyPublicId}.`);

		const relatedUsers = new Set([
			...story.owner_ids,
			...story.comments.flatMap((c) => c.author_id),
		]);
		const users = await this.client.getUserMap(
			[...relatedUsers].filter((id): id is string => !!id),
		);

		return this.toResult(formatStory(story, users, true));
	}

	async createStoryComment({
		storyPublicId,
		text,
	}: {
		storyPublicId: number;
		text: string;
	}) {
		if (!storyPublicId) throw new Error("Story public ID is required");
		if (!text) throw new Error("Story comment text is required");

		const story = await this.client.getStory(storyPublicId);
		if (!story)
			throw new Error(`Failed to retrieve Shortcut story with public ID: ${storyPublicId}`);

		const storyComment = await this.client.createStoryComment(storyPublicId, { text });

		return this.toResult(
			`Created comment on story sc-${storyPublicId}. Comment URL: ${storyComment.app_url}.`,
		);
	}

	async updateStory({
		storyPublicId,
		...updates
	}: {
		storyPublicId: number;
		name?: string;
		description?: string;
		type?: "feature" | "bug" | "chore";
		epic?: number | null;
		estimate?: number | null;
		owner_ids?: string[];
		workflow_state_id?: number;
		labels?: Array<{
			name: string;
			color?: string;
			description?: string;
		}>;
	}) {
		if (!storyPublicId) throw new Error("Story public ID is required");

		// Verify the story exists
		const story = await this.client.getStory(storyPublicId);
		if (!story)
			throw new Error(`Failed to retrieve Shortcut story with public ID: ${storyPublicId}`);

		// Convert API parameters
		const updateParams: Record<string, unknown> = {};

		if (updates.name !== undefined) updateParams.name = updates.name;
		if (updates.description !== undefined) updateParams.description = updates.description;
		if (updates.type !== undefined) updateParams.story_type = updates.type;
		if (updates.epic !== undefined) updateParams.epic_id = updates.epic;
		if (updates.estimate !== undefined) updateParams.estimate = updates.estimate;
		if (updates.owner_ids !== undefined) updateParams.owner_ids = updates.owner_ids;
		if (updates.workflow_state_id !== undefined)
			updateParams.workflow_state_id = updates.workflow_state_id;
		if (updates.labels !== undefined) updateParams.labels = updates.labels;

		// Update the story
		const updatedStory = await this.client.updateStory(storyPublicId, updateParams);

		return this.toResult(`Updated story sc-${storyPublicId}. Story URL: ${updatedStory.app_url}`);
	}
}
