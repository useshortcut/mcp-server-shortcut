import { describe, expect, mock, test } from "bun:test";
import type { CreateIteration, Iteration, Member, MemberInfo, Story } from "@shortcut/client";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { CustomMcpServer } from "@/mcp/CustomMcpServer";
import { IterationTools } from "./iterations";
import { getTextContent } from "./utils/test-helpers";

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
		} as unknown as Member,
	];

	const mockStories: Story[] = [
		{
			entity_type: "story",
			id: 123,
			name: "Test Story 1",
			story_type: "feature",
			owner_ids: ["user1"],
			group_id: null,
			epic_id: null,
			iteration_id: null,
			workflow_id: null,
			workflow_state_id: 1,
			requested_by_id: null,
			follower_ids: [],
			app_url: "https://app.shortcut.com/test/story/123",
			archived: false,
		} as unknown as Story,
		{
			entity_type: "story",
			id: 456,
			name: "Test Story 2",
			story_type: "bug",
			owner_ids: ["user1", "user2"],
			group_id: null,
			epic_id: null,
			iteration_id: null,
			workflow_id: null,
			workflow_state_id: 1,
			requested_by_id: null,
			follower_ids: [],
			app_url: "https://app.shortcut.com/test/story/456",
			archived: false,
		} as unknown as Story,
	];

	const mockIterations: Iteration[] = [
		{
			entity_type: "iteration",
			id: 1,
			name: "Iteration 1",
			description: "Description for Iteration 1",
			start_date: "2023-01-01",
			end_date: "2023-01-14",
			status: "started",
			app_url: "https://app.shortcut.com/test/iteration/1",
			group_ids: [],
			follower_ids: [],
			stats: {
				num_stories_backlog: 1,
				num_stories_unstarted: 2,
				num_stories_started: 3,
				num_stories_done: 4,
			},
		} as unknown as Iteration,
		{
			entity_type: "iteration",
			id: 2,
			name: "Iteration 2",
			description: "Description for Iteration 2",
			start_date: "2023-01-15",
			end_date: "2023-01-28",
			status: "unstarted",
			app_url: "https://app.shortcut.com/test/iteration/2",
			group_ids: [],
			follower_ids: [],
			stats: {
				num_stories_backlog: 1,
				num_stories_unstarted: 2,
				num_stories_started: 3,
				num_stories_done: 4,
			},
		} as unknown as Iteration,
	];

	const mockTeams = [
		{
			id: "team1",
			name: "Team 1",
			mention_name: "@team1",
			member_ids: ["user1"],
			workflow_ids: [1],
			archived: false,
		},
		{
			id: "team2",
			name: "Team 2",
			mention_name: "@team2",
			member_ids: ["user2"],
			workflow_ids: [2],
			archived: false,
		},
	];

	const createMockClient = (methods?: object) =>
		({
			getCurrentUser: mock(async () => mockCurrentUser),
			getUserMap: mock(async () => new Map()),
			getWorkflowMap: mock(async () => new Map()),
			getTeamMap: mock(async () => new Map()),
			getMilestone: mock(async () => null),
			getIteration: mock(async () => null),
			getEpic: mock(async () => null),
			...methods,
		}) as unknown as ShortcutClientWrapper;

	describe("create method", () => {
		test("should register the correct tools with the server", () => {
			const mockClient = createMockClient();
			const mockToolRead = mock();
			const mockToolWrite = mock();
			const mockServer = {
				addToolWithReadAccess: mockToolRead,
				addToolWithWriteAccess: mockToolWrite,
			} as unknown as CustomMcpServer;

			IterationTools.create(mockClient, mockServer);

			expect(mockToolRead).toHaveBeenCalledTimes(5);
			expect(mockToolRead.mock.calls?.[0]?.[0]).toBe("iterations-get-stories");
			expect(mockToolRead.mock.calls?.[1]?.[0]).toBe("iterations-get-by-id");
			expect(mockToolRead.mock.calls?.[2]?.[0]).toBe("iterations-search");
			expect(mockToolRead.mock.calls?.[3]?.[0]).toBe("iterations-get-active");
			expect(mockToolRead.mock.calls?.[4]?.[0]).toBe("iterations-get-upcoming");

			expect(mockToolWrite).toHaveBeenCalledTimes(3);
			expect(mockToolWrite.mock.calls?.[0]?.[0]).toBe("iterations-create");
			expect(mockToolWrite.mock.calls?.[1]?.[0]).toBe("iterations-update");
			expect(mockToolWrite.mock.calls?.[2]?.[0]).toBe("iterations-delete");
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
			const result = await iterationTools.getIterationStories(1, false);

			const textContent = getTextContent(result);
			expect(textContent).toContain("Result (2 stories found):");
			// Since search details might not be enabled, just check basic content
			expect(textContent).toContain('"name": "Test Story 1"');
			expect(textContent).toContain('"name": "Test Story 2"');
		});

		test("should throw error when stories are not found", async () => {
			const iterationTools = new IterationTools(
				createMockClient({
					listIterationStories: mock(async () => ({ stories: null })),
				}),
			);

			await expect(() => iterationTools.getIterationStories(1, false)).toThrow(
				"Failed to retrieve Shortcut stories in iteration with public ID: 1",
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

			const textContent = getTextContent(result);
			expect(textContent).toContain("Result (2 shown of 2 total iterations found):");
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

			expect(getTextContent(result)).toBe("Result: No iterations found.");
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
			const result = await iterationTools.getIteration(1, true);

			const textContent = getTextContent(result);
			expect(textContent).toContain("Iteration: 1");
			expect(textContent).toContain('"id": 1');
			expect(textContent).toContain('"name": "Iteration 1"');
			expect(textContent).toContain('"description": "Description for Iteration 1"');
			expect(textContent).toContain('"start_date": "2023-01-01"');
			expect(textContent).toContain('"end_date": "2023-01-14"');
			expect(textContent).toContain('"status": "started"');
			expect(textContent).toContain('"app_url": "https://app.shortcut.com/test/iteration/1"');
		});

		test("should return simplified iteration when full = false", async () => {
			const iterationTools = new IterationTools(
				createMockClient({
					getIteration: getIterationMock,
				}),
			);
			const result = await iterationTools.getIteration(1, false);

			const textContent = getTextContent(result);
			expect(textContent).toContain("Iteration: 1");
			expect(textContent).toContain('"id": 1');
			expect(textContent).toContain('"name": "Iteration 1"');

			// When full = false, should have simplified entity structure
			expect(textContent).toContain('"iteration"');
			expect(textContent).toContain('"relatedEntities"');
		});

		test("should handle iteration not found", async () => {
			const iterationTools = new IterationTools(
				createMockClient({
					getIteration: mock(async () => null),
				}),
			);

			await expect(() => iterationTools.getIteration(999)).toThrow(
				"Failed to retrieve Shortcut iteration with public ID: 999",
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

			expect(getTextContent(result)).toContain('"status": "completed"');
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

			expect(getTextContent(result)).toBe("Iteration created with ID: 1.");
		});
	});

	describe("getActiveIterations method", () => {
		test("should return active iteration for specific team", async () => {
			const activeIteration = mockIterations[0];
			const iterationTools = new IterationTools(
				createMockClient({
					getTeam: mock(async (id: string) => mockTeams.find((team) => team.id === id)),
					getActiveIteration: mock(async () => new Map([["team1", [activeIteration]]])),
				}),
			);

			const result = await iterationTools.getActiveIterations("team1");

			const textContent = getTextContent(result);
			expect(textContent).toContain("The active iteration for the team is:");
			expect(textContent).toContain('"name": "Iteration 1"');
		});

		test("should return no active iterations message when no active iteration for team", async () => {
			const iterationTools = new IterationTools(
				createMockClient({
					getTeam: mock(async (id: string) => mockTeams.find((team) => team.id === id)),
					getActiveIteration: mock(async () => new Map()),
				}),
			);

			const result = await iterationTools.getActiveIterations("team1");

			expect(getTextContent(result)).toBe("Result: No active iterations found for team.");
		});

		test("should throw error when team not found", async () => {
			const iterationTools = new IterationTools(
				createMockClient({
					getTeam: mock(async () => null),
				}),
			);

			await expect(() => iterationTools.getActiveIterations("nonexistent")).toThrow(
				'No team found matching id: "nonexistent"',
			);
		});

		test("should return active iterations for current user's teams", async () => {
			const activeIterations = [mockIterations[0], mockIterations[1]];
			const iterationTools = new IterationTools(
				createMockClient({
					getTeams: mock(async () => mockTeams),
					getActiveIteration: mock(
						async () =>
							new Map([
								["team1", activeIterations[0]],
								["team2", activeIterations[1]],
							]),
					),
				}),
			);

			const result = await iterationTools.getActiveIterations();

			const textContent = getTextContent(result);
			expect(textContent).toContain("You have 2 active iterations for your teams:");
			expect(textContent).toContain('"name": "Iteration 1"');
			expect(textContent).toContain('"name": "Iteration 2"');
		});

		test("should return no active iterations message when user has no active iterations", async () => {
			const iterationTools = new IterationTools(
				createMockClient({
					getTeams: mock(async () => mockTeams),
					getActiveIteration: mock(async () => new Map()),
				}),
			);

			const result = await iterationTools.getActiveIterations();

			expect(getTextContent(result)).toBe(
				"Result: No active iterations found for any of your teams.",
			);
		});

		test("should throw error when current user not found", async () => {
			const iterationTools = new IterationTools(
				createMockClient({
					getCurrentUser: mock(async () => null),
				}),
			);

			await expect(() => iterationTools.getActiveIterations()).toThrow(
				"Failed to retrieve current user.",
			);
		});

		test("should throw error when user belongs to no teams", async () => {
			const iterationTools = new IterationTools(
				createMockClient({
					getTeams: mock(async () => []),
				}),
			);

			await expect(() => iterationTools.getActiveIterations()).toThrow(
				"Current user does not belong to any teams.",
			);
		});
	});

	describe("getUpcomingIterations method", () => {
		test("should return upcoming iteration for specific team", async () => {
			const upcomingIteration = mockIterations[1];
			const iterationTools = new IterationTools(
				createMockClient({
					getTeam: mock(async (id: string) => mockTeams.find((team) => team.id === id)),
					getUpcomingIteration: mock(async () => new Map([["team1", [upcomingIteration]]])),
				}),
			);

			const result = await iterationTools.getUpcomingIterations("team1");

			const textContent = getTextContent(result);
			expect(textContent).toContain("The next upcoming iteration for the team is:");
			expect(textContent).toContain('"name": "Iteration 2"');
		});

		test("should return no upcoming iterations message when no upcoming iteration for team", async () => {
			const iterationTools = new IterationTools(
				createMockClient({
					getTeam: mock(async (id: string) => mockTeams.find((team) => team.id === id)),
					getUpcomingIteration: mock(async () => new Map()),
				}),
			);

			const result = await iterationTools.getUpcomingIterations("team1");

			expect(getTextContent(result)).toBe("Result: No upcoming iterations found for team.");
		});

		test("should return upcoming iterations for current user's teams", async () => {
			const upcomingIterations = [mockIterations[0], mockIterations[1]];
			const iterationTools = new IterationTools(
				createMockClient({
					getTeams: mock(async () => mockTeams),
					getUpcomingIteration: mock(
						async () =>
							new Map([
								["team1", upcomingIterations[0]],
								["team2", upcomingIterations[1]],
							]),
					),
				}),
			);

			const result = await iterationTools.getUpcomingIterations();

			const textContent = getTextContent(result);
			expect(textContent).toContain("The upcoming iterations for all your teams are:");
			expect(textContent).toContain('"name": "Iteration 1"');
			expect(textContent).toContain('"name": "Iteration 2"');
		});

		test("should return no upcoming iterations message when user has no upcoming iterations", async () => {
			const iterationTools = new IterationTools(
				createMockClient({
					getTeams: mock(async () => mockTeams),
					getUpcomingIteration: mock(async () => new Map()),
				}),
			);

			const result = await iterationTools.getUpcomingIterations();

			expect(getTextContent(result)).toBe(
				"Result: No upcoming iterations found for any of your teams.",
			);
		});
	});

	describe("updateIteration method", () => {
		const getIterationMock = mock(async (id: number) =>
			mockIterations.find((iteration) => iteration.id === id),
		);

		test("should update iteration with provided fields", async () => {
			const updateIterationMock = mock(async (_id: number, _params: Record<string, unknown>) => ({
				id: 1,
				name: "Updated Iteration 1",
				app_url: "https://app.shortcut.com/test/iteration/1",
			}));
			const iterationTools = new IterationTools(
				createMockClient({
					getIteration: getIterationMock,
					updateIteration: updateIterationMock,
				}),
			);
			const result = await iterationTools.updateIteration({
				iterationPublicId: 1,
				name: "Updated Iteration 1",
				description: "Updated description",
				startDate: "2023-02-01",
				endDate: "2023-02-14",
			});

			expect(getTextContent(result)).toBe(
				"Updated iteration 1. Iteration URL: https://app.shortcut.com/test/iteration/1",
			);
			expect(updateIterationMock).toHaveBeenCalledTimes(1);
			expect(updateIterationMock.mock.calls?.[0]?.[0]).toBe(1);
			expect(updateIterationMock.mock.calls?.[0]?.[1]).toMatchObject({
				name: "Updated Iteration 1",
				description: "Updated description",
				start_date: "2023-02-01",
				end_date: "2023-02-14",
			});
		});

		test("should throw error when iteration public ID is not provided", async () => {
			const updateIterationMock = mock(async (_id: number, _params: Record<string, unknown>) => ({
				id: 1,
				name: "Updated Iteration 1",
				app_url: "https://app.shortcut.com/test/iteration/1",
			}));
			const iterationTools = new IterationTools(
				createMockClient({
					getIteration: getIterationMock,
					updateIteration: updateIterationMock,
				}),
			);

			// @ts-ignore - Testing runtime check for missing ID
			await expect(() => iterationTools.updateIteration({})).toThrow(
				"Failed to retrieve Shortcut iteration with public ID: undefined",
			);
		});

		test("should throw error when iteration is not found", async () => {
			const updateIterationMock = mock(async (_id: number, _params: Record<string, unknown>) => ({
				id: 1,
				name: "Updated Iteration 1",
				app_url: "https://app.shortcut.com/test/iteration/1",
			}));
			const iterationTools = new IterationTools(
				createMockClient({
					getIteration: mock(async () => null),
					updateIteration: updateIterationMock,
				}),
			);

			await expect(() =>
				iterationTools.updateIteration({
					iterationPublicId: 999,
					name: "Updated Iteration",
				}),
			).toThrow("Failed to retrieve Shortcut iteration with public ID: 999");
		});

		test("should handle team_ids update", async () => {
			const updateIterationMock = mock(async (_id: number, _params: Record<string, unknown>) => ({
				id: 1,
				name: "Updated Iteration 1",
				app_url: "https://app.shortcut.com/test/iteration/1",
			}));
			const iterationTools = new IterationTools(
				createMockClient({
					getIteration: getIterationMock,
					updateIteration: updateIterationMock,
				}),
			);
			await iterationTools.updateIteration({
				iterationPublicId: 1,
				team_ids: ["team1", "team2"],
			});

			expect(updateIterationMock).toHaveBeenCalledTimes(1);
			expect(updateIterationMock.mock.calls?.[0]?.[1]).toMatchObject({
				group_ids: ["team1", "team2"],
			});
		});
	});

	describe("deleteIteration method", () => {
		const getIterationMock = mock(async (id: number) =>
			mockIterations.find((iteration) => iteration.id === id),
		);
		const deleteIterationMock = mock(async (_id: number) => undefined);

		test("should delete iteration successfully", async () => {
			const iterationTools = new IterationTools(
				createMockClient({
					getIteration: getIterationMock,
					deleteIteration: deleteIterationMock,
				}),
			);
			const result = await iterationTools.deleteIteration(1);

			expect(getTextContent(result)).toBe("Deleted iteration 1.");
			expect(deleteIterationMock).toHaveBeenCalledTimes(1);
			expect(deleteIterationMock.mock.calls?.[0]?.[0]).toBe(1);
		});

		test("should throw error when iteration public ID is not provided", async () => {
			const iterationTools = new IterationTools(
				createMockClient({
					getIteration: getIterationMock,
					deleteIteration: deleteIterationMock,
				}),
			);

			// @ts-ignore - Testing runtime check for missing ID
			await expect(() => iterationTools.deleteIteration(0)).toThrow(
				"Failed to retrieve Shortcut iteration with public ID: 0",
			);
		});

		test("should throw error when iteration is not found", async () => {
			const iterationTools = new IterationTools(
				createMockClient({
					getIteration: mock(async () => null),
					deleteIteration: deleteIterationMock,
				}),
			);

			await expect(() => iterationTools.deleteIteration(999)).toThrow(
				"Failed to retrieve Shortcut iteration with public ID: 999",
			);
		});
	});
});
