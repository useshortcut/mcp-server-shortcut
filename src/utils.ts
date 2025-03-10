import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Member, Story, StorySearchResult } from "@shortcut/client";

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
