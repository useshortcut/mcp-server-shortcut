import { describe, expect, mock, spyOn, test } from "bun:test";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import { UserTools } from "./user";

describe("UserTools", () => {
	const mockCurrentUser = {
		id: "user1",
		mention_name: "testuser",
		name: "Test User",
	};

	describe("create method", () => {
		test("should register the correct tools with the server", () => {
			const mockClient = {} as ShortcutClientWrapper;
			const mockTool = mock();
			const mockServer = { tool: mockTool } as unknown as McpServer;

			UserTools.create(mockClient, mockServer);

			expect(mockTool).toHaveBeenCalledTimes(3);
			expect(mockTool.mock.calls?.[0]?.[0]).toBe("get-current-user");
			expect(mockTool.mock.calls?.[1]?.[0]).toBe("get-current-user-teams");
			expect(mockTool.mock.calls?.[2]?.[0]).toBe("list-members");
		});

		test("should call correct function from tool", async () => {
			const mockClient = {} as ShortcutClientWrapper;
			const mockTool = mock();
			const mockServer = { tool: mockTool } as unknown as McpServer;

			const tools = UserTools.create(mockClient, mockServer);

			spyOn(tools, "getCurrentUser").mockImplementation(async () => ({
				content: [{ text: "", type: "text" }],
			}));
			await mockTool.mock.calls?.[0]?.[2]();
			expect(tools.getCurrentUser).toHaveBeenCalled();
		});
	});

	describe("getCurrentUser method", () => {
		const getCurrentUserMock = mock(async () => mockCurrentUser);
		const mockClient = { getCurrentUser: getCurrentUserMock } as unknown as ShortcutClientWrapper;

		test("should return formatted current user details", async () => {
			const userTools = new UserTools(mockClient);
			const result = await userTools.getCurrentUser();

			expect(result.content[0].type).toBe("text");
			const textContent = String(result.content[0].text);
			expect(textContent).toContain("Current user:");
			expect(textContent).toContain('"id": "user1"');
			expect(textContent).toContain('"mention_name": "testuser"');
			expect(textContent).toContain('"name": "Test User"');
		});

		test("should throw error when current user is not found", async () => {
			const userTools = new UserTools({
				getCurrentUser: mock(async () => null),
			} as unknown as ShortcutClientWrapper);

			await expect(() => userTools.getCurrentUser()).toThrow("Failed to retrieve current user.");
		});

		test("should propagate errors from client", async () => {
			const userTools = new UserTools({
				getCurrentUser: mock(async () => {
					throw new Error("API error");
				}),
			} as unknown as ShortcutClientWrapper);

			await expect(() => userTools.getCurrentUser()).toThrow("API error");
		});
	});

	describe("getCurrentUserTeams method", () => {
		const mockTeams = [
			{
				id: "team1",
				name: "Engineering",
				archived: false,
				mention_name: "@engineering",
				member_ids: ["user1", "user2"],
				workflow_ids: [1, 2],
				entity_type: "group",
			},
			{
				id: "team2",
				name: "Design",
				archived: false,
				mention_name: "@design",
				member_ids: ["user2", "user3"],
				workflow_ids: [2],
				entity_type: "group",
			},
			{
				id: "team3",
				name: "Marketing",
				archived: false,
				mention_name: "@marketing",
				member_ids: ["user3", "user4"],
				workflow_ids: [3],
				entity_type: "group",
			},
		];

		test("should return teams where current user is a member", async () => {
			const userTools = new UserTools({
				getCurrentUser: mock(async () => ({ ...mockCurrentUser, id: "user1" })),
				getTeams: mock(async () => mockTeams),
				getUserMap: mock(async () => new Map()),
				getWorkflowMap: mock(async () => new Map()),
				getTeamMap: mock(async () => new Map()),
			} as unknown as ShortcutClientWrapper);

			const result = await userTools.getCurrentUserTeams();

			expect(result.content[0].type).toBe("text");
			const textContent = String(result.content[0].text);
			expect(textContent).toContain("Current user is a member of 1 teams:");
			expect(textContent).toContain('"id": "team1"');
			expect(textContent).toContain('"name": "Engineering"');
		});

		test("should return multiple teams for user with multiple memberships", async () => {
			const userTools = new UserTools({
				getCurrentUser: mock(async () => ({ ...mockCurrentUser, id: "user2" })),
				getTeams: mock(async () => mockTeams),
				getUserMap: mock(async () => new Map()),
				getWorkflowMap: mock(async () => new Map()),
				getTeamMap: mock(async () => new Map()),
			} as unknown as ShortcutClientWrapper);

			const result = await userTools.getCurrentUserTeams();

			expect(result.content[0].type).toBe("text");
			const textContent = String(result.content[0].text);
			expect(textContent).toContain("Current user is a member of 2 teams:");
			expect(textContent).toContain('"id": "team1"');
			expect(textContent).toContain('"name": "Engineering"');
			expect(textContent).toContain('"id": "team2"');
			expect(textContent).toContain('"name": "Design"');
		});

		test("should handle user with no team memberships", async () => {
			const userTools = new UserTools({
				getCurrentUser: mock(async () => ({ ...mockCurrentUser, id: "user5" })),
				getTeams: mock(async () => mockTeams),
			} as unknown as ShortcutClientWrapper);

			const result = await userTools.getCurrentUserTeams();

			expect(result.content[0].type).toBe("text");
			expect(String(result.content[0].text)).toBe("Current user is not a member of any teams.");
		});

		test("should throw error when current user is not found", async () => {
			const userTools = new UserTools({
				getCurrentUser: mock(async () => null),
				getTeams: mock(async () => mockTeams),
			} as unknown as ShortcutClientWrapper);

			await expect(() => userTools.getCurrentUserTeams()).toThrow("Failed to get current user.");
		});

		test("should propagate errors from getTeams", async () => {
			const userTools = new UserTools({
				getCurrentUser: mock(async () => mockCurrentUser),
				getTeams: mock(async () => {
					throw new Error("Teams API error");
				}),
			} as unknown as ShortcutClientWrapper);

			await expect(() => userTools.getCurrentUserTeams()).toThrow("Teams API error");
		});

		test("should propagate errors from getCurrentUser", async () => {
			const userTools = new UserTools({
				getCurrentUser: mock(async () => {
					throw new Error("User API error");
				}),
				getTeams: mock(async () => mockTeams),
			} as unknown as ShortcutClientWrapper);

			await expect(() => userTools.getCurrentUserTeams()).toThrow("User API error");
		});
	});

	describe("listMembers method", () => {
		const mockMembers = [
			{ id: "user1", name: "User One", profile: { mention_name: "user1" } },
			{ id: "user2", name: "User Two", profile: { mention_name: "user2" } },
		];

		const listMembersMock = mock(async () => mockMembers);
		const mockClient = { listMembers: listMembersMock } as unknown as ShortcutClientWrapper;

		test("should return formatted list of members", async () => {
			const userTools = new UserTools(mockClient);
			const result = await userTools.listMembers();

			expect(result.content[0].type).toBe("text");
			expect(String(result.content[0].text)).toContain("Found 2 members:");
			expect(String(result.content[0].text)).toContain('"mention_name": "user1"');
			expect(String(result.content[0].text)).toContain('"mention_name": "user2"');
		});

		test("should propagate errors from client", async () => {
			const userTools = new UserTools({
				listMembers: mock(async () => {
					throw new Error("API error");
				}),
			} as unknown as ShortcutClientWrapper);

			await expect(() => userTools.listMembers()).toThrow("API error");
		});
	});
});
