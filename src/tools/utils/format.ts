import type { Branch, Member, Story, StorySearchResult, Task, Workflow } from "@shortcut/client";

export const formatStoryList = (
	stories: (Story | StorySearchResult)[],
	users: Map<string, Member>,
) => {
	return stories
		.map(
			(story) =>
				`- sc-${story.id}: ${story.name} (Type: ${story.story_type}, State: ${story.completed ? "Completed" : story.started ? "In Progress" : "Not Started"}, Team: ${story.group_id ? `${story.group_id}` : "[None]"}, Epic: ${story.epic_id ? `${story.epic_id}` : "[None]"}, Iteration: ${story.iteration_id ? `${story.iteration_id}` : "[None]"}, Owners: ${
					story.owner_ids
						.map((ownerId) => users.get(ownerId))
						.filter((owner): owner is Member => owner !== null)
						.map((owner) => `@${owner.profile.mention_name}`)
						.join(", ") || "[None]"
				})`,
		)
		.join("\n");
};

export const formatMemberList = (ids: string[], users: Map<string, Member>) => {
	return ids
		.map((id) => {
			const user = users.get(id);
			return user ? `- id=${user.id} @${user.profile.mention_name}` : `- id=${id} [Unknown]`;
		})
		.join("\n");
};

export const formatWorkflowList = (ids: number[], workflows: Map<number, Workflow>) => {
	return ids
		.map((id) => workflows.get(id))
		.filter((workflow): workflow is Workflow => !!workflow)
		.map((workflow) => {
			const defaultState = workflow.states.find((state) => state.id === workflow.default_state_id);
			return `- id=${workflow.id} name=${workflow.name}. Default state: ${
				defaultState ? `id=${defaultState.id} name=${defaultState.name}` : "[Unknown]"
			}`;
		})
		.join("\n");
};

export const formatPullRequestList = (branches: Branch[]) => {
	return branches
		.flatMap((branch) => branch.pull_requests || [])
		.map((pr) => {
			return `- Title: ${pr.title}, Merged: ${pr.merged ? "Yes" : "No"}, URL: ${pr.url}`;
		})
		.join("\n");
};

export const formatTaskList = (tasks: Task[]) => {
	return tasks
		.map((task) => {
			return `- ${task.complete ? "[X]" : "[ ]"} ${task.description}`;
		})
		.join("\n");
};
