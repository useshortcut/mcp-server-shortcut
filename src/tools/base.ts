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
import type { ShortcutClientWrapper } from "@/client/shortcut";

// Simplified types for related entities
type SimplifiedMember = {
	id: string;
	email_address: string | null | undefined;
	mention_name: string;
	name: string | null | undefined;
	role: string;
	disabled: boolean;
	is_owner: boolean;
};
type SimplifiedWorkflow = {
	id: number;
	name: string;
	states: { id: number; name: string; type: string }[];
};
type SimplifiedTeam = {
	id: string;
	name: string;
	archived: boolean;
	mention_name: string;
	member_ids: string[];
	workflow_ids: number[];
};
type SimplifiedObjective = {
	id: number;
	name: string;
	app_url: string;
	archived: boolean;
	state: string;
	categories: string[];
};
type SimplifiedEpic = {
	id: number;
	name: string;
	app_url: string;
	archived: boolean;
	state: string;
	team_id: string | null;
	objective_id: number | null;
};
type SimplifiedIteration = {
	id: number;
	name: string;
	app_url: string;
	team_ids: string[];
	status: string;
	start_date: string;
	end_date: string;
};
type SimplifiedStory = {
	id: number;
	name: string;
	app_url: string;
	archived: boolean;
	team_id: string | null;
	epic_id: number | null;
	iteration_id: number | null;
	workflow_id: number | null;
	workflow_state_id: number;
	owner_ids: string[];
	requested_by_id: string | null;
};

/**
 * Base class for all tools.
 */
export class BaseTools {
	constructor(protected client: ShortcutClientWrapper) {}

	private renameEntityProps<T extends Record<string, unknown>>(entity: T) {
		if (!entity || typeof entity !== "object") return entity;
		const renames = [
			["team_id", null], // This is the "team_id" in a workflow. Different from "group_id"
			["entity_type", null],
			["group_id", "team_id"],
			["group_ids", "team_ids"],
			["milestone_id", "objective_id"],
			["milestone_ids", "objective_ids"],
		] as const;

		for (const [from, to] of renames) {
			if (from in entity) {
				const value = entity[from];
				delete entity[from];

				if (to) entity = { ...entity, [to]: value };
			}
		}
		return entity;
	}

	private mergeRelatedEntities<T extends Record<string, object>>(relatedEntities: T[]): T {
		return relatedEntities.reduce(
			(acc, obj) => {
				if (!obj) return acc;
				for (const [key, value] of Object.entries(obj)) {
					acc[key] = { ...(acc[key] || {}), ...value };
				}
				return acc;
			},
			{} as Record<string, object>,
		) as T;
	}

	private getSimplifiedMember(entity: Member | null | undefined): SimplifiedMember | null {
		if (!entity) return null;
		const {
			id,
			disabled,
			role,
			profile: { is_owner, name, email_address, mention_name },
		} = entity;
		return { id, name, email_address, mention_name, role, disabled, is_owner };
	}

	private getSimplifiedStory(entity: Story | null | undefined): SimplifiedStory | null {
		if (!entity) return null;
		const {
			id,
			name,
			app_url,
			archived,
			group_id,
			epic_id,
			iteration_id,
			workflow_id,
			workflow_state_id,
			owner_ids,
			requested_by_id,
		} = entity;
		return {
			id,
			name,
			app_url,
			archived,
			team_id: group_id || null,
			epic_id: epic_id || null,
			iteration_id: iteration_id || null,
			workflow_id,
			workflow_state_id,
			owner_ids,
			requested_by_id,
		};
	}

	private getSimplifiedWorkflow(entity: Workflow | null | undefined): SimplifiedWorkflow | null {
		if (!entity) return null;
		const { id, name, states } = entity;
		return {
			id,
			name,
			states: states.map((state) => ({ id: state.id, name: state.name, type: state.type })),
		};
	}

	private getSimplifiedTeam(entity: Group | null | undefined): SimplifiedTeam | null {
		if (!entity) return null;
		const { archived, id, name, mention_name, member_ids, workflow_ids } = entity;
		return { id, name, archived, mention_name, member_ids, workflow_ids };
	}

	private getSimplifiedObjective(entity: Milestone | null | undefined): SimplifiedObjective | null {
		if (!entity) return null;
		const { app_url, id, name, archived, state, categories } = entity;
		return { app_url, id, name, archived, state, categories: categories.map((cat) => cat.name) };
	}

	private getSimplifiedEpic(entity: Epic | null | undefined): SimplifiedEpic | null {
		if (!entity) return null;
		const { id, name, app_url, archived, group_id, state, milestone_id } = entity;
		return {
			id,
			name,
			app_url,
			archived,
			state,
			team_id: group_id || null,
			objective_id: milestone_id || null,
		};
	}

	private getSimplifiedIteration(entity: Iteration | null | undefined): SimplifiedIteration | null {
		if (!entity) return null;
		const { id, name, app_url, group_ids, status, start_date, end_date } = entity;
		return { id, name, app_url, team_ids: group_ids, status, start_date, end_date };
	}

	private async getRelatedEntitiesForTeam(entity: Group | null | undefined): Promise<{
		users: Record<string, SimplifiedMember>;
		workflows: Record<string, SimplifiedWorkflow>;
	}> {
		if (!entity) return { users: {}, workflows: {} };
		const { member_ids, workflow_ids } = entity;

		const users = await this.client.getUserMap(member_ids);
		const workflows = await this.client.getWorkflowMap(workflow_ids);

		return {
			users: Object.fromEntries(
				member_ids
					.map((id) => this.getSimplifiedMember(users.get(id)))
					.filter((member): member is SimplifiedMember => member !== null)
					.map((member) => [member.id, member]),
			),
			workflows: Object.fromEntries(
				workflow_ids
					.map((id) => this.getSimplifiedWorkflow(workflows.get(id)))
					.filter((workflow): workflow is SimplifiedWorkflow => workflow !== null)
					.map((workflow) => [workflow.id, workflow]),
			),
		};
	}

	private async getRelatedEntitiesForIteration(entity: Iteration | null | undefined): Promise<{
		teams: Record<string, SimplifiedTeam>;
		users: Record<string, SimplifiedMember>;
		workflows: Record<string, SimplifiedWorkflow>;
	}> {
		if (!entity) return { teams: {}, users: {}, workflows: {} };
		const { group_ids } = entity;

		const teams = await this.client.getTeamMap(group_ids || []);
		const relatedEntitiesForTeams = await Promise.all(
			Array.from(teams.values()).map((team) => this.getRelatedEntitiesForTeam(team)),
		);
		const { users, workflows } = this.mergeRelatedEntities(relatedEntitiesForTeams);

		return {
			teams: Object.fromEntries(
				[...teams.entries()]
					.map(([id, team]) => [id, this.getSimplifiedTeam(team)])
					.filter(([_, team]) => !!team),
			) as Record<string, SimplifiedTeam>,
			users,
			workflows,
		};
	}

	private async getRelatedEntitiesForEpic(entity: Epic | null | undefined): Promise<{
		users: Record<string, SimplifiedMember>;
		workflows: Record<string, SimplifiedWorkflow>;
		teams: Record<string, SimplifiedTeam>;
		objectives: Record<string, SimplifiedObjective>;
	}> {
		if (!entity) return { users: {}, workflows: {}, teams: {}, objectives: {} };
		const { group_id, owner_ids, milestone_id, requested_by_id, follower_ids } = entity;

		const usersForEpicMap = await this.client.getUserMap([
			...new Set([...(owner_ids || []), requested_by_id, ...(follower_ids || [])].filter(Boolean)),
		]);
		const usersForEpic = Object.fromEntries(
			[...usersForEpicMap.entries()]
				.filter(([_, user]) => !!user)
				.map(([id, user]) => [id, this.getSimplifiedMember(user)]),
		) as Record<string, SimplifiedMember>;
		const teams = await this.client.getTeamMap(group_id ? [group_id] : []);
		const team = this.getSimplifiedTeam(teams.get(group_id || ""));
		const { users, workflows } = await this.getRelatedEntitiesForTeam(teams.get(group_id || ""));
		const milestone = this.getSimplifiedObjective(
			milestone_id ? await this.client.getMilestone(milestone_id) : null,
		);

		return {
			users: this.mergeRelatedEntities([usersForEpic, users]),
			teams: team ? { [team.id]: team } : {},
			objectives: milestone ? { [milestone.id]: milestone } : {},
			workflows,
		};
	}

	private async getRelatedEntitiesForStory(entity: Story): Promise<{
		users: Record<string, SimplifiedMember>;
		workflows: Record<string, SimplifiedWorkflow>;
		teams: Record<string, SimplifiedTeam>;
		objectives: Record<string, SimplifiedObjective>;
		iterations: Record<string, SimplifiedIteration>;
		epics: Record<string, SimplifiedEpic>;
	}> {
		const {
			group_id,
			iteration_id,
			epic_id,
			owner_ids,
			requested_by_id,
			follower_ids,
			workflow_id,
		} = entity;

		const fullUsersForStory = await this.client.getUserMap([
			...new Set([...(owner_ids || []), requested_by_id, ...(follower_ids || [])].filter(Boolean)),
		]);
		const usersForStory = Object.fromEntries(
			[...fullUsersForStory.entries()]
				.filter(([_, user]) => !!user)
				.map(([id, user]) => [id, this.getSimplifiedMember(user)]),
		) as Record<string, SimplifiedMember>;
		const teamsForStory = await this.client.getTeamMap(group_id ? [group_id] : []);
		const workflowsForStory = await this.client.getWorkflowMap(workflow_id ? [workflow_id] : []);
		const iteration = iteration_id ? await this.client.getIteration(iteration_id) : null;
		const simplifiedIteration = this.getSimplifiedIteration(iteration);
		const epic = epic_id ? await this.client.getEpic(epic_id) : null;
		const simplifiedEpic = this.getSimplifiedEpic(epic);

		const teamForStory = teamsForStory.get(group_id || "");
		const workflowForStory = this.getSimplifiedWorkflow(workflowsForStory.get(workflow_id));

		const { users: usersForTeam, workflows: workflowsForTeam } =
			await this.getRelatedEntitiesForTeam(teamForStory);
		const {
			users: usersForIteration,
			workflows: workflowsForIteration,
			teams: teamsForIteration,
		} = await this.getRelatedEntitiesForIteration(iteration);
		const {
			users: usersForEpic,
			workflows: workflowsForEpic,
			teams: teamsForEpic,
			objectives,
		} = await this.getRelatedEntitiesForEpic(epic);

		const users = this.mergeRelatedEntities([
			usersForTeam,
			usersForStory,
			usersForIteration,
			usersForEpic,
		]);
		const workflows = this.mergeRelatedEntities([
			workflowsForTeam,
			workflowsForIteration,
			workflowsForEpic,
			workflowForStory ? { [workflowForStory.id]: workflowForStory } : {},
		]);
		const teams = this.mergeRelatedEntities([
			teamsForIteration,
			teamsForEpic,
			teamForStory ? { [teamForStory.id]: teamForStory } : {},
		]);
		const epics = simplifiedEpic ? { [simplifiedEpic.id]: simplifiedEpic } : {};
		const iterations = simplifiedIteration ? { [simplifiedIteration.id]: simplifiedIteration } : {};

		return {
			users,
			epics,
			iterations,
			workflows,
			teams,
			objectives,
		};
	}

	private async getRelatedEntities(
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
		if (entity.entity_type === "group") return this.getRelatedEntitiesForTeam(entity as Group);
		if (entity.entity_type === "iteration")
			return this.getRelatedEntitiesForIteration(entity as Iteration);
		if (entity.entity_type === "epic") return this.getRelatedEntitiesForEpic(entity as Epic);
		if (entity.entity_type === "story") return this.getRelatedEntitiesForStory(entity as Story);

		return {};
	}

	private getSimplifiedEntity(
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
		if (entity.entity_type === "group") return this.getSimplifiedTeam(entity as Group);
		if (entity.entity_type === "iteration") return this.getSimplifiedIteration(entity as Iteration);
		if (entity.entity_type === "epic") return this.getSimplifiedEpic(entity as Epic);
		if (entity.entity_type === "story") return this.getSimplifiedStory(entity as Story);
		if (entity.entity_type === "milestone") return this.getSimplifiedObjective(entity as Milestone);
		if (entity.entity_type === "workflow") return this.getSimplifiedWorkflow(entity as Workflow);

		return entity;
	}

	protected async entityWithRelatedEntities(
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
		entityType = "entity",
	) {
		const relatedEntities = await this.getRelatedEntities(entity);
		return {
			[entityType]: this.renameEntityProps(entity as unknown as Record<string, unknown>),
			relatedEntities,
		};
	}

	protected async entitiesWithRelatedEntities(
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
		entityType = "entities",
	) {
		const relatedEntities = await Promise.all(
			entities.map((entity) => this.getRelatedEntities(entity)),
		);
		return {
			[entityType]: entities.map((entity) => this.getSimplifiedEntity(entity)),
			relatedEntities: this.mergeRelatedEntities(relatedEntities),
		};
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
