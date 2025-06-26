import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CreateEpic, Epic, Member, MemberInfo } from "@shortcut/client";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import { EpicTools } from "./epics";

describe("EpicTools", () => {
	const mockEpics: Epic[] = [
		{
			entity_type: "epic",
			id: 1,
			name: "Epic 1",
			description: "Description for Epic 1",
			state: "unstarted",
			started: false,
			completed: false,
			archived: false,
			deadline: "2025-04-01",
			app_url: "https://app.shortcut.com/test/epic/1",
			group_id: null,
			milestone_id: null,
			owner_ids: [],
			follower_ids: [],
			requested_by_id: null,
			stats: {
				num_stories_backlog: 1,
				num_stories_unstarted: 2,
				num_stories_started: 3,
				num_stories_done: 4,
			},
		} as unknown as Epic,
		{
			entity_type: "epic",
			id: 2,
			name: "Epic 2",
			description: "Description for Epic 2",
			state: "started",
			started: true,
			completed: false,
			archived: false,
			deadline: null,
			app_url: "https://app.shortcut.com/test/epic/2",
			group_id: null,
			milestone_id: null,
			owner_ids: [],
			follower_ids: [],
			requested_by_id: null,
			stats: {
				num_stories_backlog: 1,
				num_stories_unstarted: 2,
				num_stories_started: 3,
				num_stories_done: 4,
			},
		} as unknown as Epic,
		{
			entity_type: "epic",
			id: 3,
			name: "Epic 3",
			description: "Description for Epic 3",
			state: "done",
			started: true,
			completed: true,
			archived: true,
			deadline: "2025-03-01",
			app_url: "https://app.shortcut.com/test/epic/3",
			group_id: null,
			milestone_id: null,
			owner_ids: [],
			follower_ids: [],
			requested_by_id: null,
			stats: {
				num_stories_backlog: 1,
				num_stories_unstarted: 2,
				num_stories_started: 3,
				num_stories_done: 4,
			},
		} as unknown as Epic,
	];

	const mockCurrentUser = {
		id: "user1",
		mention_name: "testuser",
		name: "Test User",
		workspace2: {
			estimate_scale: [],
		},
	} as unknown as Member & MemberInfo;

	const createMockClient = (methods?: object) =>
		({
			getCurrentUser: mock(async () => mockCurrentUser),
			getUserMap: mock(async () => new Map()),
			getWorkflowMap: mock(async () => new Map()),
			getTeamMap: mock(async () => new Map()),
			getMilestone: mock(async () => null),
			...methods,
		}) as unknown as ShortcutClientWrapper;

	describe("create method", () => {
		test("should register the correct tools with the server", () => {
			const mockClient = createMockClient();
			const mockTool = mock();
			const mockServer = { tool: mockTool } as unknown as McpServer;

			EpicTools.create(mockClient, mockServer);

			expect(mockTool).toHaveBeenCalledTimes(3);

			expect(mockTool.mock.calls?.[0]?.[0]).toBe("get-epic");
			expect(mockTool.mock.calls?.[1]?.[0]).toBe("search-epics");
			expect(mockTool.mock.calls?.[2]?.[0]).toBe("create-epic");
		});
	});

	describe("getEpic method", () => {
		const getEpicMock = mock(async (id: number) => mockEpics.find((epic) => epic.id === id));
		const mockClient = createMockClient({ getEpic: getEpicMock });

		test("should return formatted epic details when epic is found", async () => {
			const epicTools = new EpicTools(mockClient);
			const result = await epicTools.getEpic(1);

			expect(result.content[0].type).toBe("text");
			const textContent = String(result.content[0].text);
			expect(textContent).toContain("Epic: 1");
			expect(textContent).toContain('"id": 1');
			expect(textContent).toContain('"name": "Epic 1"');
			expect(textContent).toContain('"description": "Description for Epic 1"');
			expect(textContent).toContain('"state": "unstarted"');
			expect(textContent).toContain('"deadline": "2025-04-01"');
			expect(textContent).toContain('"app_url": "https://app.shortcut.com/test/epic/1"');
		});

		test("should handle completed and archived epics correctly", async () => {
			const epicTools = new EpicTools(mockClient);
			const result = await epicTools.getEpic(3);

			expect(result.content[0].type).toBe("text");
			const textContent = String(result.content[0].text);
			expect(textContent).toContain("Epic: 3");
			expect(textContent).toContain('"id": 3');
			expect(textContent).toContain('"name": "Epic 3"');
			expect(textContent).toContain('"description": "Description for Epic 3"');
			expect(textContent).toContain('"state": "done"');
			expect(textContent).toContain('"archived": true');
			expect(textContent).toContain('"completed": true');
			expect(textContent).toContain('"deadline": "2025-03-01"');
		});

		test("should handle epics with null deadline", async () => {
			const epicTools = new EpicTools(mockClient);
			const result = await epicTools.getEpic(2);

			expect(result.content[0].type).toBe("text");
			const textContent = String(result.content[0].text);
			expect(textContent).toContain("Epic: 2");
			expect(textContent).toContain('"id": 2');
			expect(textContent).toContain('"name": "Epic 2"');
			expect(textContent).toContain('"description": "Description for Epic 2"');
			expect(textContent).toContain('"state": "started"');
			expect(textContent).toContain('"started": true');
			expect(textContent).toContain('"deadline": null');
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
		const mockClient = createMockClient({
			searchEpics: searchEpicsMock,
		});

		beforeEach(() => {
			searchEpicsMock.mockClear();
		});

		test("should return formatted list of epics when epics are found", async () => {
			const epicTools = new EpicTools(mockClient);
			const result = await epicTools.searchEpics({});

			expect(mockClient.getCurrentUser).toHaveBeenCalled();
			expect(mockClient.searchEpics).toHaveBeenCalled();

			expect(result.content[0].type).toBe("text");
			const textContent = String(result.content[0].text);
			expect(textContent).toContain("Result (first 3 shown of 3 total epics found):");
			expect(textContent).toContain('"id": 1');
			expect(textContent).toContain('"name": "Epic 1"');
			expect(textContent).toContain('"id": 2');
			expect(textContent).toContain('"name": "Epic 2"');
			expect(textContent).toContain('"id": 3');
			expect(textContent).toContain('"name": "Epic 3"');
		});

		test("should return no epics found message when no epics match", async () => {
			const epicTools = new EpicTools(
				createMockClient({
					searchEpics: mock(async () => ({ epics: [], total: 0 })),
				}),
			);
			const result = await epicTools.searchEpics({});

			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toBe("Result: No epics found.");
		});

		test("should throw error when epics is null", async () => {
			const epicTools = new EpicTools(
				createMockClient({
					searchEpics: mock(async () => ({ epics: null, total: 0 })),
				}),
			);
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
				'id:1 title:"Test Epic" description:"Test Description" state:started objective:123 owner:testuser team:engineering is:archived',
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

	describe("createEpic method", () => {
		const createEpicMock = mock(async (_: CreateEpic) => ({
			id: 1,
			name: "Epic 1",
			description: "Description for Epic 1",
			app_url: "https://app.shortcut.com/test/epic/1",
		}));

		const mockClient = createMockClient({
			createEpic: createEpicMock,
		});

		test("should create epic", async () => {
			const epicTools = new EpicTools(mockClient);
			const result = await epicTools.createEpic({
				name: "Epic 1",
				description: "Description for Epic 1",
			});

			expect(result.content[0].text).toBe("Epic created with ID: 1.");
		});
	});
});
