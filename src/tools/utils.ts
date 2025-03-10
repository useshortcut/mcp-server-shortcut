import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Member, Story, StorySearchResult, Workflow } from "@shortcut/client";

export const toResult = (content: string): CallToolResult => ({
	content: [{ type: "text", text: content }],
});

export const formatStoryList = (
	stories: (Story | StorySearchResult)[],
	users: Map<string, Member>,
) => {
	return stories
		.map(
			(story) =>
				`- sc-${story.id}: ${story.name} (Type: ${story.story_type}, State: ${story.completed ? "Completed" : story.started ? "In Progress" : "Not Started"}, Owners: ${story.owner_ids
					.map((ownerId) => users.get(ownerId))
					.filter((owner): owner is Member => owner !== null)
					.map((owner) => `@${owner.profile.mention_name}`)
					.join(", ")})`,
		)
		.join("\n");
};

export const formatMemberList = (
	ids: string[],
	users: Map<string, Member>,
) => {
	return ids
		.map(id => users.get(id))
		.filter((user): user is Member => !!user)
		.map(
			(user) =>
				`- ${user.id}: ${user.profile.mention_name}`,
		)
		.join("\n");
};


export const formatWorkflowList = (
	ids: number[],
	workflows: Map<number, Workflow>,
) => {
	return ids
		.map(id => workflows.get(id))
		.filter((workflow): workflow is Workflow => !!workflow)
		.map(
			(workflow) =>
				`- ${workflow.id}: ${workflow.name}, default state: ${workflow.states.find((state) => state.id === workflow.default_state_id)?.name || '[Unknown]'}`,
		)
		.join("\n");
};
