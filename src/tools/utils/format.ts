import type { Branch, Member, Story, StorySearchResult, Task, Workflow } from "@shortcut/client";

export const formatAsUnorderedList = (items: string[], label?: string) => {
	return `${label ? `${label}:` : ""}${items?.length ? `${label ? "\n" : ""}${items.map((item) => `- ${item}`).join("\n")}` : `${label ? " " : ""}[None]`}`;
};

export const formatStoryList = (
	stories: (Story | StorySearchResult)[],
	users: Map<string, Member>,
	label?: string,
) => {
	return formatAsUnorderedList(
		stories.map(
			(story) =>
				`sc-${story.id}: ${story.name} (Type: ${story.story_type}, State: ${story.completed ? "Completed" : story.started ? "In Progress" : "Not Started"}, Team: ${story.group_id ? `${story.group_id}` : "[None]"}, Epic: ${story.epic_id ? `${story.epic_id}` : "[None]"}, Iteration: ${story.iteration_id ? `${story.iteration_id}` : "[None]"}, Owners: ${
					story.owner_ids
						.map((ownerId) => users.get(ownerId))
						.filter((owner): owner is Member => owner !== null)
						.map((owner) => `@${owner.profile.mention_name}`)
						.join(", ") || "[None]"
				})`,
		),
		label,
	);
};

export const formatMemberList = (ids: string[], users: Map<string, Member>, label = "Members") => {
	return formatAsUnorderedList(
		(ids || []).map((id) => {
			const user = users.get(id);
			return user ? `id=${user.id} @${user.profile.mention_name}` : `id=${id} [Unknown]`;
		}),
		label,
	);
};

export const formatWorkflowList = (ids: number[], workflows: Map<number, Workflow>) => {
	return formatAsUnorderedList(
		(ids || [])
			.map((id) => workflows.get(id))
			.filter((workflow): workflow is Workflow => !!workflow)
			.map((workflow) => {
				const defaultState = workflow.states.find(
					(state) => state.id === workflow.default_state_id,
				);
				return `id=${workflow.id} name=${workflow.name}. Default state: ${defaultState ? `id=${defaultState.id} name=${defaultState.name}` : "[Unknown]"}`;
			}),
		"Workflows",
	);
};

export const formatPullRequestList = (branches: Branch[]) => {
	return formatAsUnorderedList(
		(branches || [])
			.flatMap((branch) => branch.pull_requests || [])
			.map((pr) => `Title: ${pr.title}, Merged: ${pr.merged ? "Yes" : "No"}, URL: ${pr.url}`),
		"Pull Requests",
	);
};

export const formatTaskList = (tasks: Task[]) => {
	return formatAsUnorderedList(
		(tasks || []).map((task) => `[${task.complete ? "X" : " "}] ${task.description}`),
		"Tasks",
	);
};
