import type {
	ShortcutClient as BaseClient,
	CreateStoryParams,
	Member,
	MemberInfo,
	UpdateStory,
	Workflow,
} from "@shortcut/client";
import { Cache } from "./cache";

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
		const allStories = [];
		let next: string | undefined = undefined;
		const pageSize = 25;

		do {
			// Fix for @shortcut/client bug: searchStories sends params as body instead of query
			// We need to manually call the request method with correct parameters
			const response = await (this.client as any).request({
				path: `/api/v3/search/stories`,
				method: "GET",
				query: {
					query,
					page_size: pageSize,
					detail: "slim",
					...(next && { next }),
				},
				secure: true,
				format: "json",
			});

			const stories = response?.data?.data;
			next = response?.data?.next || undefined;

			if (!stories) return { stories: null, total: null };

			allStories.push(...stories);
		} while (next);

		return { stories: allStories, total: allStories.length };
	}

	async searchIterations(query: string) {
		const allIterations = [];
		let next: string | undefined = undefined;
		const pageSize = 25;

		do {
			// Fix for @shortcut/client bug: searchIterations sends params as body instead of query
			// We need to manually call the request method with correct parameters
			const response = await (this.client as any).request({
				path: `/api/v3/search/iterations`,
				method: "GET",
				query: {
					query,
					page_size: pageSize,
					detail: "slim",
					...(next && { next }),
				},
				secure: true,
				format: "json",
			});

			const iterations = response?.data?.data;
			next = response?.data?.next || undefined;

			if (!iterations) return { iterations: null, total: null };

			allIterations.push(...iterations);
		} while (next);

		return { iterations: allIterations, total: allIterations.length };
	}

	async searchEpics(query: string) {
		const allEpics = [];
		let next: string | undefined = undefined;
		const pageSize = 25;

		do {
			// Fix for @shortcut/client bug: searchEpics sends params as body instead of query
			// We need to manually call the request method with correct parameters
			const response = await (this.client as any).request({
				path: `/api/v3/search/epics`,
				method: "GET",
				query: {
					query,
					page_size: pageSize,
					detail: "slim",
					...(next && { next }),
				},
				secure: true,
				format: "json",
			});

			const epics = response?.data?.data;
			next = response?.data?.next || undefined;

			if (!epics) return { epics: null, total: null };

			allEpics.push(...epics);
		} while (next);

		return { epics: allEpics, total: allEpics.length };
	}

	async searchMilestones(query: string) {
		const allMilestones = [];
		let next: string | undefined = undefined;
		const pageSize = 25;

		do {
			// Fix for @shortcut/client bug: searchMilestones sends params as body instead of query
			// We need to manually call the request method with correct parameters
			const response = await (this.client as any).request({
				path: `/api/v3/search/milestones`,
				method: "GET",
				query: {
					query,
					page_size: pageSize,
					detail: "slim",
					...(next && { next }),
				},
				secure: true,
				format: "json",
			});

			const milestones = response?.data?.data;
			next = response?.data?.next || undefined;

			if (!milestones) return { milestones: null, total: null };

			allMilestones.push(...milestones);
		} while (next);

		return { milestones: allMilestones, total: allMilestones.length };
	}

	async listIterationStories(iterationPublicId: number) {
		const response = await this.client.listIterationStories(iterationPublicId, {
			includes_description: false,
		});
		const stories = response?.data;

		if (!stories) return { stories: null, total: null };

		return { stories, total: stories.length };
	}
}
