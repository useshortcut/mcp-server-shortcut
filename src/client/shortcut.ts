import type {
	ShortcutClient as BaseClient,
	CreateEpic,
	CreateIteration,
	CreateStoryComment,
	CreateStoryParams,
	Epic,
	Group,
	Iteration,
	IterationSlim,
	Member,
	MemberInfo,
	Project,
	Story,
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
	private teamCache: Cache<string, Group>;
	private workflowCache: Cache<number, Workflow>;
	private projectCache: Cache<number, Project>;

	constructor(private client: BaseClient) {
		this.userCache = new Cache();
		this.teamCache = new Cache();
		this.workflowCache = new Cache();
		this.projectCache = new Cache();
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

	private async loadTeams() {
		if (this.teamCache.isStale) {
			const response = await this.client.listGroups();
			const groups = response?.data ?? null;

			if (groups) {
				this.teamCache.setMany(groups.map((group) => [group.id, group]));
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

	private async loadProjects() {
		if (this.projectCache.isStale) {
			const response = await this.client.listProjects({});
			const projects = response?.data ?? null;

			if (projects) {
				this.projectCache.setMany(projects.map((project) => [project.id, project]));
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

	async getMember(userId: string) {
		await this.loadMembers();
		return this.userCache.get(userId) || null;
	}

	async getUserMap(userIds: string[]) {
		await this.loadMembers();
		return new Map(
			userIds
				.map((id) => [id, this.userCache.get(id)])
				.filter((user): user is [string, Member | null] => user[1] !== null),
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
				.filter((workflow): workflow is [number, Workflow | null] => workflow[1] !== null),
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
		await this.loadTeams();
		const teams: Group[] = Array.from(this.teamCache.values());

		return teams;
	}

	async getTeamMap(teamIds: string[]) {
		await this.loadTeams();
		return new Map(
			teamIds
				.map((id) => [id, this.teamCache.get(id)])
				.filter((team): team is [string, Group | null] => team[1] !== null),
		);
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

	async searchStories(query: string, limit = 25) {
		const response = await this.client.searchStories({ query, page_size: limit, detail: "full" });
		const stories = response?.data?.data;
		const total = response?.data?.total;

		if (!stories) return { stories: null, total: null };

		return { stories, total };
	}

	async searchIterations(query: string) {
		const response = await this.client.searchIterations({ query, page_size: 25, detail: "full" });
		const iterations = response?.data?.data;
		const total = response?.data?.total;

		if (!iterations) return { iterations: null, total: null };

		return { iterations, total };
	}

	async getActiveIteration(teamIds: string[]) {
		const response = await this.client.listIterations();
		const iterations = response?.data;

		if (!iterations) return new Map<string, IterationSlim[]>();

		const [today] = new Date().toISOString().split("T");
		const activeIterationByTeam = iterations.reduce((acc, iteration) => {
			if (iteration.status !== "started") return acc;
			const [startDate] = new Date(iteration.start_date).toISOString().split("T");
			const [endDate] = new Date(iteration.end_date).toISOString().split("T");
			if (!startDate || !endDate) return acc;
			if (startDate > today || endDate < today) return acc;

			if (!iteration.group_ids?.length) iteration.group_ids = ["none"];

			for (const groupId of iteration.group_ids) {
				if (groupId !== "none" && !teamIds.includes(groupId)) continue;
				const prevIterations = acc.get(groupId);
				if (prevIterations) {
					acc.set(groupId, prevIterations.concat([iteration]));
				} else acc.set(groupId, [iteration]);
			}

			return acc;
		}, new Map<string, IterationSlim[]>());

		return activeIterationByTeam;
	}

	async getUpcomingIteration(teamIds: string[]) {
		const response = await this.client.listIterations();
		const iterations = response?.data;

		if (!iterations) return new Map<string, IterationSlim[]>();

		const [today] = new Date().toISOString().split("T");
		const upcomingIterationByTeam = iterations.reduce((acc, iteration) => {
			if (iteration.status !== "unstarted") return acc;
			const [startDate] = new Date(iteration.start_date).toISOString().split("T");
			const [endDate] = new Date(iteration.end_date).toISOString().split("T");
			if (!startDate || !endDate) return acc;
			if (startDate < today) return acc;

			if (!iteration.group_ids?.length) iteration.group_ids = ["none"];

			for (const groupId of iteration.group_ids) {
				if (groupId !== "none" && !teamIds.includes(groupId)) continue;
				const prevIterations = acc.get(groupId);
				if (prevIterations) {
					acc.set(groupId, prevIterations.concat([iteration]));
				} else acc.set(groupId, [iteration]);
			}

			return acc;
		}, new Map<string, IterationSlim[]>());

		return upcomingIterationByTeam;
	}

	async searchEpics(query: string) {
		const response = await this.client.searchEpics({ query, page_size: 25, detail: "full" });
		const epics = response?.data?.data;
		const total = response?.data?.total;

		if (!epics) return { epics: null, total: null };

		return { epics, total };
	}

	async searchMilestones(query: string) {
		const response = await this.client.searchMilestones({ query, page_size: 25, detail: "full" });
		const milestones = response?.data?.data;
		const total = response?.data?.total;

		if (!milestones) return { milestones: null, total: null };

		return { milestones, total };
	}

	async listIterationStories(iterationPublicId: number, includeDescription = false) {
		const response = await this.client.listIterationStories(iterationPublicId, {
			includes_description: includeDescription,
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

	async addRelationToStory(
		storyPublicId: number,
		linkedStoryId: number,
		verb: "blocks" | "duplicates" | "relates to",
	): Promise<StoryLink> {
		const response = await this.client.createStoryLink({
			object_id: linkedStoryId,
			subject_id: storyPublicId,
			verb,
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

	async listProjects() {
		await this.loadProjects();
		const projects: Project[] = Array.from(this.projectCache.values());

		return projects;
	}

	async getProject(projectId: number) {
		const response = await this.client.getProject(projectId);
		const project = response?.data ?? null;

		if (!project) return null;

		return project;
	}

	async getProjectMap(projectIds: number[]) {
		await this.loadProjects();
		return new Map(
			projectIds
				.map((id) => [id, this.projectCache.get(id)])
				.filter((project): project is [number, Project | null] => project[1] !== null),
		);
	}

	async addExternalLinkToStory(storyPublicId: number, externalLink: string): Promise<Story> {
		const story = await this.getStory(storyPublicId);
		if (!story) throw new Error(`Story ${storyPublicId} not found`);

		const currentLinks = story.external_links || [];
		if (currentLinks.some((link) => link.toLowerCase() === externalLink.toLowerCase())) {
			return story;
		}

		const updatedLinks = [...currentLinks, externalLink];
		return await this.updateStory(storyPublicId, { external_links: updatedLinks });
	}

	async removeExternalLinkFromStory(storyPublicId: number, externalLink: string): Promise<Story> {
		const story = await this.getStory(storyPublicId);
		if (!story) throw new Error(`Story ${storyPublicId} not found`);

		const currentLinks = story.external_links || [];
		const updatedLinks = currentLinks.filter(
			(link) => link.toLowerCase() !== externalLink.toLowerCase(),
		);

		return await this.updateStory(storyPublicId, { external_links: updatedLinks });
	}

	async getStoriesByExternalLink(externalLink: string) {
		const response = await this.client.getExternalLinkStories({
			external_link: externalLink.toLowerCase(),
		});
		const stories = response?.data;

		if (!stories) return { stories: null, total: null };

		return { stories, total: stories.length };
	}

	async setStoryExternalLinks(storyPublicId: number, externalLinks: string[]): Promise<Story> {
		return await this.updateStory(storyPublicId, { external_links: externalLinks });
	}
}
