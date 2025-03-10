import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ShortcutClient } from "./shortcut-client";
import type { Member, Story, StorySearchResult } from "@shortcut/client";

const toResult = (content: string): CallToolResult => ({
	content: [{ type: "text", text: content }],
});

export class ShortcutMcpClient {
	private client: ShortcutClient;

	constructor(apiToken: string) {
		this.client = new ShortcutClient(apiToken);
	}

	private async _getStory(storyPublicId: number) {
		const story = await this.client.getStory(storyPublicId);

		if (!story)
			throw new Error(`Failed to retrieve Shortcut story with public ID: ${storyPublicId}.`);

		const owners = await this.client.getUsers(story.owner_ids);

		return `Story: sc-${storyPublicId}
Name: ${story.name}
Type: ${story.story_type}
Archived: ${story.archived ? "Yes" : "No"}
Completed: ${story.completed ? "Yes" : "No"}
Started: ${story.started ? "Yes" : "No"}
Blocked: ${story.blocked ? "Yes" : "No"}
Blocking: ${story.blocker ? "Yes" : "No"}
Due date: ${story.deadline}
Owners: ${owners.map((owner) => `@${owner.profile.mention_name}`).join(", ")}

Description:
${story.description}

Comments:
${(story.comments || []).map((comment) => `- From: ${comment.author_id} on ${comment.created_at}.\n${comment.text || ""}`).join("\n\n")}
`;
	}

	private formatStoryList(stories: (Story | StorySearchResult)[], users: Map<string, Member>) {
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
	}

	private async _searchStories(query: string) {
		const { stories, total } = await this.client.searchStories(query);

		if (!stories) throw new Error(`Failed to search for stories matching your query: "${query}".`);
		if (!stories.length) return `Result: No stories found.`;

		const users = await this.client.getUserMap(stories.flatMap((story) => story.owner_ids));

		return `Result (first ${stories.length} shown of ${total} total stories found):
${this.formatStoryList(stories, users)}`;
	}

	private async _getIterationStories(iterationPublicId: number) {
		const { stories } = await this.client.listIterationStories(iterationPublicId);

		if (!stories)
			throw new Error(
				`Failed to retrieve Shortcut stories in iteration with public ID: ${iterationPublicId}.`,
			);

		const owners = await this.client.getUserMap(stories.flatMap((story) => story.owner_ids));

		return `Result (${stories.length} stories found):
${this.formatStoryList(stories, owners)}`;
	}

	private async _searchIterations(query: string) {
		const { iterations, total } = await this.client.searchIterations(query);

		if (!iterations)
			throw new Error(`Failed to search for iterations matching your query: "${query}".`);
		if (!iterations.length) return `Result: No iterations found.`;

		return `Result (first ${iterations.length} shown of ${total} total iterations found):
${iterations.map((iteration) => `- ${iteration.id}: ${iteration.name} (Start date: ${iteration.start_date}, End date: ${iteration.end_date})`).join("\n")}`;
	}

	async _getIteration(iterationPublicId: number) {
		const iteration = await this.client.getIteration(iterationPublicId);

		if (!iteration)
			throw new Error(
				`Failed to retrieve Shortcut iteration with public ID: ${iterationPublicId}.`,
			);

		return `Iteration: ${iterationPublicId}
Name: ${iteration.name}
Start date: ${iteration.start_date}
End date: ${iteration.end_date}
Completed: ${iteration.status === "completed" ? "Yes" : "No"}
Started: ${iteration.status === "started" ? "Yes" : "No"}

Description:
${iteration.description}

`;
	}

	private async _searchEpics(query: string) {
		const { epics, total } = await this.client.searchEpics(query);

		if (!epics) throw new Error(`Failed to search for epics matching your query: "${query}"`);
		if (!epics.length) return `Result: No epics found.`;

		return `Result (first ${epics.length} shown of ${total} total epics found):
${epics.map((epic) => `- ${epic.id}: ${epic.name}`).join("\n")}`;
	}

	private async _getEpic(epicPublicId: number) {
		const epic = await this.client.getEpic(epicPublicId);

		if (!epic) throw new Error(`Failed to retrieve Shortcut epic with public ID: ${epicPublicId}`);

		return `Epic: ${epicPublicId}
Name: ${epic.name}
Archived: ${epic.archived ? "Yes" : "No"}
Completed: ${epic.completed ? "Yes" : "No"}
Started: ${epic.started ? "Yes" : "No"}
Due date: ${epic.deadline}

Description:
${epic.description}
`;
	}

	private async _searchObjectives(query: string) {
		const { milestones, total } = await this.client.searchMilestones(query);

		if (!milestones)
			throw new Error(`Failed to search for milestones matching your query: "${query}"`);
		if (!milestones.length) return `Result: No milestones found.`;

		return `Result (first ${milestones.length} shown of ${total} total milestones found):
${milestones.map((milestone) => `- ${milestone.id}: ${milestone.name}`).join("\n")}`;
	}

	private async _getObjective(objectivePublicId: number) {
		const objective = await this.client.getMilestone(objectivePublicId);

		if (!objective)
			throw new Error(`Failed to retrieve Shortcut objective with public ID: ${objectivePublicId}`);

		return `Objective: ${objectivePublicId}
Name: ${objective.name}
Archived: ${objective.archived ? "Yes" : "No"}
Completed: ${objective.completed ? "Yes" : "No"}
Started: ${objective.started ? "Yes" : "No"}

Description:
${objective.description}
`;
	}

	async getCurrentUser() {
		try {
			const user = await this.client.getCurrentUser();

			if (!user) throw new Error("Failed to retrieve current user.");

			return toResult(
				`Mention name: @${user.mention_name}, full name: ${user.name}, id: ${user.id}`,
			);
		} catch (err) {
			return toResult(err instanceof Error ? err.message : String(err));
		}
	}

	async searchStories(query: string) {
		try {
			const stories = await this._searchStories(query);
			return toResult(stories);
		} catch (err) {
			return toResult(err instanceof Error ? err.message : String(err));
		}
	}

	async getStory(storyPublicId: number) {
		try {
			const story = await this._getStory(storyPublicId);
			return toResult(story);
		} catch (err) {
			return toResult(err instanceof Error ? err.message : String(err));
		}
	}

	async getIterationStories(iterationPublicId: number) {
		try {
			const stories = await this._getIterationStories(iterationPublicId);
			return toResult(stories);
		} catch (err) {
			return toResult(err instanceof Error ? err.message : String(err));
		}
	}

	async searchIterations(query: string) {
		try {
			const iterations = await this._searchIterations(query);
			return toResult(iterations);
		} catch (err) {
			return toResult(err instanceof Error ? err.message : String(err));
		}
	}

	async getIteration(iterationPublicId: number) {
		try {
			const iteration = await this._getIteration(iterationPublicId);
			return toResult(iteration);
		} catch (err) {
			return toResult(err instanceof Error ? err.message : String(err));
		}
	}

	async searchEpics(query: string) {
		try {
			const epics = await this._searchEpics(query);
			return toResult(epics);
		} catch (err) {
			return toResult(err instanceof Error ? err.message : String(err));
		}
	}

	async getEpic(epicPublicId: number) {
		try {
			const epic = await this._getEpic(epicPublicId);
			return toResult(epic);
		} catch (err) {
			return toResult(err instanceof Error ? err.message : String(err));
		}
	}

	async searchObjectives(query: string) {
		try {
			const objectives = await this._searchObjectives(query);
			return toResult(objectives);
		} catch (err) {
			return toResult(err instanceof Error ? err.message : String(err));
		}
	}

	async getObjective(objectivePublicId: number) {
		try {
			const objective = await this._getObjective(objectivePublicId);
			return toResult(objective);
		} catch (err) {
			return toResult(err instanceof Error ? err.message : String(err));
		}
	}
}
