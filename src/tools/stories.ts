import type { CreateStoryParams, MemberInfo, Story } from "@shortcut/client";
import { z } from "zod";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { CustomMcpServer } from "@/mcp/CustomMcpServer";
import {
	STORY_CARD_CSP,
	STORY_CARD_HTML,
	STORY_CARD_LEGACY_META_KEY,
	STORY_CARD_RESOURCE_MIME_TYPE,
	STORY_CARD_RESOURCE_URI,
} from "@/ui/story-card";
import { BaseTools } from "./base";
import { buildSearchQuery, type QueryParams } from "./utils/search";
import { date, has, is, user } from "./utils/validation";

export class StoryTools extends BaseTools {
	static create(client: ShortcutClientWrapper, server: CustomMcpServer) {
		const tools = new StoryTools(client);

		const shouldAddGetByIdTool =
			typeof server.shouldAddTool === "function" ? server.shouldAddTool("stories-get-by-id") : true;
		if (
			shouldAddGetByIdTool &&
			typeof server.registerResource === "function" &&
			typeof server.addConfiguredToolWithReadAccess === "function"
		) {
			server.registerResource(
				"stories-card-resource",
				STORY_CARD_RESOURCE_URI,
				{
					title: "Shortcut Story Card",
					mimeType: STORY_CARD_RESOURCE_MIME_TYPE,
					_meta: {
						ui: {
							csp: STORY_CARD_CSP,
						},
					},
				},
				async () => ({
					contents: [
						{
							uri: STORY_CARD_RESOURCE_URI,
							mimeType: STORY_CARD_RESOURCE_MIME_TYPE,
							text: STORY_CARD_HTML,
							_meta: {
								ui: {
									csp: STORY_CARD_CSP,
								},
							},
						},
					],
				}),
			);
		}

		server.addConfiguredToolWithReadAccess(
			"stories-get-by-id",
			{
				title: "Get story by ID",
				description: "Get a Shortcut story by public ID.",
				inputSchema: {
					storyPublicId: z.number().positive().describe("The story ID"),
					full: z.boolean().optional().default(false).describe("Return all fields (default: slim)"),
				},
				_meta: {
					ui: {
						resourceUri: STORY_CARD_RESOURCE_URI,
					},
					[STORY_CARD_LEGACY_META_KEY]: STORY_CARD_RESOURCE_URI,
				},
			},
			async ({ storyPublicId, full }) => await tools.getStory(storyPublicId, full),
		);

		server.addToolWithReadAccess(
			"stories-get-history",
			"Get the change history for a Shortcut story.",
			{
				storyPublicId: z.number().positive().describe("The story ID"),
			},
			async ({ storyPublicId }) => await tools.getStoryHistory(storyPublicId),
		);

		server.addToolWithReadAccess(
			"stories-search",
			"Find Shortcut stories.",
			{
				nextPageToken: z.string().optional().describe("Pagination token from previous search"),
				id: z.number().optional().describe("Story ID"),
				name: z.string().optional().describe("Name contains"),
				description: z.string().optional().describe("Description contains"),
				comment: z.string().optional().describe("Comment contains"),
				type: z.enum(["feature", "bug", "chore"]).optional().describe("Story type"),
				estimate: z.number().optional().describe("Point estimate"),
				branch: z.string().optional().describe("Branch name"),
				commit: z.string().optional().describe("Commit SHA"),
				pr: z.number().optional().describe("PR number"),
				project: z.number().optional().describe("Project ID"),
				epic: z.number().optional().describe("Epic ID"),
				objective: z.number().optional().describe("Objective ID"),
				state: z.string().optional().describe("Workflow state name"),
				label: z.string().optional().describe("Label name"),
				owner: user("owner"),
				requester: user("requester"),
				team: z.string().optional().describe("Team name or mention"),
				skillSet: z.string().optional().describe("Skill set"),
				productArea: z.string().optional().describe("Product area"),
				technicalArea: z.string().optional().describe("Technical area"),
				priority: z.string().optional().describe("Priority level"),
				severity: z.string().optional().describe("Severity level"),
				isDone: is("completed"),
				isStarted: is("started"),
				isUnstarted: is("unstarted"),
				isUnestimated: is("unestimated"),
				isOverdue: is("overdue"),
				isArchived: is("archived").default(false),
				isBlocker: is("blocking"),
				isBlocked: is("blocked"),
				hasComment: has("comment"),
				hasLabel: has("label"),
				hasDeadline: has("deadline"),
				hasOwner: has("owner"),
				hasPr: has("PR"),
				hasCommit: has("commit"),
				hasBranch: has("branch"),
				hasEpic: has("epic"),
				hasTask: has("task"),
				hasAttachment: has("attachment"),
				created: date(),
				updated: date(),
				completed: date(),
				due: date(),
			},
			async ({ nextPageToken, ...params }) => await tools.searchStories(params, nextPageToken),
		);

		server.addToolWithReadAccess(
			"stories-get-branch-name",
			"Get a valid git branch name for a story.",
			{
				storyPublicId: z.number().positive().describe("The story ID"),
			},
			async ({ storyPublicId }) => await tools.getStoryBranchName(storyPublicId),
		);

		server.addToolWithWriteAccess(
			"stories-create",
			"Create a new Shortcut story. Requires name and either team or workflow.",
			{
				name: z.string().min(1).max(512).describe("Story name (required)"),
				description: z.string().max(10_000).optional().describe("Story description"),
				type: z.enum(["feature", "bug", "chore"]).default("feature").describe("Story type"),
				owner: z.string().optional().describe("Owner user ID"),
				epic: z.number().optional().describe("Epic ID"),
				iteration: z.number().optional().describe("Iteration ID"),
				team: z.string().optional().describe("Team ID or mention (required if no workflow)"),
				workflow: z.number().optional().describe("Workflow ID (required if no team)"),
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

		server.addToolWithWriteAccess(
			"stories-update",
			"Update a Shortcut story. Only provide fields to update.",
			{
				storyPublicId: z.number().positive().describe("Story ID (required)"),
				name: z.string().max(512).optional().describe("Story name"),
				description: z.string().max(10_000).optional().describe("Story description"),
				type: z.enum(["feature", "bug", "chore"]).optional().describe("Story type"),
				epic: z.number().nullable().optional().describe("Epic ID (null to unset)"),
				estimate: z.number().nullable().optional().describe("Point estimate (null to unset)"),
				iteration: z.number().nullable().optional().describe("Iteration ID (null to unset)"),
				owner_ids: z.array(z.string()).optional().describe("Owner user UUIDs"),
				workflow_state_id: z.number().optional().describe("Workflow state ID"),
				labels: z
					.array(
						z.object({
							name: z.string().describe("Label name"),
							color: z.string().optional().describe("Hex color"),
							description: z.string().optional().describe("Label description"),
						}),
					)
					.optional()
					.describe("Labels to assign"),
				custom_fields: z
					.array(
						z.object({
							field_id: z.string().uuid().describe("Custom field UUID"),
							value_id: z.string().uuid().describe("Value UUID"),
						}),
					)
					.optional()
					.describe("Custom field values"),
				team_id: z.string().nullable().optional().describe("Team UUID (null to unset)"),
				project_id: z.number().nullable().optional().describe("Project ID (null to unset)"),
				deadline: z.string().nullable().optional().describe("Due date ISO 8601 (null to unset)"),
				follower_ids: z.array(z.string()).optional().describe("Follower user UUIDs"),
				requested_by_id: z.string().optional().describe("Requester user UUID"),
				archived: z.boolean().optional().describe("Archive the story"),
			},
			async (params) => await tools.updateStory(params),
		);

		server.addToolWithWriteAccess(
			"stories-upload-file",
			"Upload a file and attach it to a story.",
			{
				storyPublicId: z.number().positive().describe("Story ID"),
				filePath: z.string().describe("File path to upload"),
			},
			async ({ storyPublicId, filePath }) => await tools.uploadFileToStory(storyPublicId, filePath),
		);

		server.addToolWithWriteAccess(
			"stories-assign-current-user",
			"Assign current user as story owner.",
			{
				storyPublicId: z.number().positive().describe("Story ID"),
			},
			async ({ storyPublicId }) => await tools.assignCurrentUserAsOwner(storyPublicId),
		);

		server.addToolWithWriteAccess(
			"stories-unassign-current-user",
			"Remove current user as story owner.",
			{
				storyPublicId: z.number().positive().describe("Story ID"),
			},
			async ({ storyPublicId }) => await tools.unassignCurrentUserAsOwner(storyPublicId),
		);

		server.addToolWithWriteAccess(
			"stories-create-comment",
			"Add a comment to a story.",
			{
				storyPublicId: z.number().positive().describe("Story ID"),
				replyToCommentId: z.number().positive().optional().describe("Comment ID to reply to"),
				text: z.string().min(1).describe("Comment text"),
			},
			async (params) => await tools.createStoryComment(params),
		);

		server.addToolWithWriteAccess(
			"stories-create-subtask",
			"Create a new sub-task story.",
			{
				parentStoryPublicId: z.number().positive().describe("Parent story ID"),
				name: z.string().min(1).max(512).describe("Sub-task name"),
				description: z.string().max(10_000).optional().describe("Sub-task description"),
			},
			async (params) => await tools.createSubTask(params),
		);

		server.addToolWithWriteAccess(
			"stories-add-subtask",
			"Add existing story as a sub-task.",
			{
				parentStoryPublicId: z.number().positive().describe("Parent story ID"),
				subTaskPublicId: z.number().positive().describe("Sub-task story ID"),
			},
			async (params) => await tools.addStoryAsSubTask(params),
		);

		server.addToolWithWriteAccess(
			"stories-remove-subtask",
			"Remove sub-task from parent (becomes regular story).",
			{
				subTaskPublicId: z.number().positive().describe("Sub-task story ID"),
			},
			async (params) => await tools.removeSubTaskFromParent(params),
		);

		server.addToolWithWriteAccess(
			"stories-add-task",
			"Add a task (checklist item) to a story.",
			{
				storyPublicId: z.number().positive().describe("Story ID"),
				taskDescription: z.string().min(1).describe("Task description"),
				taskOwnerIds: z.array(z.string()).optional().describe("Owner user IDs"),
			},
			async (params) => await tools.addTaskToStory(params),
		);

		server.addToolWithWriteAccess(
			"stories-update-task",
			"Update a task in a story.",
			{
				storyPublicId: z.number().positive().describe("Story ID"),
				taskPublicId: z.number().positive().describe("Task ID"),
				taskDescription: z.string().optional().describe("Task description"),
				taskOwnerIds: z.array(z.string()).optional().describe("Owner user IDs"),
				isCompleted: z.boolean().optional().describe("Mark as completed"),
			},
			async (params) => await tools.updateTask(params),
		);

		server.addToolWithWriteAccess(
			"stories-add-relation",
			"Add a relationship between stories.",
			{
				storyPublicId: z.number().positive().describe("Story ID"),
				relatedStoryPublicId: z.number().positive().describe("Related story ID"),
				relationshipType: z
					.enum(["relates to", "blocks", "blocked by", "duplicates", "duplicated by"])
					.optional()
					.default("relates to")
					.describe("Relationship type"),
			},
			async (params) => await tools.addRelationToStory(params),
		);

		server.addToolWithWriteAccess(
			"stories-add-external-link",
			"Add an external link to a story.",
			{
				storyPublicId: z.number().positive().describe("Story ID"),
				externalLink: z.string().url().max(2048).describe("URL to add"),
			},
			async ({ storyPublicId, externalLink }) =>
				await tools.addExternalLinkToStory(storyPublicId, externalLink),
		);

		server.addToolWithWriteAccess(
			"stories-remove-external-link",
			"Remove an external link from a story.",
			{
				storyPublicId: z.number().positive().describe("Story ID"),
				externalLink: z.string().url().max(2048).describe("URL to remove"),
			},
			async ({ storyPublicId, externalLink }) =>
				await tools.removeExternalLinkFromStory(storyPublicId, externalLink),
		);

		server.addToolWithWriteAccess(
			"stories-set-external-links",
			"Replace all external links on a story.",
			{
				storyPublicId: z.number().positive().describe("Story ID"),
				externalLinks: z.array(z.string().url().max(2048)).describe("URLs to set (replaces all)"),
			},
			async ({ storyPublicId, externalLinks }) =>
				await tools.setStoryExternalLinks(storyPublicId, externalLinks),
		);

		server.addToolWithReadAccess(
			"stories-get-by-external-link",
			"Find stories containing a specific external link.",
			{
				externalLink: z.string().url().max(2048).describe("URL to search for"),
			},
			async ({ externalLink }) => await tools.getStoriesByExternalLink(externalLink),
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

		return this.toResult(`Created story: sc-${story.id}`);
	}

	async createSubTask({
		parentStoryPublicId,
		name,
		description,
	}: {
		parentStoryPublicId: number;
		name: string;
		description?: string;
	}) {
		if (!parentStoryPublicId) throw new Error("ID of parent story is required");
		if (!name) throw new Error("Sub-task name is required");

		const parentStory = await this.client.getStory(parentStoryPublicId);
		if (!parentStory)
			throw new Error(`Failed to retrieve parent story with public ID: ${parentStoryPublicId}`);

		const workflow = await this.client.getWorkflow(parentStory.workflow_id);
		if (!workflow) throw new Error("Failed to retrieve workflow of parent story");

		const workflowState = workflow.states[0];
		if (!workflowState) throw new Error("Failed to determine default state for sub-task");

		const subTask = await this.client.createStory({
			name,
			description,
			story_type: parentStory.story_type as CreateStoryParams["story_type"],
			epic_id: parentStory.epic_id,
			group_id: parentStory.group_id,
			workflow_state_id: workflowState.id,
			parent_story_id: parentStoryPublicId,
		});

		return this.toResult(`Created sub-task: sc-${subTask.id}`);
	}

	async addStoryAsSubTask({
		parentStoryPublicId,
		subTaskPublicId,
	}: {
		parentStoryPublicId: number;
		subTaskPublicId: number;
	}) {
		if (!parentStoryPublicId) throw new Error("ID of parent story is required");
		if (!subTaskPublicId) throw new Error("ID of sub-task story is required");

		const subTask = await this.client.getStory(subTaskPublicId);
		if (!subTask) throw new Error(`Failed to retrieve story with public ID: ${subTaskPublicId}`);
		const parentStory = await this.client.getStory(parentStoryPublicId);
		if (!parentStory)
			throw new Error(`Failed to retrieve parent story with public ID: ${parentStoryPublicId}`);

		await this.client.updateStory(subTaskPublicId, {
			parent_story_id: parentStoryPublicId,
		});

		return this.toResult(
			`Added story sc-${subTaskPublicId} as a sub-task of sc-${parentStoryPublicId}`,
		);
	}

	async removeSubTaskFromParent({ subTaskPublicId }: { subTaskPublicId: number }) {
		if (!subTaskPublicId) throw new Error("ID of sub-task story is required");

		const subTask = await this.client.getStory(subTaskPublicId);
		if (!subTask) throw new Error(`Failed to retrieve story with public ID: ${subTaskPublicId}`);

		await this.client.updateStory(subTaskPublicId, {
			parent_story_id: null,
		});

		return this.toResult(`Removed story sc-${subTaskPublicId} from its parent story`);
	}

	async searchStories(params: QueryParams, nextToken?: string) {
		const currentUser = await this.client.getCurrentUser();
		const query = await buildSearchQuery(params, currentUser);
		const { stories, total, next_page_token } = await this.client.searchStories(query, nextToken);

		if (!stories) throw new Error(`Failed to search for stories matching your query: "${query}".`);
		if (!stories.length) return this.toResult(`Result: No stories found.`);

		return this.toResult(
			`Result (${stories.length} shown of ${total} total stories found):`,
			await this.entitiesWithRelatedEntities(stories, "stories"),
			next_page_token,
		);
	}

	async getStory(storyPublicId: number, full = false) {
		const story = await this.client.getStory(storyPublicId);

		if (!story)
			throw new Error(`Failed to retrieve Shortcut story with public ID: ${storyPublicId}`);

		const result = this.toResult(
			`Story: sc-${storyPublicId}`,
			await this.entityWithRelatedEntities(story, "story", full),
		);

		const primaryOwnerId = story.owner_ids?.[0] ?? null;
		const primaryOwner = primaryOwnerId
			? ((await this.client.getUserMap([primaryOwnerId])).get(primaryOwnerId) ?? null)
			: null;
		const ownerAvatarUrl = primaryOwner?.profile?.display_icon?.url ?? null;
		const ownerAvatarDataUrl = await this.inlineImageAsDataUrl(ownerAvatarUrl);

		return {
			...result,
			structuredContent: {
				story: {
					id: story.id,
					title: story.name,
					type: story.story_type,
					owner: {
						name:
							primaryOwner?.profile?.name ?? primaryOwner?.profile?.mention_name ?? "Unassigned",
						avatarUrl: ownerAvatarUrl,
						avatarDataUrl: ownerAvatarDataUrl,
					},
				},
			},
		};
	}

	private async inlineImageAsDataUrl(url: string | null) {
		if (!url) return null;

		try {
			const response = await fetch(url, {
				headers: {
					"Shortcut-Token": process.env.SHORTCUT_API_TOKEN ?? "",
				},
			});

			if (!response.ok) return null;

			const mimeType = response.headers.get("content-type") ?? "";
			if (!mimeType.startsWith("image/")) return null;

			const bytes = await response.arrayBuffer();
			if (!bytes.byteLength || bytes.byteLength > 1024 * 1024) return null;

			const base64 = Buffer.from(bytes).toString("base64");
			return `data:${mimeType};base64,${base64}`;
		} catch {
			return null;
		}
	}

	async getStoryHistory(storyPublicId: number) {
		const story = await this.client.getStory(storyPublicId);
		if (!story)
			throw new Error(`Failed to retrieve Shortcut story with public ID: ${storyPublicId}`);

		const history = await this.client.getStoryHistory(storyPublicId);

		if (!history.length) {
			return this.toResult(`Result: No history found for story sc-${storyPublicId}.`);
		}

		// Format history entries for readability
		const formattedHistory = history.map((entry) => ({
			id: entry.id,
			changed_at: entry.changed_at,
			actor_id: entry.member_id,
			...(entry.actor_name ? { actor_name: entry.actor_name } : {}),
			actions: entry.actions /*.filter((action) => action.id === storyPublicId)*/
				.map((action) => {
					if (action.id !== storyPublicId) return action;
					const ignoredKeys =
						action.action === "create"
							? ["app_url", "entity_type"]
							: ["name", "story_type", "app_url", "entity_type"];
					return Object.fromEntries(
						Object.entries(action).filter(([key]) => !ignoredKeys.includes(key)),
					);
				}),
			...(entry.references?.length ? { references: entry.references } : {}),
		}));

		return this.toResult(
			`Result (${history.length} history entries for story sc-${storyPublicId}):`,
			{ history: formattedHistory },
		);
	}

	async createStoryComment({
		storyPublicId,
		replyToCommentId,
		text,
	}: {
		storyPublicId: number;
		replyToCommentId?: number;
		text: string;
	}) {
		if (!storyPublicId) throw new Error("Story public ID is required");
		if (!text) throw new Error("Story comment text is required");

		const story = await this.client.getStory(storyPublicId);
		if (!story)
			throw new Error(`Failed to retrieve Shortcut story with public ID: ${storyPublicId}`);

		const storyComment = await this.client.createStoryComment(storyPublicId, {
			text,
			parent_id: replyToCommentId,
		});

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
		custom_fields?: Array<{
			field_id: string;
			value_id: string;
		}>;
		team_id?: string | null;
		project_id?: number | null;
		deadline?: string | null;
		follower_ids?: string[];
		requested_by_id?: string;
		archived?: boolean;
	}) {
		const story = await this.client.getStory(storyPublicId);
		if (!story)
			throw new Error(`Failed to retrieve Shortcut story with public ID: ${storyPublicId}`);

		// Build update params, mapping API field names where they differ
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
		if (updates.custom_fields !== undefined) updateParams.custom_fields = updates.custom_fields;
		if (updates.team_id !== undefined) updateParams.group_id = updates.team_id;
		if (updates.project_id !== undefined) updateParams.project_id = updates.project_id;
		if (updates.deadline !== undefined) updateParams.deadline = updates.deadline;
		if (updates.follower_ids !== undefined) updateParams.follower_ids = updates.follower_ids;
		if (updates.requested_by_id !== undefined)
			updateParams.requested_by_id = updates.requested_by_id;
		if (updates.archived !== undefined) updateParams.archived = updates.archived;

		const updatedStory = await this.client.updateStory(storyPublicId, updateParams);

		return this.toResult(`Updated story sc-${storyPublicId}. Story URL: ${updatedStory.app_url}`);
	}

	async uploadFileToStory(storyPublicId: number, filePath: string) {
		if (!storyPublicId) throw new Error("Story public ID is required");
		if (!filePath) throw new Error("File path is required");

		const story = await this.client.getStory(storyPublicId);
		if (!story)
			throw new Error(`Failed to retrieve Shortcut story with public ID: ${storyPublicId}`);

		const uploadedFile = await this.client.uploadFile(storyPublicId, filePath);

		if (!uploadedFile) throw new Error(`Failed to upload file to story sc-${storyPublicId}`);

		return this.toResult(
			`Uploaded file "${uploadedFile.name}" to story sc-${storyPublicId}. File ID is: ${uploadedFile.id}`,
		);
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
		const story = await this.client.getStory(storyPublicId);
		if (!story)
			throw new Error(`Failed to retrieve Shortcut story with public ID: ${storyPublicId}`);

		const relatedStory = await this.client.getStory(relatedStoryPublicId);
		if (!relatedStory)
			throw new Error(`Failed to retrieve Shortcut story with public ID: ${relatedStoryPublicId}`);

		let subjectStoryId = storyPublicId;
		let objectStoryId = relatedStoryPublicId;

		// Normalize "blocked by" and "duplicated by" to their inverse relationships
		if (relationshipType === "blocked by" || relationshipType === "duplicated by") {
			relationshipType = relationshipType === "blocked by" ? "blocks" : "duplicates";
			subjectStoryId = relatedStoryPublicId;
			objectStoryId = storyPublicId;
		}

		await this.client.addRelationToStory(subjectStoryId, objectStoryId, relationshipType);

		// Format message based on relationship type
		let message: string;
		if (relationshipType === "blocks") {
			message = `Marked sc-${subjectStoryId} as a blocker to sc-${objectStoryId}.`;
		} else if (relationshipType === "duplicates") {
			message = `Marked sc-${subjectStoryId} as a duplicate of sc-${objectStoryId}.`;
		} else {
			message = `Added a relationship between sc-${subjectStoryId} and sc-${objectStoryId}.`;
		}

		return this.toResult(message);
	}

	async addExternalLinkToStory(storyPublicId: number, externalLink: string) {
		const updatedStory = await this.client.addExternalLinkToStory(storyPublicId, externalLink);

		return this.toResult(
			`Added external link to story sc-${storyPublicId}. Story URL: ${updatedStory.app_url}`,
		);
	}

	async removeExternalLinkFromStory(storyPublicId: number, externalLink: string) {
		const updatedStory = await this.client.removeExternalLinkFromStory(storyPublicId, externalLink);

		return this.toResult(
			`Removed external link from story sc-${storyPublicId}. Story URL: ${updatedStory.app_url}`,
		);
	}

	async getStoriesByExternalLink(externalLink: string) {
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
		const updatedStory = await this.client.setStoryExternalLinks(storyPublicId, externalLinks);

		const linkCount = externalLinks.length;
		const message =
			linkCount === 0
				? `Removed all external links from story sc-${storyPublicId}`
				: `Set ${linkCount} external link${linkCount === 1 ? "" : "s"} on story sc-${storyPublicId}`;

		return this.toResult(`${message}. Story URL: ${updatedStory.app_url}`);
	}
}
