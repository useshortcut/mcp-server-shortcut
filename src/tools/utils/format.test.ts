import { describe, expect, test } from "bun:test";
import type { Branch, Member, PullRequest, Story, Task, Workflow } from "@shortcut/client";
import {
	formatAsUnorderedList,
	formatMemberList,
	formatPullRequestList,
	formatStoryList,
	formatTaskList,
	formatWorkflowList,
} from "./format";

// Mock data for tests
const mockMembers: Member[] = [
	{
		id: "user1",
		profile: {
			mention_name: "john",
			name: "John Doe",
			email_address: "john@example.com",
		},
	} as Member,
	{
		id: "user2",
		profile: {
			mention_name: "jane",
			name: "Jane Smith",
			email_address: "jane@example.com",
		},
	} as Member,
];

const mockUsers = new Map<string, Member>(mockMembers.map((member) => [member.id, member]));

interface MockStoryParams {
	id: number;
	name: string;
	owner_ids?: string[];
	completed?: boolean;
	started?: boolean;
	story_type?: string;
	epic_id?: number | null;
	iteration_id?: number | null;
	group_id?: string | null;
}

const createMockStory = ({
	id,
	name,
	owner_ids = [],
	completed = false,
	started = false,
	story_type = "feature",
	epic_id = null,
	iteration_id = null,
	group_id = null,
}: MockStoryParams): Story =>
	({
		id,
		name,
		owner_ids,
		completed,
		started,
		story_type,
		epic_id,
		iteration_id,
		group_id,
	}) as Story;

const mockWorkflowStates = [
	{ id: 500, name: "Unstarted" },
	{ id: 501, name: "Started" },
	{ id: 502, name: "Completed" },
];

const mockWorkflows: Workflow[] = [
	{
		id: 1,
		name: "Workflow 1",
		default_state_id: 500,
		states: mockWorkflowStates,
	} as Workflow,
	{
		id: 2,
		name: "Workflow 2",
		default_state_id: 501,
		states: mockWorkflowStates,
	} as Workflow,
	{
		id: 3,
		name: "Workflow 3",
		default_state_id: 999, // Non-existent state
		states: mockWorkflowStates,
	} as Workflow,
];

const mockWorkflowsMap = new Map<number, Workflow>(
	mockWorkflows.map((workflow) => [workflow.id, workflow]),
);

const mockBranches = [
	{
		id: 1,
		name: "branch1",
		pull_requests: [
			{
				id: 1,
				title: "Test PR 1",
				url: "https://github.com/user1/repo1/pull/1",
				merged: true,
			} as PullRequest,
			{
				id: 2,
				title: "Test PR 2",
				url: "https://github.com/user1/repo1/pull/2",
				merged: false,
			} as PullRequest,
		],
	} as Branch,
];

const mockTasks = [
	{ description: "task 1", complete: false },
	{ description: "task 2", complete: true },
] satisfies Partial<Task>[] as Task[];

describe("formatAsUnorderedList", () => {
	test("should format an empty list without label", () => {
		const result = formatAsUnorderedList([]);
		expect(result).toBe("[None]");
	});

	test("should format an empty list with label", () => {
		const result = formatAsUnorderedList([], "Label");
		expect(result).toBe("Label: [None]");
	});

	test("should format a list without label", () => {
		const result = formatAsUnorderedList(["item1", "item2"]);
		expect(result).toBe("- item1\n- item2");
	});

	test("should format a list with label", () => {
		const result = formatAsUnorderedList(["item1", "item2"], "Label");
		expect(result).toBe("Label:\n- item1\n- item2");
	});
});

describe("formatStoryList", () => {
	test("should return empty string for empty stories array", () => {
		const result = formatStoryList([], mockUsers);
		expect(result).toBe("[None]");
	});

	test("should format a story with team, epic, and iteration", () => {
		const stories = [
			createMockStory({
				id: 123,
				name: "Test Story",
				epic_id: 1,
				iteration_id: 2,
				group_id: "group1",
			}),
		];
		const result = formatStoryList(stories, mockUsers);
		expect(result).toBe(
			"- sc-123: Test Story (Type: feature, State: Not Started, Team: group1, Epic: 1, Iteration: 2, Owners: [None])",
		);
	});

	test("should format a single story with no owners", () => {
		const stories = [createMockStory({ id: 123, name: "Test Story" })];
		const result = formatStoryList(stories, mockUsers);
		expect(result).toBe(
			"- sc-123: Test Story (Type: feature, State: Not Started, Team: [None], Epic: [None], Iteration: [None], Owners: [None])",
		);
	});

	test("should format a single story with one owner", () => {
		const stories = [createMockStory({ id: 123, name: "Test Story", owner_ids: ["user1"] })];
		const result = formatStoryList(stories, mockUsers);
		expect(result).toBe(
			"- sc-123: Test Story (Type: feature, State: Not Started, Team: [None], Epic: [None], Iteration: [None], Owners: @john)",
		);
	});

	test("should format a single story with multiple owners", () => {
		const stories = [
			createMockStory({
				id: 123,
				name: "Test Story",
				owner_ids: ["user1", "user2"],
			}),
		];
		const result = formatStoryList(stories, mockUsers);
		expect(result).toBe(
			"- sc-123: Test Story (Type: feature, State: Not Started, Team: [None], Epic: [None], Iteration: [None], Owners: @john, @jane)",
		);
	});

	test("should format multiple stories with various states", () => {
		const stories = [
			createMockStory({ id: 123, name: "Unstarted Story" }),
			createMockStory({ id: 124, name: "Started Story", started: true }),
			createMockStory({ id: 125, name: "Completed Story", completed: true }),
		];
		const result = formatStoryList(stories, mockUsers);
		expect(result).toBe(
			"- sc-123: Unstarted Story (Type: feature, State: Not Started, Team: [None], Epic: [None], Iteration: [None], Owners: [None])\n" +
				"- sc-124: Started Story (Type: feature, State: In Progress, Team: [None], Epic: [None], Iteration: [None], Owners: [None])\n" +
				"- sc-125: Completed Story (Type: feature, State: Completed, Team: [None], Epic: [None], Iteration: [None], Owners: [None])",
		);
	});

	test("should handle owners that do not exist in the users map", () => {
		// Create a custom users map that returns null for non-existent users
		// This matches the behavior expected by the filter in formatStoryList
		const customUsers = new Map<string, Member | null>(
			mockMembers.map((member) => [member.id, member]),
		);
		// Set the non-existent user to null explicitly
		customUsers.set("nonexistent", null);

		const stories = [
			createMockStory({
				id: 123,
				name: "Test Story",
				owner_ids: ["user1", "nonexistent"],
			}),
		];
		const result = formatStoryList(stories, customUsers as Map<string, Member>);

		expect(result).toBe(
			"- sc-123: Test Story (Type: feature, State: Not Started, Team: [None], Epic: [None], Iteration: [None], Owners: @john)",
		);
	});
});

describe("formatMemberList", () => {
	test("should return empty string for empty ids array", () => {
		const result = formatMemberList([], mockUsers);
		expect(result).toBe("Members: [None]");
	});

	test("should format a single member", () => {
		const result = formatMemberList(["user1"], mockUsers);
		expect(result).toBe("Members:\n- id=user1 @john");
	});

	test("should format multiple members", () => {
		const result = formatMemberList(["user1", "user2"], mockUsers);
		expect(result).toBe("Members:\n- id=user1 @john\n- id=user2 @jane");
	});

	test("should not filter out non-existent members", () => {
		const result = formatMemberList(["nonexistent"], mockUsers);
		expect(result).toBe("Members:\n- id=nonexistent [Unknown]");
	});

	test("should handle a mix of existing and non-existing members", () => {
		const result = formatMemberList(["user1", "nonexistent", "user2"], mockUsers);
		expect(result).toBe("Members:\n- id=user1 @john\n- id=nonexistent [Unknown]\n- id=user2 @jane");
	});
});

describe("formatWorkflowList", () => {
	test("should return empty string for empty ids array", () => {
		const result = formatWorkflowList([], mockWorkflowsMap);
		expect(result).toBe("Workflows: [None]");
	});

	test("should format a single workflow", () => {
		const result = formatWorkflowList([1], mockWorkflowsMap);
		expect(result).toBe("Workflows:\n- id=1 name=Workflow 1. Default state: id=500 name=Unstarted");
	});

	test("should format multiple workflows", () => {
		const result = formatWorkflowList([1, 2], mockWorkflowsMap);
		expect(result).toBe(
			"Workflows:\n- id=1 name=Workflow 1. Default state: id=500 name=Unstarted\n- id=2 name=Workflow 2. Default state: id=501 name=Started",
		);
	});

	test("should filter out non-existent workflows", () => {
		const result = formatWorkflowList([999], mockWorkflowsMap);
		expect(result).toBe("Workflows: [None]");
	});

	test("should handle a workflow with unknown default state", () => {
		const result = formatWorkflowList([3], mockWorkflowsMap);
		expect(result).toBe("Workflows:\n- id=3 name=Workflow 3. Default state: [Unknown]");
	});

	test("should handle a mix of existing and non-existing workflows", () => {
		const result = formatWorkflowList([1, 999, 2], mockWorkflowsMap);
		expect(result).toBe(
			"Workflows:\n- id=1 name=Workflow 1. Default state: id=500 name=Unstarted\n- id=2 name=Workflow 2. Default state: id=501 name=Started",
		);
	});
});

describe("formatPullRequestList", () => {
	test("should return empty string for empty branches array", () => {
		const result = formatPullRequestList([]);
		expect(result).toBe("Pull Requests: [None]");
	});

	test("should return empty string for branch without pull requests", () => {
		const result = formatPullRequestList([{ id: 1, name: "branch1" } as Branch]);
		expect(result).toBe("Pull Requests: [None]");
	});

	test("should format a single pull request", () => {
		const result = formatPullRequestList([
			{
				id: 1,
				name: "branch1",
				pull_requests: [
					{
						id: 1,
						title: "Test PR 1",
						url: "https://github.com/user1/repo1/pull/1",
						merged: true,
					} as PullRequest,
				],
			} as Branch,
		]);
		expect(result).toBe(
			"Pull Requests:\n- Title: Test PR 1, Merged: Yes, URL: https://github.com/user1/repo1/pull/1",
		);
	});

	test("should format multiple pull requests", () => {
		const result = formatPullRequestList(mockBranches);
		expect(result).toBe(
			[
				"Pull Requests:",
				"- Title: Test PR 1, Merged: Yes, URL: https://github.com/user1/repo1/pull/1",
				"- Title: Test PR 2, Merged: No, URL: https://github.com/user1/repo1/pull/2",
			].join("\n"),
		);
	});
});

describe("formatTaskList", () => {
	test("should format task lists", () => {
		const result = formatTaskList(mockTasks);
		expect(result).toBe("Tasks:\n- [ ] task 1\n- [X] task 2");
	});
});
