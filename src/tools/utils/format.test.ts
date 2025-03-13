import { expect, test, describe } from "bun:test";
import { formatMemberList, formatStoryList, formatWorkflowList } from "./format";
import type { Member, Story, Workflow } from "@shortcut/client";

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

describe("formatStoryList", () => {
	test("should return empty string for empty stories array", () => {
		const result = formatStoryList([], mockUsers);
		expect(result).toBe("");
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
			createMockStory({ id: 123, name: "Test Story", owner_ids: ["user1", "user2"] }),
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
			createMockStory({ id: 123, name: "Test Story", owner_ids: ["user1", "nonexistent"] }),
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
		expect(result).toBe("");
	});

	test("should format a single member", () => {
		const result = formatMemberList(["user1"], mockUsers);
		expect(result).toBe("- id=user1 @john");
	});

	test("should format multiple members", () => {
		const result = formatMemberList(["user1", "user2"], mockUsers);
		expect(result).toBe("- id=user1 @john\n- id=user2 @jane");
	});

	test("should not filter out non-existent members", () => {
		const result = formatMemberList(["nonexistent"], mockUsers);
		expect(result).toBe("- id=nonexistent [Unknown]");
	});

	test("should handle a mix of existing and non-existing members", () => {
		const result = formatMemberList(["user1", "nonexistent", "user2"], mockUsers);
		expect(result).toBe("- id=user1 @john\n- id=nonexistent [Unknown]\n- id=user2 @jane");
	});
});

describe("formatWorkflowList", () => {
	test("should return empty string for empty ids array", () => {
		const result = formatWorkflowList([], mockWorkflowsMap);
		expect(result).toBe("");
	});

	test("should format a single workflow", () => {
		const result = formatWorkflowList([1], mockWorkflowsMap);
		expect(result).toBe("- id=1 name=Workflow 1. Default state: id=500 name=Unstarted");
	});

	test("should format multiple workflows", () => {
		const result = formatWorkflowList([1, 2], mockWorkflowsMap);
		expect(result).toBe(
			"- id=1 name=Workflow 1. Default state: id=500 name=Unstarted\n- id=2 name=Workflow 2. Default state: id=501 name=Started",
		);
	});

	test("should filter out non-existent workflows", () => {
		const result = formatWorkflowList([999], mockWorkflowsMap);
		expect(result).toBe("");
	});

	test("should handle a workflow with unknown default state", () => {
		const result = formatWorkflowList([3], mockWorkflowsMap);
		expect(result).toBe("- id=3 name=Workflow 3. Default state: [Unknown]");
	});

	test("should handle a mix of existing and non-existing workflows", () => {
		const result = formatWorkflowList([1, 999, 2], mockWorkflowsMap);
		expect(result).toBe(
			"- id=1 name=Workflow 1. Default state: id=500 name=Unstarted\n- id=2 name=Workflow 2. Default state: id=501 name=Started",
		);
	});
});
