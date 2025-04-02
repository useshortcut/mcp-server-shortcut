import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Epic } from "@shortcut/client";
import { EpicTools } from "./epics";

describe("EpicTools", () => {
	const mockEpics: Epic[] = [
		{
			id: 1,
			name: "Epic 1",
			description: "Description for Epic 1",
			state: "unstarted",
			started: false,
			completed: false,
			archived: false,
			deadline: "2025-04-01",
			app_url: "https://app.shortcut.com/test/epic/1",
		} as Epic,
		{
			id: 2,
			name: "Epic 2",
			description: "Description for Epic 2",
			state: "started",
			started: true,
			completed: false,
			archived: false,
			deadline: null,
			app_url: "https://app.shortcut.com/test/epic/2",
		} as Epic,
		{
			id: 3,
			name: "Epic 3",
			description: "Description for Epic 3",
			state: "done",
			started: true,
			completed: true,
			archived: true,
			deadline: "2025-03-01",
			app_url: "https://app.shortcut.com/test/epic/3",
		} as Epic,
	];

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

			EpicTools.create(mockClient, mockServer);

			expect(mockTool).toHaveBeenCalledTimes(2);

			expect(mockTool.mock.calls?.[0]?.[0]).toBe("get-epic");
			expect(mockTool.mock.calls?.[1]?.[0]).toBe("search-epics");
		});

		test("should call correct function from tool", async () => {
			const mockClient = {} as ShortcutClientWrapper;
			const mockTool = mock();
			const mockServer = { tool: mockTool } as unknown as McpServer;

			const tools = EpicTools.create(mockClient, mockServer);

			spyOn(tools, "getEpic").mockImplementation(async () => ({
				content: [{ text: "", type: "text" }],
			}));
			await mockTool.mock.calls?.[0]?.[3]({ epicPublicId: 1 });
			expect(tools.getEpic).toHaveBeenCalledWith(1);

			spyOn(tools, "searchEpics").mockImplementation(async () => ({
				content: [{ text: "[None]", type: "text" }],
			}));
			await mockTool.mock.calls?.[1]?.[3]({ id: 1 });
			expect(tools.searchEpics).toHaveBeenCalledWith({ id: 1 });
		});
	});

	describe("getEpic method", () => {
		const getEpicMock = mock(async (id: number) => mockEpics.find((epic) => epic.id === id));
		const mockClient = { getEpic: getEpicMock } as unknown as ShortcutClientWrapper;

		test("should return formatted epic details when epic is found", async () => {
			const epicTools = new EpicTools(mockClient);
			const result = await epicTools.getEpic(1);

			expect(result.content[0].type).toBe("text");
			expect(String(result.content[0].text).split("\n")).toMatchObject([
				"Epic: 1",
				"URL: https://app.shortcut.com/test/epic/1",
				"Name: Epic 1",
				"Archived: No",
				"Completed: No",
				"Started: No",
				"Due date: 2025-04-01",
				"Team: [None]",
				"Objective: [None]",
				"",
				"Description:",
				"Description for Epic 1",
			]);
		});

		test("should handle completed and archived epics correctly", async () => {
			const epicTools = new EpicTools(mockClient);
			const result = await epicTools.getEpic(3);

			expect(result.content[0].type).toBe("text");
			expect(String(result.content[0].text).split("\n")).toMatchObject([
				"Epic: 3",
				"URL: https://app.shortcut.com/test/epic/3",
				"Name: Epic 3",
				"Archived: Yes",
				"Completed: Yes",
				"Started: Yes",
				"Due date: 2025-03-01",
				"Team: [None]",
				"Objective: [None]",
				"",
				"Description:",
				"Description for Epic 3",
			]);
		});

		test("should handle epics with null deadline", async () => {
			const epicTools = new EpicTools(mockClient);
			const result = await epicTools.getEpic(2);

			expect(result.content[0].type).toBe("text");
			expect(String(result.content[0].text).split("\n")).toMatchObject([
				"Epic: 2",
				"URL: https://app.shortcut.com/test/epic/2",
				"Name: Epic 2",
				"Archived: No",
				"Completed: No",
				"Started: Yes",
				"Due date: [Not set]",
				"Team: [None]",
				"Objective: [None]",
				"",
				"Description:",
				"Description for Epic 2",
			]);
		});

		test("should throw error when epic is not found", async () => {
			const epicTools = new EpicTools(mockClient);
			await expect(() => epicTools.getEpic(999)).toThrow(
				"Failed to retrieve Shortcut epic with public ID: 999",
			);
		});
	});

	describe("searchEpics method", () => {
		const searchEpicsMock = mock(async (_: string) => ({
			epics: mockEpics,
			total: mockEpics.length,
		}));
		const mockClient = {
			getCurrentUser: mock(async () => mockCurrentUser),
			searchEpics: searchEpicsMock,
		} as unknown as ShortcutClientWrapper;

		beforeEach(() => {
			searchEpicsMock.mockClear();
		});

		test("should return formatted list of epics when epics are found", async () => {
			const epicTools = new EpicTools(mockClient);
			const result = await epicTools.searchEpics({});

			expect(mockClient.getCurrentUser).toHaveBeenCalled();
			expect(mockClient.searchEpics).toHaveBeenCalled();

			expect(result.content[0].type).toBe("text");
			expect(String(result.content[0].text).split("\n")).toMatchObject([
				"Result (first 3 shown of 3 total epics found):",
				"- 1: Epic 1",
				"- 2: Epic 2",
				"- 3: Epic 3",
			]);
		});

		test("should return no epics found message when no epics match", async () => {
			const epicTools = new EpicTools({
				...mockClient,
				searchEpics: mock(async () => ({ epics: [], total: 0 })),
			} as unknown as ShortcutClientWrapper);
			const result = await epicTools.searchEpics({});

			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toBe("Result: No epics found.");
		});

		test("should throw error when epics is null", async () => {
			const epicTools = new EpicTools({
				...mockClient,
				searchEpics: mock(async () => ({ epics: null, total: 0 })),
			} as unknown as ShortcutClientWrapper);
			await expect(() => epicTools.searchEpics({})).toThrow(
				'Failed to search for epics matching your query: ""',
			);
		});

		test("should handle various search parameters", async () => {
			const epicTools = new EpicTools(mockClient);
			await epicTools.searchEpics({
				id: 1,
				name: "Test Epic",
				description: "Test Description",
				state: "started",
				objective: 123,
				owner: "me",
				team: "engineering",
				isArchived: true,
			});

			expect(searchEpicsMock.mock.calls?.[0]?.[0]).toBe(
				'id:1 name:"Test Epic" description:"Test Description" state:started objective:123 owner:testuser team:engineering is:archived',
			);
		});

		test("should handle 'me' as owner parameter", async () => {
			const epicTools = new EpicTools(mockClient);
			await epicTools.searchEpics({ owner: "me" });
			expect(searchEpicsMock.mock.calls?.[0]?.[0]).toBe("owner:testuser");
		});

		test("should handle date parameters", async () => {
			const epicTools = new EpicTools(mockClient);
			await epicTools.searchEpics({
				created: "2023-01-01",
				updated: "2023-01-01..2023-02-01",
				completed: "today",
				due: "tomorrow",
			});
			expect(searchEpicsMock.mock.calls?.[0]?.[0]).toBe(
				"created:2023-01-01 updated:2023-01-01..2023-02-01 completed:today due:tomorrow",
			);
		});

		test("should handle boolean parameters", async () => {
			const epicTools = new EpicTools(mockClient);

			await epicTools.searchEpics({
				isUnstarted: true,
				isStarted: false,
				isDone: true,
				isArchived: false,
				isOverdue: true,
				hasOwner: true,
				hasComment: false,
				hasDeadline: true,
				hasLabel: false,
			});

			expect(searchEpicsMock.mock.calls?.[0]?.[0]).toBe(
				"is:unstarted !is:started is:done !is:archived is:overdue has:owner !has:comment has:deadline !has:label",
			);
		});
	});
});
