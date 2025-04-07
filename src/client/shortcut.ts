import type {
	ShortcutClient as BaseClient,
	CreateStoryComment,
	CreateStoryParams,
	Member,
	MemberInfo,
	StoryComment,
	UpdateStory,
	Workflow,
} from "@shortcut/client";
import { Cache } from "./cache";

/**
 * This is a thin wrapper over the official Shortcut API client.
 *
 * Its main reasons for existing are:
 * - Add a caching layer for common calls like fetching members or teams.
 * - Unwrap and simplify some response types.
 * - Only expose a subset of methods and a subset of the possible input parameters to those methods.
 */
export class ShortcutClientWrapper {
	private currentUser: MemberInfo | null = null;
	private userCache: Cache<string, Member>;
	private workflowCache: Cache<number, Workflow>;

	constructor(private client: BaseClient) {
		this.userCache = new Cache();
		this.workflowCache = new Cache();
	}

	private async loadMembers() {
		if (this.userCache.isStale) {
			const response = await this.client.listMembers({});
			const members = response?.data ?? null;

			if (members) {
				this.userCache.setMany(members.map((member) => [member.id, member]));
			}
		}
	}

	private async loadWorkflows() {
		if (this.workflowCache.isStale) {
			const response = await this.client.listWorkflows();
			const workflows = response?.data ?? null;

			if (workflows) {
				this.workflowCache.setMany(workflows.map((workflow) => [workflow.id, workflow]));
			}
		}
	}

	async getCurrentUser() {
		if (this.currentUser) return this.currentUser;

		const response = await this.client.getCurrentMemberInfo();
		const user = response?.data;

		if (!user) return null;

		this.currentUser = user;

		return user;
	}

	async getUser(userId: string) {
		const response = await this.client.getMember(userId, {});
		const user = response?.data;

		if (!user) return null;

		return user;
	}

	async getUserMap(userIds: string[]) {
		await this.loadMembers();
		return new Map(
			userIds
				.map((id) => [id, this.userCache.get(id)])
				.filter((user): user is [string, Member] => user[1] !== null),
		);
	}

	async getUsers(userIds: string[]) {
		await this.loadMembers();
		return userIds
			.map((id) => this.userCache.get(id))
			.filter((user): user is Member => user !== null);
	}

	async getWorkflowMap(workflowIds: number[]) {
		await this.loadWorkflows();
		return new Map(
			workflowIds
				.map((id) => [id, this.workflowCache.get(id)])
				.filter((workflow): workflow is [number, Workflow] => workflow[1] !== null),
		);
	}

	async getWorkflows() {
		await this.loadWorkflows();
		return Array.from(this.workflowCache.values());
	}

	async getWorkflow(workflowPublicId: number) {
		const response = await this.client.getWorkflow(workflowPublicId);
		const workflow = response?.data;

		if (!workflow) return null;

		return workflow;
	}

	async getTeams() {
		const response = await this.client.listGroups();
		const groups = response?.data ?? [];
		return groups;
	}

	async getTeam(teamPublicId: string) {
		const response = await this.client.getGroup(teamPublicId);
		const group = response?.data;

		if (!group) return null;

		return group;
	}

	async createStory(params: CreateStoryParams) {
		const response = await this.client.createStory(params);
		const story = response?.data ?? null;

		if (!story) throw new Error(`Failed to create the story: ${response.status}`);

		return story;
	}

	async updateStory(storyPublicId: number, params: UpdateStory) {
		const response = await this.client.updateStory(storyPublicId, params);
		const story = response?.data ?? null;

		if (!story) throw new Error(`Failed to update the story: ${response.status}`);

		return story;
	}

	async getStory(storyPublicId: number) {
		const response = await this.client.getStory(storyPublicId);
		const story = response?.data ?? null;

		if (!story) return null;

		return story;
	}

	async getEpic(epicPublicId: number) {
		const response = await this.client.getEpic(epicPublicId);
		const epic = response?.data ?? null;

		if (!epic) return null;

		return epic;
	}

	async getIteration(iterationPublicId: number) {
		const response = await this.client.getIteration(iterationPublicId);
		const iteration = response?.data ?? null;

		if (!iteration) return null;

		return iteration;
	}

	async getMilestone(milestonePublicId: number) {
		const response = await this.client.getMilestone(milestonePublicId);
		const milestone = response?.data ?? null;

		if (!milestone) return null;

		return milestone;
	}

	async searchStories(query: string) {
		const response = await this.client.searchStories({ query, page_size: 25, detail: "slim" });
		const stories = response?.data?.data;
		const total = response?.data?.total;

		if (!stories) return { stories: null, total: null };

		return { stories, total };
	}

	async searchIterations(query: string) {
		const response = await this.client.searchIterations({ query, page_size: 25, detail: "slim" });
		const iterations = response?.data?.data;
		const total = response?.data?.total;

		if (!iterations) return { iterations: null, total: null };

		return { iterations, total };
	}

	async searchEpics(query: string) {
		const response = await this.client.searchEpics({ query, page_size: 25, detail: "slim" });
		const epics = response?.data?.data;
		const total = response?.data?.total;

		if (!epics) return { epics: null, total: null };

		return { epics, total };
	}

	async searchMilestones(query: string) {
		const response = await this.client.searchMilestones({ query, page_size: 25, detail: "slim" });
		const milestones = response?.data?.data;
		const total = response?.data?.total;

		if (!milestones) return { milestones: null, total: null };

		return { milestones, total };
	}

	async listIterationStories(iterationPublicId: number) {
		const response = await this.client.listIterationStories(iterationPublicId, {
			includes_description: false,
		});
		const stories = response?.data;

		if (!stories) return { stories: null, total: null };

		return { stories, total: stories.length };
	}

	/**
	 * Create story comment using public ID.
	 *
	 * @param storyPublicId - The public ID of the story to comment on.
	 * @param comment - The comment to add to the story.
	 * @param authorId - The ID of the author of the comment. If not, the current user will be used from SHORTCUT_API_TOKEN.
	 *
	 * @returns {Promise<StoryComment>} The created story comment.
	 */
	async createStoryComment(
		storyPublicId: number,
		comment: string,
		authorId?: string,
	): Promise<StoryComment> {
		const createStoryCommentParams = {
			text: comment,
		} as CreateStoryComment;

		if (authorId) {
			const author = await this.getUser(authorId);
			if (!author) throw new Error(`User with ID ${authorId} not found`);

			createStoryCommentParams.author_id = author.id;
		}

		const response = await this.client.createStoryComment(storyPublicId, createStoryCommentParams);
		const storyComment = response?.data ?? null;

		if (!storyComment) throw new Error(`Failed to create the comment: ${response.status}`);

		return storyComment;
	}
}
