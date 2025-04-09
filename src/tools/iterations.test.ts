import { describe, expect, mock, spyOn, test } from "bun:test";
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

	const mockTeam = {
		id: "team1",
		name: "Test Team",
		workflow_ids: [1],
	};

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

		test("should call correct function from tool", async () => {
			const mockClient = createMockClient();
			const mockTool = mock();
			const mockServer = { tool: mockTool } as unknown as McpServer;

			const tools = IterationTools.create(mockClient, mockServer);

			spyOn(tools, "getIterationStories").mockImplementation(async () => ({
				content: [{ text: "", type: "text" }],
			}));
			await mockTool.mock.calls?.[0]?.[3]({ iterationPublicId: 1 });
			expect(tools.getIterationStories).toHaveBeenCalledWith(1);

			spyOn(tools, "getIteration").mockImplementation(async () => ({
				content: [{ text: "", type: "text" }],
			}));
			await mockTool.mock.calls?.[1]?.[3]({ iterationPublicId: 1 });
			expect(tools.getIteration).toHaveBeenCalledWith(1);

			spyOn(tools, "searchIterations").mockImplementation(async () => ({
				content: [{ text: "[None]", type: "text" }],
			}));
			await mockTool.mock.calls?.[2]?.[3]({ name: "test" });
			expect(tools.searchIterations).toHaveBeenCalledWith({ name: "test" });

			spyOn(tools, "createIteration").mockImplementation(async () => ({
				content: [{ text: "", type: "text" }],
			}));
			await mockTool.mock.calls?.[3]?.[3]({
				name: "Test Iteration",
				description: "Test Iteration created by the Shortcut MCP server",
				startDate: "2023-01-01",
				endDate: "2023-01-14",
				groupId: "group1",
			});
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
			expect(String(result.content[0].text).split("\n")).toMatchObject([
				"Result (2 stories found):",
				"- sc-123: Test Story 1 (Type: feature, State: Not Started, Team: [None], Epic: [None], Iteration: [None], Owners: @testuser)",
				"- sc-456: Test Story 2 (Type: bug, State: Not Started, Team: [None], Epic: [None], Iteration: [None], Owners: @testuser, @jane)",
			]);
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
			expect(String(result.content[0].text).split("\n")).toMatchObject([
				"Result (first 2 shown of 2 total iterations found):",
				"- 1: Iteration 1 (Start date: 2023-01-01, End date: 2023-01-14)",
				"- 2: Iteration 2 (Start date: 2023-01-15, End date: 2023-01-28)",
			]);
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
			expect(String(result.content[0].text).split("\n")).toMatchObject([
				"Iteration: 1",
				"Url: https://app.shortcut.com/test/iteration/1",
				"Name: Iteration 1",
				"Start date: 2023-01-01",
				"End date: 2023-01-14",
				"Completed: No",
				"Started: Yes",
				"Team: [None]",
				"",
				"Stats:",
				"- Total stories: 10",
				"- Unstarted stories: 3",
				"- Stories in progress: 3",
				"- Completed stories: 4",
				"",
				"Description:",
				"Description for Iteration 1",
			]);
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
			expect(result.content[0].text).toContain("Completed: Yes");
			expect(result.content[0].text).toContain("Started: No");
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

		const getTeamMock = mock(async () => mockTeam);

		const mockClient = createMockClient({
			createIteration: createIterationMock,
			getTeam: getTeamMock,
		});

		test("should create a new iteration and return its details", async () => {
			const iterationTools = new IterationTools(mockClient);
			const result = await iterationTools.createIteration(
				"team1",
				"2023-01-01",
				"2023-01-14",
				"Test Iteration",
				"Test Iteration created by the Shortcut MCP server",
			);

			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toContain("Iteration created successfully:");
			expect(result.content[0].text).toContain("Iteration ID: 1");
			expect(String(result.content[0].text).split("\n")).toMatchObject([
				"Iteration created successfully:",
				"Iteration ID: 1",
				"Iteration URL: https://app.shortcut.com/test/iteration/1",
				"Iteration Name: Iteration 1",
				"Iteration Start Date: 2023-01-01",
				"Iteration End Date: 2023-01-14",
			]);
		});

		test("should throw error when group ID is not provided", async () => {
			const iterationTools = new IterationTools(mockClient);

			await expect(() =>
				iterationTools.createIteration("", "2023-01-01", "2023-01-14", "Test Iteration"),
			).toThrow("Group ID is required to create an iteration.");
		});

		test("should throw error when group is not found", async () => {
			const iterationTools = new IterationTools(
				createMockClient({
					getTeam: mock(async () => null),
				}),
			);

			await expect(() =>
				iterationTools.createIteration(
					"nonexistent-group",
					"2023-01-01",
					"2023-01-14",
					"Test Iteration",
				),
			).toThrow("Group with ID nonexistent-group not found");
		});
	});
});
