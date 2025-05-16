import type {
	ShortcutClient as BaseClient,
	CreateEpic,
	CreateIteration,
	CreateStoryComment,
	CreateStoryParams,
	Epic,
	Iteration,
	Member,
	MemberInfo,
	StoryComment,
	StoryLink,
	Task,
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

	async listMembers() {
		await this.loadMembers();
		const members: Member[] = Array.from(this.userCache.values());

		return members;
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

	async createStoryComment(
		storyPublicId: number,
		params: CreateStoryComment,
	): Promise<StoryComment> {
		const response = await this.client.createStoryComment(storyPublicId, params);
		const storyComment = response?.data ?? null;

		if (!storyComment) throw new Error(`Failed to create the comment: ${response.status}`);

		return storyComment;
	}

	async createIteration(params: CreateIteration): Promise<Iteration> {
		const response = await this.client.createIteration(params);
		const iteration = response?.data ?? null;

		if (!iteration) throw new Error(`Failed to create the iteration: ${response.status}`);

		return iteration;
	}

	async createEpic(params: CreateEpic): Promise<Epic> {
		const response = await this.client.createEpic(params);
		const epic = response?.data ?? null;

		if (!epic) throw new Error(`Failed to create the epic: ${response.status}`);

		return epic;
	}

	async addTaskToStory(
		storyPublicId: number,
		taskParams: {
			description: string;
			ownerIds?: string[];
		},
	): Promise<Task> {
		const { description, ownerIds } = taskParams;

		const params = {
			description,
			owner_ids: ownerIds,
		};

		const response = await this.client.createTask(storyPublicId, params);
		const task = response?.data ?? null;

		if (!task) throw new Error(`Failed to create the task: ${response.status}`);

		return task;
	}

	async addRelationToStory(storyPublicId: number, linkedStoryId: number): Promise<StoryLink> {
		const response = await this.client.createStoryLink({
			object_id: linkedStoryId,
			subject_id: storyPublicId,
			verb: "relates to",
		});
		const storyLink = response?.data ?? null;

		if (!storyLink) throw new Error(`Failed to create the story links: ${response.status}`);

		return storyLink;
	}

	async getTask(storyPublicId: number, taskPublicId: number): Promise<Task> {
		const response = await this.client.getTask(storyPublicId, taskPublicId);
		const task = response?.data ?? null;

		if (!task) throw new Error(`Failed to get the task: ${response.status}`);
		return task;
	}

	async updateTask(
		storyPublicId: number,
		taskPublicId: number,
		taskParams: {
			description?: string;
			ownerIds?: string[];
			isCompleted?: boolean;
		},
	): Promise<Task> {
		const { description, ownerIds } = taskParams;

		const params = {
			description,
			owner_ids: ownerIds,
			complete: taskParams.isCompleted,
		};

		const response = await this.client.updateTask(storyPublicId, taskPublicId, params);
		const task = response?.data ?? null;

		if (!task) throw new Error(`Failed to update the task: ${response.status}`);

		return task;
	}
}
