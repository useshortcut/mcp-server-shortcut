import { describe, expect, mock, test } from "bun:test";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Milestone } from "@shortcut/client";
import { ObjectiveTools } from "./objectives";

describe("ObjectiveTools", () => {
	const mockCurrentUser = {
		id: "user1",
		mention_name: "testuser",
		name: "Test User",
	};

	const mockMilestones: Milestone[] = [
		{
			id: 1,
			name: "Objective 1",
			description: "Description for Objective 1",
			app_url: "https://app.shortcut.com/test/milestone/1",
			archived: false,
			completed: false,
			started: true,
		} as Milestone,
		{
			id: 2,
			name: "Objective 2",
			description: "Description for Objective 2",
			app_url: "https://app.shortcut.com/test/milestone/2",
			archived: false,
			completed: true,
			started: true,
		} as Milestone,
	];

	describe("create method", () => {
		test("should register the correct tools with the server", () => {
			const mockClient = {} as ShortcutClientWrapper;
			const mockTool = mock();
			const mockServer = { tool: mockTool } as unknown as McpServer;

			ObjectiveTools.create(mockClient, mockServer);

			expect(mockTool).toHaveBeenCalledTimes(2);
			expect(mockTool.mock.calls?.[0]?.[0]).toBe("get-objective");
			expect(mockTool.mock.calls?.[1]?.[0]).toBe("search-objectives");
		});
	});

	describe("searchObjectives method", () => {
		const searchMilestonesMock = mock(async () => ({
			milestones: mockMilestones,
			total: mockMilestones.length,
		}));
		const getCurrentUserMock = mock(async () => mockCurrentUser);
		const mockClient = {
			searchMilestones: searchMilestonesMock,
			getCurrentUser: getCurrentUserMock,
		} as unknown as ShortcutClientWrapper;

		test("should return formatted list of objectives when objectives are found", async () => {
			const objectiveTools = new ObjectiveTools(mockClient);
			const result = await objectiveTools.searchObjectives({});

			expect(result.content[0].type).toBe("text");
			const textContent = String(result.content[0].text);
			expect(textContent).toContain("Result (first 2 shown of 2 total milestones found):");
			expect(textContent).toContain('"id": 1');
			expect(textContent).toContain('"name": "Objective 1"');
			expect(textContent).toContain('"id": 2');
			expect(textContent).toContain('"name": "Objective 2"');
		});

		test("should return no objectives found message when no objectives exist", async () => {
			const objectiveTools = new ObjectiveTools({
				...mockClient,
				searchMilestones: mock(async () => ({ milestones: [], total: 0 })),
			} as unknown as ShortcutClientWrapper);

			const result = await objectiveTools.searchObjectives({});

			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toBe("Result: No milestones found.");
		});

		test("should throw error when objectives search fails", async () => {
			const objectiveTools = new ObjectiveTools({
				...mockClient,
				searchMilestones: mock(async () => ({ milestones: null, total: 0 })),
			} as unknown as ShortcutClientWrapper);

			await expect(() => objectiveTools.searchObjectives({})).toThrow(
				"Failed to search for milestones matching your query",
			);
		});
	});

	describe("getObjective method", () => {
		const getMilestoneMock = mock(async (id: number) =>
			mockMilestones.find((milestone) => milestone.id === id),
		);
		const mockClient = { getMilestone: getMilestoneMock } as unknown as ShortcutClientWrapper;

		test("should return formatted objective details when objective is found", async () => {
			const objectiveTools = new ObjectiveTools(mockClient);
			const result = await objectiveTools.getObjective(1);

			expect(result.content[0].type).toBe("text");
			const textContent = String(result.content[0].text);
			expect(textContent).toContain("Objective: 1");
			expect(textContent).toContain('"id": 1');
			expect(textContent).toContain('"name": "Objective 1"');
			expect(textContent).toContain('"description": "Description for Objective 1"');
			expect(textContent).toContain('"archived": false');
			expect(textContent).toContain('"completed": false');
			expect(textContent).toContain('"started": true');
			expect(textContent).toContain('"app_url": "https://app.shortcut.com/test/milestone/1"');
		});

		test("should handle objective not found", async () => {
			const objectiveTools = new ObjectiveTools({
				getMilestone: mock(async () => null),
			} as unknown as ShortcutClientWrapper);

			await expect(() => objectiveTools.getObjective(999)).toThrow(
				"Failed to retrieve Shortcut objective with public ID: 999",
			);
		});

		test("should handle completed objective", async () => {
			const objectiveTools = new ObjectiveTools({
				getMilestone: mock(async () => mockMilestones[1]),
			} as unknown as ShortcutClientWrapper);

			const result = await objectiveTools.getObjective(2);

			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toContain('"completed": true');
		});
	});
});
