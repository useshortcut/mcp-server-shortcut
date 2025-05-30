import { describe, expect, mock, test } from "bun:test";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CreateIteration, Iteration, Member, MemberInfo, Story } from "@shortcut/client";
import { IterationTools } from "./iterations";

describe("IterationTools", () => {
	const mockCurrentUser = {
		id: "user1",
		profile: {
			mention_name: "testuser",
			name: "Test User",
		},
		workspace2: {
			estimate_scale: [],
		},
	} as unknown as Member & MemberInfo;

	const mockMembers: Member[] = [
		mockCurrentUser,
		{
			id: "user2",
			profile: {
				mention_name: "jane",
				name: "Jane Smith",
			},
		} as Member,
	];

	const mockStories: Story[] = [
		{
			id: 123,
			name: "Test Story 1",
			story_type: "feature",
			owner_ids: ["user1"],
		} as Story,
		{
			id: 456,
			name: "Test Story 2",
			story_type: "bug",
			owner_ids: ["user1", "user2"],
		} as Story,
	];

	const mockIterations: Iteration[] = [
		{
			id: 1,
			name: "Iteration 1",
			description: "Description for Iteration 1",
			start_date: "2023-01-01",
			end_date: "2023-01-14",
			status: "started",
			app_url: "https://app.shortcut.com/test/iteration/1",
			stats: {
				num_stories_backlog: 1,
				num_stories_unstarted: 2,
				num_stories_started: 3,
				num_stories_done: 4,
			},
		} as Iteration,
		{
			id: 2,
			name: "Iteration 2",
			description: "Description for Iteration 2",
			start_date: "2023-01-15",
			end_date: "2023-01-28",
			status: "unstarted",
			app_url: "https://app.shortcut.com/test/iteration/2",
			stats: {
				num_stories_backlog: 1,
				num_stories_unstarted: 2,
				num_stories_started: 3,
				num_stories_done: 4,
			},
		} as Iteration,
	];

	const createMockClient = (methods?: object) =>
		({
			getCurrentUser: mock(async () => mockCurrentUser),
			...methods,
		}) as unknown as ShortcutClientWrapper;

	describe("create method", () => {
		test("should register the correct tools with the server", () => {
			const mockClient = createMockClient();
			const mockTool = mock();
			const mockServer = { tool: mockTool } as unknown as McpServer;

			IterationTools.create(mockClient, mockServer);

			expect(mockTool).toHaveBeenCalledTimes(4);
			expect(mockTool.mock.calls?.[0]?.[0]).toBe("get-iteration-stories");
			expect(mockTool.mock.calls?.[1]?.[0]).toBe("get-iteration");
			expect(mockTool.mock.calls?.[2]?.[0]).toBe("search-iterations");
			expect(mockTool.mock.calls?.[3]?.[0]).toBe("create-iteration");
		});
	});

	describe("getIterationStories method", () => {
		const listIterationStoriesMock = mock(async () => ({ stories: mockStories }));
		const getUserMapMock = mock(async (ids: string[]) => {
			const map = new Map<string, Member>();
			for (const id of ids) {
				const member = mockMembers.find((m) => m.id === id);
				if (member) map.set(id, member);
			}
			return map;
		});

		const mockClient = createMockClient({
			listIterationStories: listIterationStoriesMock,
			getUserMap: getUserMapMock,
		});

		test("should return formatted list of stories in an iteration", async () => {
			const iterationTools = new IterationTools(mockClient);
			const result = await iterationTools.getIterationStories(1);

			expect(result.content[0].type).toBe("text");
			const textContent = String(result.content[0].text);
			expect(textContent).toContain("Result (2 stories found):");
			// Since search details might not be enabled, just check basic content
			expect(textContent).toContain("stories");
		});

		test("should throw error when stories are not found", async () => {
			const iterationTools = new IterationTools(
				createMockClient({
					listIterationStories: mock(async () => ({ stories: null })),
				}),
			);

			await expect(() => iterationTools.getIterationStories(1)).toThrow(
				"Failed to retrieve Shortcut stories in iteration with public ID: 1.",
			);
		});
	});

	describe("searchIterations method", () => {
		const searchIterationsMock = mock(async () => ({
			iterations: mockIterations,
			total: mockIterations.length,
		}));

		test("should return formatted list of iterations when iterations are found", async () => {
			const iterationTools = new IterationTools(
				createMockClient({
					searchIterations: searchIterationsMock,
				}),
			);
			const result = await iterationTools.searchIterations({});

			expect(result.content[0].type).toBe("text");
			const textContent = String(result.content[0].text);
			expect(textContent).toContain("Result (first 2 shown of 2 total iterations found):");
			expect(textContent).toContain('"id": 1');
			expect(textContent).toContain('"name": "Iteration 1"');
			expect(textContent).toContain('"id": 2');
			expect(textContent).toContain('"name": "Iteration 2"');
		});

		test("should return no iterations found message when no iterations exist", async () => {
			const iterationTools = new IterationTools(
				createMockClient({
					searchIterations: mock(async () => ({ iterations: [], total: 0 })),
				}),
			);

			const result = await iterationTools.searchIterations({});

			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toBe("Result: No iterations found.");
		});

		test("should throw error when iterations search fails", async () => {
			const iterationTools = new IterationTools(
				createMockClient({
					searchIterations: mock(async () => ({ iterations: null, total: 0 })),
				}),
			);

			await expect(() => iterationTools.searchIterations({})).toThrow(
				"Failed to search for iterations matching your query",
			);
		});
	});

	describe("getIteration method", () => {
		const getIterationMock = mock(async (id: number) =>
			mockIterations.find((iteration) => iteration.id === id),
		);

		test("should return formatted iteration details when iteration is found", async () => {
			const iterationTools = new IterationTools(
				createMockClient({
					getIteration: getIterationMock,
				}),
			);
			const result = await iterationTools.getIteration(1);

			expect(result.content[0].type).toBe("text");
			const textContent = String(result.content[0].text);
			expect(textContent).toContain("Iteration: 1");
			expect(textContent).toContain('"id": 1');
			expect(textContent).toContain('"name": "Iteration 1"');
			expect(textContent).toContain('"description": "Description for Iteration 1"');
			expect(textContent).toContain('"start_date": "2023-01-01"');
			expect(textContent).toContain('"end_date": "2023-01-14"');
			expect(textContent).toContain('"status": "started"');
			expect(textContent).toContain('"app_url": "https://app.shortcut.com/test/iteration/1"');
		});

		test("should handle iteration not found", async () => {
			const iterationTools = new IterationTools(
				createMockClient({
					getIteration: mock(async () => null),
				}),
			);

			await expect(() => iterationTools.getIteration(999)).toThrow(
				"Failed to retrieve Shortcut iteration with public ID: 999.",
			);
		});

		test("should handle completed iteration", async () => {
			const iterationTools = new IterationTools(
				createMockClient({
					getIteration: mock(async () => ({
						...mockIterations[0],
						status: "completed",
					})),
				}),
			);

			const result = await iterationTools.getIteration(1);

			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toContain('"status": "completed"');
		});
	});

	describe("createIteration method", () => {
		const createIterationMock = mock(async (_: CreateIteration) => ({
			id: 1,
			name: "Iteration 1",
			description: "Description for Iteration 1",
			start_date: "2023-01-01",
			end_date: "2023-01-14",
			app_url: "https://app.shortcut.com/test/iteration/1",
		}));

		const mockClient = createMockClient({
			createIteration: createIterationMock,
		});

		test("should create a new iteration and return its details", async () => {
			const iterationTools = new IterationTools(mockClient);
			const result = await iterationTools.createIteration({
				name: "Test Iteration",
				startDate: "2023-01-01",
				endDate: "2023-01-14",
				description: "Test Iteration created by the Shortcut MCP server",
			});

			expect(result.content[0].text).toBe("Iteration created with ID: 1.");
		});
	});
});
