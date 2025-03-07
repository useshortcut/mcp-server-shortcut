import { ShortcutClient as BaseClient, type Member } from "@shortcut/client";

export class ShortcutClient {
	private client: BaseClient;
	private userCache: Map<string, Member>;
	private userCacheAge: number;

	constructor(apiToken: string) {
		this.client = new BaseClient(apiToken);
		this.userCache = new Map();
		this.userCacheAge = 0;
	}

	private async loadMembers() {
		if (Date.now() - this.userCacheAge > 1000 * 60 * 5) {
			const response = await this.client.listMembers({});
			const members = response?.data ?? null;

			if (!members) return new Map();

			this.userCache = new Map(members.map((member) => [member.id, member]));
			this.userCacheAge = Date.now();
		}
	}

	async getCurrentUser() {
		const response = await this.client.getCurrentMemberInfo();
		const user = response?.data ?? null;

		if (!user) return null;

		return user;
	}

	async getUser(userId: string) {
		const response = await this.client.getMember(userId, {});
		const user = response?.data ?? null;

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
		const stories = response?.data ?? null;

		if (!stories) return { stories: null, total: null };

		return { stories, total: stories.length };
	}
}
