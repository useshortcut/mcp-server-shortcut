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

const createMockStory = (
	id: number,
	name: string,
	owner_ids: string[] = [],
	completed = false,
	started = false,
	story_type = "feature",
): Story =>
	({
		id,
		name,
		owner_ids,
		completed,
		started,
		story_type,
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

// Tests for formatStoryList
describe("formatStoryList", () => {
	test("should return empty string for empty stories array", () => {
		const result = formatStoryList([], mockUsers);
		expect(result).toBe("");
	});

	test("should format a single story with no owners", () => {
		const stories = [createMockStory(123, "Test Story")];
		const result = formatStoryList(stories, mockUsers);
		expect(result).toBe("- sc-123: Test Story (Type: feature, State: Not Started, Owners: )");
	});

	test("should format a single story with one owner", () => {
		const stories = [createMockStory(123, "Test Story", ["user1"])];
		const result = formatStoryList(stories, mockUsers);
		expect(result).toBe("- sc-123: Test Story (Type: feature, State: Not Started, Owners: @john)");
	});

	test("should format a single story with multiple owners", () => {
		const stories = [createMockStory(123, "Test Story", ["user1", "user2"])];
		const result = formatStoryList(stories, mockUsers);
		expect(result).toBe(
			"- sc-123: Test Story (Type: feature, State: Not Started, Owners: @john, @jane)",
		);
	});

	test("should format multiple stories with various states", () => {
		const stories = [
			createMockStory(123, "Unstarted Story"),
			createMockStory(124, "Started Story", [], false, true),
			createMockStory(125, "Completed Story", [], true, false),
		];
		const result = formatStoryList(stories, mockUsers);
		expect(result).toBe(
			"- sc-123: Unstarted Story (Type: feature, State: Not Started, Owners: )\n" +
				"- sc-124: Started Story (Type: feature, State: In Progress, Owners: )\n" +
				"- sc-125: Completed Story (Type: feature, State: Completed, Owners: )",
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

		const stories = [createMockStory(123, "Test Story", ["user1", "nonexistent"])];
		const result = formatStoryList(stories, customUsers as Map<string, Member>);

		expect(result).toBe("- sc-123: Test Story (Type: feature, State: Not Started, Owners: @john)");
	});
});

// Tests for formatMemberList
describe("formatMemberList", () => {
	test("should return empty string for empty ids array", () => {
		const result = formatMemberList([], mockUsers);
		expect(result).toBe("");
	});

	test("should format a single member", () => {
		const result = formatMemberList(["user1"], mockUsers);
		expect(result).toBe("- user1: john");
	});

	test("should format multiple members", () => {
		const result = formatMemberList(["user1", "user2"], mockUsers);
		expect(result).toBe("- user1: john\n- user2: jane");
	});

	test("should filter out non-existent members", () => {
		const result = formatMemberList(["nonexistent"], mockUsers);
		expect(result).toBe("");
	});

	test("should handle a mix of existing and non-existing members", () => {
		const result = formatMemberList(["user1", "nonexistent", "user2"], mockUsers);
		expect(result).toBe("- user1: john\n- user2: jane");
	});
});

// Tests for formatWorkflowList
describe("formatWorkflowList", () => {
	test("should return empty string for empty ids array", () => {
		const result = formatWorkflowList([], mockWorkflowsMap);
		expect(result).toBe("");
	});

	test("should format a single workflow", () => {
		const result = formatWorkflowList([1], mockWorkflowsMap);
		expect(result).toBe("- 1: Workflow 1, default state: Unstarted");
	});

	test("should format multiple workflows", () => {
		const result = formatWorkflowList([1, 2], mockWorkflowsMap);
		expect(result).toBe(
			"- 1: Workflow 1, default state: Unstarted\n" + "- 2: Workflow 2, default state: Started",
		);
	});

	test("should filter out non-existent workflows", () => {
		const result = formatWorkflowList([999], mockWorkflowsMap);
		expect(result).toBe("");
	});

	test("should handle a workflow with unknown default state", () => {
		const result = formatWorkflowList([3], mockWorkflowsMap);
		expect(result).toBe("- 3: Workflow 3, default state: [Unknown]");
	});

	test("should handle a mix of existing and non-existing workflows", () => {
		const result = formatWorkflowList([1, 999, 2], mockWorkflowsMap);
		expect(result).toBe(
			"- 1: Workflow 1, default state: Unstarted\n" + "- 2: Workflow 2, default state: Started",
		);
	});
});
