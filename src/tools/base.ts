import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type {
	Epic,
	EpicSearchResult,
	Group,
	Iteration,
	IterationSlim,
	Member,
	Milestone,
	MilestoneSearchResult,
	Story,
	StorySearchResult,
	StorySlim,
	Workflow,
} from "@shortcut/client";

/**
 * Base class for all tools.
 */
export class BaseTools {
	constructor(protected client: ShortcutClientWrapper) {}

	private async correctMember(entity: Member | null | undefined) {
		if (!entity) return null;
		const {
			id,
			disabled,
			role,
			profile: { name, email_address, mention_name },
		} = entity;
		return { id, name, email_address, mention_name, role, disabled };
	}

	private async correctWorkflow(entity: Workflow | null | undefined) {
		if (!entity) return null;
		const { team_id, ...withoutTeam } = entity;
		return { ...withoutTeam };
	}

	private async correctTeam(entity: Group | null | undefined) {
		if (!entity) return null;
		const { member_ids, workflow_ids, ...withoutIds } = entity;

		const users = await this.client.getUserMap(member_ids);
		const workflows = await this.client.getWorkflowMap(workflow_ids);

		const correctedEntity = {
			...withoutIds,
			members: member_ids
				.map((id) => this.correctMember(users.get(id)))
				.filter((user) => user !== null),
			workflows: workflow_ids
				.map((id) => this.correctWorkflow(workflows.get(id)))
				.filter((workflow) => workflow !== null),
		};

		return correctedEntity;
	}

	private async correctIteration(entity: Iteration | null | undefined) {
		if (!entity) return null;
		const { group_ids, ...withoutGroupIds } = entity;

		const teams = await this.client.getTeamMap(
			group_ids?.filter((id): id is string => id !== null),
		);

		const correctedEntity = {
			...withoutGroupIds,
			teams:
				group_ids?.map((id) => this.correctTeam(teams.get(id)))?.filter((team) => team !== null) ??
				[],
		};

		return correctedEntity;
	}

	private async correctMilestone(entity: Milestone) {
		return entity;
	}

	private async correctEpic(entity: Epic) {
		const { group_id, owner_ids, requested_by_id, follower_ids, ...withoutIds } = entity;

		const users = await this.client.getUserMap([
			...new Set([...owner_ids, requested_by_id, ...follower_ids]),
		]);
		const teams = await this.client.getTeamMap(group_id ? [group_id] : []);

		const correctedEntity = {
			...withoutIds,
			owners:
				owner_ids
					?.map((id) => this.correctMember(users.get(id)))
					?.filter((user) => user !== null) ?? [],
			requested_by: requested_by_id ? this.correctMember(users.get(requested_by_id)) : null,
			followers:
				follower_ids
					?.map((id) => this.correctMember(users.get(id)))
					?.filter((user) => user !== null) ?? [],
			team: group_id ? this.correctTeam(teams.get(group_id)) : null,
		};

		return correctedEntity;
	}

	private async correctStory(entity: Story) {
		const { group_id, owner_ids, requested_by_id, follower_ids, workflow_id, ...withoutIds } =
			entity;

		const users = await this.client.getUserMap([
			...new Set([...owner_ids, requested_by_id, ...follower_ids]),
		]);
		const teams = await this.client.getTeamMap(group_id ? [group_id] : []);
		const workflows = await this.client.getWorkflowMap(workflow_id ? [workflow_id] : []);

		const correctedEntity = {
			...withoutIds,
			owners:
				owner_ids
					?.map((id) => this.correctMember(users.get(id)))
					?.filter((user) => user !== null) ?? [],
			requested_by: requested_by_id ? this.correctMember(users.get(requested_by_id)) : null,
			followers:
				follower_ids
					?.map((id) => this.correctMember(users.get(id)))
					?.filter((user) => user !== null) ?? [],
			team: group_id ? this.correctTeam(teams.get(group_id)) : null,
			workflow: workflow_id ? this.correctWorkflow(workflows.get(workflow_id)) : null,
		};

		return correctedEntity;
	}

	protected async toCorrectedEntity(
		entity:
			| Story
			| StorySearchResult
			| StorySlim
			| Epic
			| EpicSearchResult
			| Iteration
			| IterationSlim
			| Group
			| Workflow
			| MilestoneSearchResult
			| Milestone,
	) {
		if (entity.entity_type === "workflow") return this.correctWorkflow(entity as Workflow);
		if (entity.entity_type === "team") return this.correctTeam(entity as Group);
		if (entity.entity_type === "iteration") return this.correctIteration(entity as Iteration);
		if (entity.entity_type === "milestone") return this.correctMilestone(entity as Milestone);
		if (entity.entity_type === "epic") return this.correctEpic(entity as Epic);
		if (entity.entity_type === "story") return this.correctStory(entity as Story);

		return entity;
	}

	protected async toCorrectedEntities(
		entities: (
			| Story
			| StorySearchResult
			| StorySlim
			| Epic
			| EpicSearchResult
			| Iteration
			| IterationSlim
			| Group
			| Workflow
			| MilestoneSearchResult
			| Milestone
		)[],
	) {
		return Promise.all(entities.map((entity) => this.toCorrectedEntity(entity)));
	}

	protected toResult(message: string, data?: unknown): CallToolResult {
		return {
			content: [
				{
					type: "text",
					text: `${message}${data !== undefined ? `\n\n${JSON.stringify(data, null, 2)}` : ""}`,
				},
			],
		};
	}
}
