import { describe, expect, mock, spyOn, test } from "bun:test";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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

			expect(mockTool).toHaveBeenCalledTimes(1);
			expect(mockTool.mock.calls?.[0]?.[0]).toBe("get-current-user");
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
			expect(String(result.content[0].text).split("\n")).toMatchObject([
				"Current user:",
				"Id: user1",
				"Mention name: @testuser",
				"Full name: Test User",
			]);
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
});
