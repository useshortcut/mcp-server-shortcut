import type {
	Branch,
	EpicStats,
	IterationStats,
	Member,
	Story,
	StorySearchResult,
	Task,
	Workflow,
} from "@shortcut/client";

type PropInclude = Record<string, string[] | true | Record<string, string[] | true>>;

export type FormatOptions = {
	/** Properties to include (if undefined, include all) */
	include?: string[] | PropInclude;
	/** How deep to go into nested structures (default: unlimited) */
	depth?: number;
	/** Format for indentation (internal use) */
	indent?: string;
};

export function jsonToText(data: unknown, options: FormatOptions = {}): string {
	const indent = options.indent || "";

	if (data === null || data === undefined) return "";
	if (Array.isArray(data)) return formatArray(data, { ...options, indent });
	if (typeof data === "object")
		return formatObject(data as Record<string, unknown>, { ...options, indent });
	return formatPrimitive(data);
}

function formatPrimitive(value: unknown): string {
	if (typeof value === "boolean") return value ? "Yes" : "No";
	return String(value);
}

function formatArray(arr: Array<unknown>, options: FormatOptions = {}): string {
	if (arr.length === 0) return "(empty)";

	const indent = options.indent || "";
	const nextIndent = `${indent}  `;

	return arr
		.map((item) => {
			let formattedItem: string;

			if (typeof item === "object" && item !== null) {
				formattedItem = jsonToText(item, {
					...options,
					indent: nextIndent,
					depth: options.depth !== undefined ? options.depth - 1 : undefined,
				});

				if (formattedItem.includes("\n")) return `${indent}- \n${formattedItem}`;
			} else formattedItem = formatPrimitive(item);

			return `${indent}- ${formattedItem}`;
		})
		.join("\n");
}

function formatObject(obj: Record<string, unknown>, options: FormatOptions = {}): string {
	const indent = options.indent || "";
	const nextIndent = `${indent}  `;

	if (options.depth !== undefined && options.depth <= 0) return `${indent}[Object]`;
	if (Object.keys(obj).length === 0) return `${indent}(empty)`;

	let keys: string[];

	if (!options.include) {
		keys = Object.keys(obj);
	} else if (Array.isArray(options.include)) {
		const arr = options.include as string[];
		keys = Object.keys(obj).filter((key) => arr.includes(key));
	} else {
		keys = Object.keys(obj).filter((key) => {
			const include = options.include as Record<string, unknown>;
			return key in include;
		});
	}

	return keys
		.map((key) => {
			const value = obj[key];
			const formattedKey = formatKey(key);

			let nestedInclude: FormatOptions["include"];
			if (options.include && !Array.isArray(options.include)) {
				const includeValue = (options.include as Record<string, string[] | true>)[key];
				if (includeValue === true) nestedInclude = undefined;
				else nestedInclude = includeValue;
			}

			const formattedValue = jsonToText(value, {
				...options,
				include: nestedInclude,
				indent: nextIndent,
				depth: options.depth !== undefined ? options.depth - 1 : undefined,
			});

			if (!formattedValue.includes("\n")) {
				return `${indent}${formattedKey}: ${formattedValue}`;
			}

			return `${indent}${formattedKey}:\n${formattedValue}`;
		})
		.join("\n");
}

function formatKey(key: string): string {
	return key
		.replace(/([A-Z])/g, " $1") // Insert space before capitals
		.replace(/_/g, " ") // Replace underscores with spaces
		.trim()
		.split(" ")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");
}

export const formatAsUnorderedList = (items: string[], label?: string) => {
	return `${label ? `${label}:` : ""}${items?.length ? `${label ? "\n" : ""}${formatArray(items)}` : `${label ? " " : ""}(none)`}`;
};

export const formatStoryList = (
	stories: (Story | StorySearchResult)[],
	users: Map<string, Member>,
	label?: string,
) => {
	return formatAsUnorderedList(
		stories.map(
			(story) =>
				`sc-${story.id}: ${story.name} (Type: ${story.story_type}, State: ${story.completed ? "Completed" : story.started ? "In Progress" : "Not Started"}, Team: ${story.group_id ? `${story.group_id}` : "(none)"}, Epic: ${story.epic_id ? `${story.epic_id}` : "(none)"}, Iteration: ${story.iteration_id ? `${story.iteration_id}` : "(none)"}, Owners: ${
					story.owner_ids
						.map((ownerId) => users.get(ownerId))
						.filter((owner): owner is Member => owner !== null)
						.map((owner) => `@${owner.profile.mention_name}`)
						.join(", ") || "(none)"
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

export const formatStats = (stats: EpicStats | IterationStats, showPoints: boolean) => {
	const { num_stories_backlog, num_stories_unstarted, num_stories_started, num_stories_done } =
		stats;
	const { num_points_backlog, num_points_unstarted, num_points_started, num_points_done } = stats;

	const totalCount =
		num_stories_backlog + num_stories_unstarted + num_stories_started + num_stories_done;
	const totalUnstarted = num_stories_backlog + num_stories_unstarted;

	const totalPoints =
		(num_points_backlog || 0) +
		(num_points_unstarted || 0) +
		(num_points_started || 0) +
		(num_points_done || 0);
	const totalUnstartedPoints = (num_points_backlog || 0) + (num_points_unstarted || 0);

	const statsString = `Stats:
- Total stories: ${totalCount}${showPoints ? ` (${totalPoints} points)` : ""}
- Unstarted stories: ${totalUnstarted}${showPoints ? ` (${totalUnstartedPoints} points)` : ""}
- Stories in progress: ${num_stories_started}${showPoints ? ` (${num_points_started || 0} points)` : ""}
- Completed stories: ${num_stories_done}${showPoints ? ` (${num_points_done || 0} points)` : ""}`;

	if (showPoints && stats.num_stories_unestimated)
		return `${statsString}\n- (${stats.num_stories_unestimated} of the stories are unestimated)`;

	return statsString;
};
