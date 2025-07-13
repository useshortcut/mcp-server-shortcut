import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MemberInfo, Story } from "@shortcut/client";
import { z } from "zod";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import { BaseTools } from "./base";
import { buildSearchQuery, type QueryParams } from "./utils/search";
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
			"Find Shortcut stories with flexible search criteria. Results are sorted by meaningful activity time - completed stories use completion date, active stories use last updated time (newest first). This avoids noise from post-completion edits like typo fixes.",
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
				project: z
					.union([z.number(), z.string()])
					.optional()
					.describe("Find only stories matching the specified project ID or project name"),
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

		// 新しいツール：特定のユーザーがOwnerのStoryを検索
		server.tool(
			"search-stories-by-owner",
			"Find Shortcut stories owned by a specific user ID. This tool tries multiple search approaches if the primary owner search fails. Results are sorted by meaningful activity time - completed stories use completion date, active stories use last updated time (newest first). This avoids noise from post-completion edits.",
			{
				owner_id: z.string().describe("The user ID (UUID) of the owner to search for"),
				state: z
					.string()
					.optional()
					.describe("Optional: Filter by workflow state (e.g., 'Done', 'In Progress')"),
				type: z
					.enum(["feature", "bug", "chore"])
					.optional()
					.describe("Optional: Filter by story type"),
				isDone: is("completed").optional(),
				isStarted: is("started").optional(),
				isUnstarted: is("unstarted").optional(),
				isArchived: is("archived").default(false),
				limit: z
					.number()
					.min(1)
					.max(100)
					.default(25)
					.describe("Maximum number of stories to return (1-100, default 25)"),
			},
			async (params) => await tools.searchStoriesByOwner(params),
		);

		// 代替ツール：メンション名でのOwner検索
		server.tool(
			"search-stories-by-mention",
			"Find Shortcut stories owned by a specific user using their mention name (e.g., 'mash'). This is an alternative to search-stories-by-owner for when you have the mention name instead of UUID. Results are sorted by meaningful activity time - completed stories use completion date, active stories use last updated time (newest first). This avoids noise from post-completion edits.",
			{
				mention_name: z.string().describe("The mention name of the owner (without @ symbol)"),
				state: z.string().optional().describe("Optional: Filter by workflow state"),
				type: z
					.enum(["feature", "bug", "chore"])
					.optional()
					.describe("Optional: Filter by story type"),
				isDone: is("completed").optional(),
				isStarted: is("started").optional(),
				isUnstarted: is("unstarted").optional(),
				isArchived: is("archived").default(false),
				limit: z
					.number()
					.min(1)
					.max(100)
					.default(25)
					.describe("Maximum number of stories to return"),
			},
			async (params) => await tools.searchStoriesByMention(params),
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
				iteration: z
					.number()
					.optional()
					.describe("The iteration id of the iteration the story belongs to"),
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
			async ({ name, description, type, owner, epic, iteration, team, workflow }) =>
				await tools.createStory({
					name,
					description,
					type,
					owner,
					epic,
					iteration,
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
				iteration: z
					.number()
					.nullable()
					.optional()
					.describe("The iteration id of the iteration the story belongs to, or null to unset"),
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

		server.tool(
			"add-task-to-story",
			"Add a task to a story",
			{
				storyPublicId: z.number().positive().describe("The public ID of the story"),
				taskDescription: z.string().min(1).describe("The description of the task"),
				taskOwnerIds: z
					.array(z.string())
					.optional()
					.describe("Array of user IDs to assign as owners of the task"),
			},
			async (params) => await tools.addTaskToStory(params),
		);

		server.tool(
			"add-relation-to-story",
			"Add a story relationship to a story",
			{
				storyPublicId: z.number().positive().describe("The public ID of the story"),
				relatedStoryPublicId: z.number().positive().describe("The public ID of the related story"),
				relationshipType: z
					.enum(["relates to", "blocks", "blocked by", "duplicates", "duplicated by"])
					.optional()
					.default("relates to")
					.describe("The type of relationship"),
			},
			async (params) => await tools.addRelationToStory(params),
		);

		server.tool(
			"update-task",
			"Update a task in a story",
			{
				storyPublicId: z.number().positive().describe("The public ID of the story"),
				taskPublicId: z.number().positive().describe("The public ID of the task"),
				taskDescription: z.string().optional().describe("The description of the task"),
				taskOwnerIds: z
					.array(z.string())
					.optional()
					.describe("Array of user IDs to assign as owners of the task"),
				isCompleted: z.boolean().optional().describe("Whether the task is completed or not"),
			},
			async (params) => await tools.updateTask(params),
		);

		server.tool(
			"add-external-link-to-story",
			"Add an external link to a Shortcut story",
			{
				storyPublicId: z.number().positive().describe("The public ID of the story"),
				externalLink: z.string().url().max(2048).describe("The external link URL to add"),
			},
			async ({ storyPublicId, externalLink }) =>
				await tools.addExternalLinkToStory(storyPublicId, externalLink),
		);

		server.tool(
			"remove-external-link-from-story",
			"Remove an external link from a Shortcut story",
			{
				storyPublicId: z.number().positive().describe("The public ID of the story"),
				externalLink: z.string().url().max(2048).describe("The external link URL to remove"),
			},
			async ({ storyPublicId, externalLink }) =>
				await tools.removeExternalLinkFromStory(storyPublicId, externalLink),
		);

		server.tool(
			"get-stories-by-external-link",
			"Find all stories that contain a specific external link",
			{
				externalLink: z.string().url().max(2048).describe("The external link URL to search for"),
			},
			async ({ externalLink }) => await tools.getStoriesByExternalLink(externalLink),
		);

		server.tool(
			"set-story-external-links",
			"Replace all external links on a story with a new set of links",
			{
				storyPublicId: z.number().positive().describe("The public ID of the story"),
				externalLinks: z
					.array(z.string().url().max(2048))
					.describe("Array of external link URLs to set (replaces all existing links)"),
			},
			async ({ storyPublicId, externalLinks }) =>
				await tools.setStoryExternalLinks(storyPublicId, externalLinks),
		);

		return tools;
	}

	// ストーリーをスマートソートするヘルパーメソッド
	// 完了済みはcompleted_at、未完了はupdated_atを使用してノイズを除去
	private sortStoriesBySmartActivity(stories: Story[]): Story[] {
		return stories.sort((a, b) => {
			// 完了済みはcompleted_at、未完了はupdated_atを使用
			const dateA = new Date(a.completed_at || a.updated_at || 0);
			const dateB = new Date(b.completed_at || b.updated_at || 0);

			return dateB.getTime() - dateA.getTime(); // 新しい順
		});
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
			.replace(/[^\w-]/g, "")}`.substring(0, 50);
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
		iteration,
		team,
		workflow,
	}: {
		name: string;
		description?: string;
		type: "feature" | "bug" | "chore";
		owner?: string;
		epic?: number;
		iteration?: number;
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
			iteration_id: iteration,
			group_id: team,
			workflow_state_id: fullWorkflow.default_state_id,
		});

		return this.toResult(`Created story: ${story.id}`);
	}

	async searchStories(params: QueryParams) {
		const currentUser = await this.client.getCurrentUser();
		const query = await buildSearchQuery(params, currentUser, this.client);
		const { stories, total } = await this.client.searchStories(query);

		if (!stories) throw new Error(`Failed to search for stories matching your query: "${query}".`);
		if (!stories.length)
			return this.toResult(`Result: No stories found matching query: "${query}"`);

		// スマートソートでソート
		const sortedStories = this.sortStoriesBySmartActivity(stories as Story[]);

		return this.toResult(
			`Result (first ${sortedStories.length} shown of ${total} total stories found, sorted by smart activity time):`,
			await this.entitiesWithRelatedEntities(sortedStories, "stories"),
		);
	}

	// 新しいメソッド：特定のユーザーがOwnerのStoryを検索
	async searchStoriesByOwner(params: {
		owner_id: string;
		state?: string;
		type?: "feature" | "bug" | "chore";
		isDone?: boolean;
		isStarted?: boolean;
		isUnstarted?: boolean;
		isArchived?: boolean;
		limit?: number;
	}) {
		const {
			owner_id,
			state,
			type,
			isDone,
			isStarted,
			isUnstarted,
			isArchived = false,
			limit = 25,
		} = params;

		try {
			// ユーザー情報を取得して存在確認
			const ownerUser = await this.client.getMember(owner_id);
			if (!ownerUser) {
				throw new Error(`User with ID '${owner_id}' not found`);
			}

			// 複数の検索方法を試行
			const searchAttempts = [
				// 方法1: UUIDでの検索
				`owner:${owner_id}`,
				// 方法2: mention nameでの検索
				`owner:${ownerUser.profile.mention_name}`,
				// 方法3: display nameでの検索
				`owner:"${ownerUser.profile.name}"`,
			];

			let stories = null;
			let total = 0;
			let successfulQuery = "";

			for (const baseQuery of searchAttempts) {
				let query = baseQuery;

				// アーカイブされていないストーリーのみを取得（デフォルト）
				if (!isArchived) {
					query += " !is:archived";
				}

				// オプションのフィルターを追加
				if (state) {
					query += ` state:"${state}"`;
				}

				if (type) {
					query += ` type:${type}`;
				}

				if (isDone === true) {
					query += " is:done";
				} else if (isDone === false) {
					query += " !is:done";
				}

				if (isStarted === true) {
					query += " is:started";
				} else if (isStarted === false) {
					query += " !is:started";
				}

				if (isUnstarted === true) {
					query += " is:unstarted";
				} else if (isUnstarted === false) {
					query += " !is:unstarted";
				}

				try {
					const result = await this.client.searchStories(query, limit);
					if (result.stories && result.stories.length > 0) {
						// スマートソートでソート
						stories = this.sortStoriesBySmartActivity(result.stories as Story[]);
						total = result.total || 0;
						successfulQuery = query;
						break; // 成功したら他の方法は試さない
					}
				} catch (searchError) {
					// この検索方法が失しても次を試す
				}
			}

			if (!stories || !stories.length) {
				return this.toResult(
					`No stories found for owner '${ownerUser.profile.mention_name}' (${ownerUser.profile.name}).\nTried multiple search methods including:\n- UUID: ${owner_id}\n- Mention name: ${ownerUser.profile.mention_name}\n- Display name: ${ownerUser.profile.name}\n\nNote: The user may not have any stories matching the specified criteria, or they might be archived.`,
				);
			}

			return this.toResult(
				`Found ${stories.length} of ${total} total stories owned by '${ownerUser.profile.mention_name}' (${ownerUser.profile.name}) using query: "${successfulQuery}" (sorted by smart activity time):`,
				await this.entitiesWithRelatedEntities(stories, "stories"),
			);
		} catch (error) {
			throw new Error(
				`Failed to search stories by owner: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	// 代替メソッド：メンション名でのOwner検索
	async searchStoriesByMention(params: {
		mention_name: string;
		state?: string;
		type?: "feature" | "bug" | "chore";
		isDone?: boolean;
		isStarted?: boolean;
		isUnstarted?: boolean;
		isArchived?: boolean;
		limit?: number;
	}) {
		const {
			mention_name,
			state,
			type,
			isDone,
			isStarted,
			isUnstarted,
			isArchived = false,
			limit = 25,
		} = params;
		try {
			// メンション名からユーザー情報を検索
			const members = await this.client.listMembers();
			const ownerUser = members.find((m) => m.profile.mention_name === mention_name);

			if (!ownerUser) {
				return this.toResult(
					`User with mention name '@${mention_name}' not found. Available users: ${members.map((m) => m.profile.mention_name).join(", ")}`,
				);
			}

			// 複数の検索方法を試行
			const searchAttempts = [
				// 方法1: mention nameでの検索
				`owner:${mention_name}`,
				// 方法2: @付きでの検索
				`owner:@${mention_name}`,
				// 方法3: display nameでの検索
				`owner:"${ownerUser.profile.name}"`,
				// 方法4: UUIDでの検索
				`owner:${ownerUser.id}`,
			];

			let stories = null;
			let total = 0;
			let successfulQuery = "";

			for (const baseQuery of searchAttempts) {
				let query = baseQuery;

				// アーカイブされていないストーリーのみを取得（デフォルト）
				if (!isArchived) {
					query += " !is:archived";
				}

				// オプションのフィルターを追加
				if (state) {
					query += ` state:"${state}"`;
				}

				if (type) {
					query += ` type:${type}`;
				}

				if (isDone === true) {
					query += " is:done";
				} else if (isDone === false) {
					query += " !is:done";
				}

				if (isStarted === true) {
					query += " is:started";
				} else if (isStarted === false) {
					query += " !is:started";
				}

				if (isUnstarted === true) {
					query += " is:unstarted";
				} else if (isUnstarted === false) {
					query += " !is:unstarted";
				}

				try {
					const result = await this.client.searchStories(query, limit);
					if (result.stories && result.stories.length > 0) {
						stories = this.sortStoriesBySmartActivity(result.stories as Story[]);
						total = result.total || 0;
						successfulQuery = query;
						break; // 成功したら他の方法は試さない
					}
				} catch (searchError) {
					// この検索方法が失敗しても次を試す
				}
			}

			if (!stories || !stories.length) {
				return this.toResult(
					`No stories found for owner '@${mention_name}' (${ownerUser.profile.name}).\nTried multiple search methods including:\n- Mention: ${mention_name}\n- @ Mention: @${mention_name}\n- Display name: ${ownerUser.profile.name}\n- UUID: ${ownerUser.id}\n\nNote: The user may not have any stories matching the specified criteria, or they might be archived.`,
				);
			}

			return this.toResult(
				`Found ${stories.length} of ${total} total stories owned by '@${mention_name}' (${ownerUser.profile.name}) using query: "${successfulQuery}" (sorted by smart activity time):`,
				await this.entitiesWithRelatedEntities(stories, "stories"),
			);
		} catch (error) {
			throw new Error(
				`Failed to search stories by mention: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	async getStory(storyPublicId: number) {
		const story = await this.client.getStory(storyPublicId);

		if (!story)
			throw new Error(`Failed to retrieve Shortcut story with public ID: ${storyPublicId}.`);

		return this.toResult(
			`Story: sc-${storyPublicId}`,
			await this.entityWithRelatedEntities(story, "story"),
		);
	}

	async createStoryComment({ storyPublicId, text }: { storyPublicId: number; text: string }) {
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
		iteration?: number | null;
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
		if (updates.iteration !== undefined) updateParams.iteration_id = updates.iteration;
		if (updates.owner_ids !== undefined) updateParams.owner_ids = updates.owner_ids;
		if (updates.workflow_state_id !== undefined)
			updateParams.workflow_state_id = updates.workflow_state_id;
		if (updates.labels !== undefined) updateParams.labels = updates.labels;

		// Update the story
		const updatedStory = await this.client.updateStory(storyPublicId, updateParams);

		return this.toResult(`Updated story sc-${storyPublicId}. Story URL: ${updatedStory.app_url}`);
	}

	async addTaskToStory({
		storyPublicId,
		taskDescription,
		taskOwnerIds,
	}: {
		storyPublicId: number;
		taskDescription: string;
		taskOwnerIds?: string[];
	}) {
		if (!storyPublicId) throw new Error("Story public ID is required");
		if (!taskDescription) throw new Error("Task description is required");

		const story = await this.client.getStory(storyPublicId);
		if (!story)
			throw new Error(`Failed to retrieve Shortcut story with public ID: ${storyPublicId}`);

		if (taskOwnerIds?.length) {
			const owners = await this.client.getUserMap(taskOwnerIds as string[]);
			if (!owners) throw new Error(`Failed to retrieve users with IDs: ${taskOwnerIds.join(", ")}`);
		}

		const task = await this.client.addTaskToStory(storyPublicId, {
			description: taskDescription,
			ownerIds: taskOwnerIds,
		});

		return this.toResult(`Created task for story sc-${storyPublicId}. Task ID: ${task.id}.`);
	}

	async updateTask({
		storyPublicId,
		taskPublicId,
		taskDescription,
		taskOwnerIds,
		isCompleted,
	}: {
		storyPublicId: number;
		taskPublicId: number;
		taskDescription?: string;
		taskOwnerIds?: string[];
		isCompleted?: boolean;
	}) {
		if (!storyPublicId) throw new Error("Story public ID is required");
		if (!taskPublicId) throw new Error("Task public ID is required");

		const story = await this.client.getStory(storyPublicId);
		if (!story)
			throw new Error(`Failed to retrieve Shortcut story with public ID: ${storyPublicId}`);

		const task = await this.client.getTask(storyPublicId, taskPublicId);
		if (!task) throw new Error(`Failed to retrieve Shortcut task with public ID: ${taskPublicId}`);

		const updatedTask = await this.client.updateTask(storyPublicId, taskPublicId, {
			description: taskDescription,
			ownerIds: taskOwnerIds,
			isCompleted,
		});

		let message = `Updated task for story sc-${storyPublicId}. Task ID: ${updatedTask.id}.`;
		if (isCompleted) {
			message = `Completed task for story sc-${storyPublicId}. Task ID: ${updatedTask.id}.`;
		}

		return this.toResult(message);
	}

	async addRelationToStory({
		storyPublicId,
		relatedStoryPublicId,
		relationshipType,
	}: {
		storyPublicId: number;
		relatedStoryPublicId: number;
		relationshipType: "relates to" | "blocks" | "blocked by" | "duplicates" | "duplicated by";
	}) {
		if (!storyPublicId) throw new Error("Story public ID is required");
		if (!relatedStoryPublicId) throw new Error("Related story public ID is required");

		const story = await this.client.getStory(storyPublicId);
		if (!story)
			throw new Error(`Failed to retrieve Shortcut story with public ID: ${storyPublicId}`);

		const relatedStory = await this.client.getStory(relatedStoryPublicId);
		if (!relatedStory)
			throw new Error(`Failed to retrieve Shortcut story with public ID: ${relatedStoryPublicId}`);

		let subjectStoryId = storyPublicId;
		let objectStoryId = relatedStoryPublicId;

		if (relationshipType === "blocked by" || relationshipType === "duplicated by") {
			relationshipType = relationshipType === "blocked by" ? "blocks" : "duplicates";
			subjectStoryId = relatedStoryPublicId;
			objectStoryId = storyPublicId;
		}

		await this.client.addRelationToStory(subjectStoryId, objectStoryId, relationshipType);

		return this.toResult(
			relationshipType === "blocks"
				? `Marked sc-${subjectStoryId} as a blocker to sc-${objectStoryId}.`
				: relationshipType === "duplicates"
					? `Marked sc-${subjectStoryId} as a duplicate of sc-${objectStoryId}.`
					: `Added a relationship between sc-${subjectStoryId} and sc-${objectStoryId}.`,
		);
	}

	async addExternalLinkToStory(storyPublicId: number, externalLink: string) {
		if (!storyPublicId) throw new Error("Story public ID is required");
		if (!externalLink) throw new Error("External link is required");

		const updatedStory = await this.client.addExternalLinkToStory(storyPublicId, externalLink);

		return this.toResult(
			`Added external link to story sc-${storyPublicId}. Story URL: ${updatedStory.app_url}`,
		);
	}

	async removeExternalLinkFromStory(storyPublicId: number, externalLink: string) {
		if (!storyPublicId) throw new Error("Story public ID is required");
		if (!externalLink) throw new Error("External link is required");

		const updatedStory = await this.client.removeExternalLinkFromStory(storyPublicId, externalLink);

		return this.toResult(
			`Removed external link from story sc-${storyPublicId}. Story URL: ${updatedStory.app_url}`,
		);
	}

	async getStoriesByExternalLink(externalLink: string) {
		if (!externalLink) throw new Error("External link is required");

		const { stories, total } = await this.client.getStoriesByExternalLink(externalLink);

		if (!stories || !stories.length) {
			return this.toResult(`No stories found with external link: ${externalLink}`);
		}

		return this.toResult(
			`Found ${total} stories with external link: ${externalLink}`,
			await this.entitiesWithRelatedEntities(stories, "stories"),
		);
	}

	async setStoryExternalLinks(storyPublicId: number, externalLinks: string[]) {
		if (!storyPublicId) throw new Error("Story public ID is required");
		if (!Array.isArray(externalLinks)) throw new Error("External links must be an array");

		const updatedStory = await this.client.setStoryExternalLinks(storyPublicId, externalLinks);

		const linkCount = externalLinks.length;
		const message =
			linkCount === 0
				? `Removed all external links from story sc-${storyPublicId}`
				: `Set ${linkCount} external link${linkCount === 1 ? "" : "s"} on story sc-${storyPublicId}`;

		return this.toResult(`${message}. Story URL: ${updatedStory.app_url}`);
	}
}
