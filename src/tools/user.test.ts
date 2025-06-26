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

			expect(mockTool).toHaveBeenCalledTimes(2);
			expect(mockTool.mock.calls?.[0]?.[0]).toBe("get-current-user");
			expect(mockTool.mock.calls?.[1]?.[0]).toBe("list-members");
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
