import { describe, expect, type Mock, mock, test } from "bun:test";
import type ShortcutClient from "@shortcut/client";
import type { CreateStoryParams, UpdateStory } from "@shortcut/client";
import { ShortcutClientWrapper } from "./shortcut";

describe("ShortcutClientWrapper", () => {
	describe("Users and Members", () => {
		const users = new Map([
			[
				"1",
				{
					id: "1",
					mention_name: "dyson",
					name: "Miles Dyson",
					email_address: "miles.dyson@cyberdyne.com",
				},
			],
			[
				"2",
				{
					id: "2",
					mention_name: "bw",
					name: "Blair Williams",
					email_address: "bwilliams@resistance.org",
				},
			],
		]);
		const mockClient = {
			getCurrentMemberInfo: mock(async () => ({ data: users.get("1") })),
			getMember: mock(async (id: string) => ({ data: users.get(id) || null })),
			listMembers: mock(async () => ({ data: Array.from(users.values()) })),
		} as unknown as ShortcutClient;
		const client = new ShortcutClientWrapper(mockClient);

		describe("getCurrentUser", () => {
			test("should fetch first time and return cached user after that", async () => {
				const user1 = await client.getCurrentUser();
				expect(user1).not.toBeNull();
				expect(mockClient.getCurrentMemberInfo).toHaveBeenCalledTimes(1);

				const user2 = await client.getCurrentUser();
				expect(user1).toBe(user2);
				expect(mockClient.getCurrentMemberInfo).toHaveBeenCalledTimes(1);
			});
		});

		describe("getUser", () => {
			test("should fetch user by ID", async () => {
				const user = await client.getUser("2");
				expect(user).not.toBeNull();
				expect(mockClient.getMember).toHaveBeenCalledWith("2", {});
			});
		});

		describe("getUsers", () => {
			test("should load members first but then use cache", async () => {
				const users1 = await client.getUsers(["1", "2"]);
				expect(users1.length).toBe(2);
				expect(mockClient.listMembers).toHaveBeenCalledTimes(1);
				const users2 = await client.getUsers(["1", "2"]);
				expect(users2.length).toBe(2);
				expect(mockClient.listMembers).toHaveBeenCalledTimes(1);
			});

			test("should exclude users not found", async () => {
				const users = await client.getUsers(["1", "3"]);
				expect(users.length).toBe(1);
			});
		});

		describe("getUserMap", () => {
			test("should load members first but then use cache", async () => {
				const users1 = await client.getUserMap(["1", "2"]);
				expect(users1.size).toBe(2);
				expect(mockClient.listMembers).toHaveBeenCalledTimes(1);
				const users2 = await client.getUserMap(["1", "2"]);
				expect(users2.size).toBe(2);
				expect(mockClient.listMembers).toHaveBeenCalledTimes(1);
			});

			test("should exclude users not found", async () => {
				const users = await client.getUserMap(["1", "3"]);
				expect(users.size).toBe(1);
			});
		});
	});

	describe("Workflows", () => {
		const workflows = new Array(2)
			.fill(null)
			.map((_, i) => ({ id: i + 1, name: `Workflow ${i + 1}` }));
		const mockClient = {
			getWorkflow: mock(async (id: number) => ({ data: workflows.find((w) => w.id === id) })),
			listWorkflows: mock(async () => ({ data: workflows })),
		} as unknown as ShortcutClient;
		const client = new ShortcutClientWrapper(mockClient);

		describe("getWorkflows", () => {
			test("should load workflows first but then use cache", async () => {
				const workflows1 = await client.getWorkflows();
				expect(workflows1.length).toBe(2);
				expect(mockClient.listWorkflows).toHaveBeenCalledTimes(1);
				const workflows2 = await client.getWorkflows();
				expect(workflows2.length).toBe(2);
				expect(mockClient.listWorkflows).toHaveBeenCalledTimes(1);
			});
		});

		describe("getWorkflowMap", () => {
			test("should load workflows first but then use cache", async () => {
				const workflows1 = await client.getWorkflowMap([1, 2]);
				expect(workflows1.size).toBe(2);
				expect(mockClient.listWorkflows).toHaveBeenCalledTimes(1);
				const workflows2 = await client.getWorkflowMap([1, 2]);
				expect(workflows2.size).toBe(2);
				expect(mockClient.listWorkflows).toHaveBeenCalledTimes(1);
			});

			test("should exclude workflows not found", async () => {
				const workflows = await client.getWorkflowMap([1, 3]);
				expect(workflows.size).toBe(1);
			});
		});

		describe("getWorkflow", () => {
			test("should fetch workflow by ID", async () => {
				const workflow = await client.getWorkflow(1);
				expect(workflow).not.toBeNull();
			});
		});
	});

	describe("Teams", () => {
		const teams = new Array(2)
			.fill(null)
			.map((_, i) => ({ id: String(i + 1), name: `Team ${i + 1}` }));
		const mockClient = {
			listGroups: mock(async () => ({ data: teams })),
			getGroup: mock(async (id: string) => ({ data: teams.find((t) => t.id === id) })),
		} as unknown as ShortcutClient;
		const client = new ShortcutClientWrapper(mockClient);

		describe("getTeams", () => {
			test("should fetch all teams", async () => {
				const teams = await client.getTeams();
				expect(teams.length).toBe(2);
			});
		});

		describe("getTeam", () => {
			test("should fetch team by ID", async () => {
				const team = await client.getTeam("1");
				expect(team).not.toBeNull();
			});
		});
	});

	describe("Stories", () => {
		const stories = new Array(2).fill(null).map((_, i) => ({ id: i + 1, name: `Story ${i + 1}` }));
		const mockClient = {
			listStories: mock(async () => ({ data: stories })),
			getStory: mock(async (id: number) => ({ data: stories.find((s) => s.id === id) })),
			createStory: mock(async (params: CreateStoryParams) => ({ data: params })),
			updateStory: mock(async (id: number, params: UpdateStory) => ({
				data: { ...stories.find((s) => s.id === id), ...params },
			})),
			searchStories: mock(async () => ({ data: { data: stories, total: stories.length } })),
		} as unknown as ShortcutClient;
		const client = new ShortcutClientWrapper(mockClient);

		describe("createStory", () => {
			test("should create a story", async () => {
				const story = await client.createStory({
					name: "Test Story",
					workflow_state_id: 1,
					owner_ids: ["1"],
				});

				expect(story).not.toBeNull();
				expect(mockClient.createStory).toHaveBeenCalled();
			});

			test("should throw if story creation failed", async () => {
				(mockClient.createStory as Mock<() => Promise<unknown>>).mockImplementationOnce(() =>
					Promise.resolve(null),
				);
				await expect(
					async () =>
						await client.createStory({
							name: "Test Story",
							workflow_state_id: 1,
							owner_ids: ["1"],
						}),
				).toThrow();
			});
		});

		describe("updateStory", () => {
			test("should update a story", async () => {
				const story = await client.updateStory(1, {
					name: "Test Story",
					workflow_state_id: 1,
					owner_ids: ["1"],
				});

				expect(story).not.toBeNull();
				expect(mockClient.updateStory).toHaveBeenCalled();
			});

			test("should throw if story update failed", async () => {
				(mockClient.updateStory as Mock<() => Promise<unknown>>).mockImplementationOnce(() =>
					Promise.resolve(null),
				);
				await expect(
					async () =>
						await client.updateStory(1, {
							name: "Test Story",
							workflow_state_id: 1,
							owner_ids: ["1"],
						}),
				).toThrow();
			});
		});

		describe("searchStories", () => {
			test("should search stories", async () => {
				const { stories, total } = await client.searchStories("Test Story");
				expect(stories?.length).toBe(2);
				expect(total).toBe(2);
				expect(mockClient.searchStories).toHaveBeenCalled();
			});
		});

		describe("getStory", () => {
			test("should fetch story by ID", async () => {
				const story = await client.getStory(1);
				expect(story).not.toBeNull();
				expect(mockClient.getStory).toHaveBeenCalledWith(1);
			});
		});
	});

	describe("Iterations", () => {
		const iterations = new Array(2)
			.fill(null)
			.map((_, i) => ({ id: i + 1, name: `Iteration ${i + 1}` }));
		const mockClient = {
			getIteration: mock(async (id: number) => ({ data: iterations.find((i) => i.id === id) })),
			searchIterations: mock(async () => ({
				data: { data: iterations, total: iterations.length },
			})),
			listIterationStories: mock(async () => ({ data: [{ id: 1, name: `Story ${1}` }], total: 1 })),
		} as unknown as ShortcutClient;
		const client = new ShortcutClientWrapper(mockClient);

		describe("searchIterations", () => {
			test("should search iterations", async () => {
				const { iterations, total } = await client.searchIterations("Test Iteration");
				expect(iterations?.length).toBe(2);
				expect(total).toBe(2);
				expect(mockClient.searchIterations).toHaveBeenCalled();
			});
		});

		describe("listIterationStories", () => {
			test("should list stories for an iteration", async () => {
				const { stories, total } = await client.listIterationStories(1);
				expect(stories?.length).toBe(1);
				expect(total).toBe(1);
				expect(mockClient.listIterationStories).toHaveBeenCalled();
			});

			test("should return null if stories not found", async () => {
				(mockClient.listIterationStories as Mock<() => Promise<unknown>>).mockImplementationOnce(
					() => Promise.resolve({ data: null }),
				);
				const { stories, total } = await client.listIterationStories(2);
				expect(stories).toBeNull();
				expect(total).toBeNull();
				expect(mockClient.listIterationStories).toHaveBeenCalled();
			});
		});

		test("should fetch iteration by ID", async () => {
			const iteration = await client.getIteration(1);
			expect(iteration).not.toBeNull();
			expect(mockClient.getIteration).toHaveBeenCalledWith(1);
		});
	});

	describe("Epics", () => {
		const epics = new Array(2).fill(null).map((_, i) => ({ id: i + 1, name: `Epic ${i + 1}` }));
		const mockClient = {
			searchEpics: mock(async () => ({ data: { data: epics, total: epics.length } })),
			getEpic: mock(async (id: number) => ({ data: epics.find((e) => e.id === id) })),
		} as unknown as ShortcutClient;
		const client = new ShortcutClientWrapper(mockClient);

		describe("getEpic", () => {
			test("should fetch epic by ID", async () => {
				const epic = await client.getEpic(1);
				expect(epic).not.toBeNull();
				expect(mockClient.getEpic).toHaveBeenCalledWith(1);
			});
		});

		describe("searchEpics", () => {
			test("should search epics", async () => {
				const { epics, total } = await client.searchEpics("Test Epic");
				expect(epics?.length).toBe(2);
				expect(total).toBe(2);
				expect(mockClient.searchEpics).toHaveBeenCalled();
			});
		});
	});

	describe("Milestones", () => {
		const milestones = new Array(2)
			.fill(null)
			.map((_, i) => ({ id: i + 1, name: `Milestone ${i + 1}` }));
		const mockClient = {
			searchMilestones: mock(async () => ({
				data: { data: milestones, total: milestones.length },
			})),
			getMilestone: mock(async (id: number) => ({ data: milestones.find((m) => m.id === id) })),
		} as unknown as ShortcutClient;
		const client = new ShortcutClientWrapper(mockClient);

		describe("getMilestone", () => {
			test("should fetch milestone by ID", async () => {
				const milestone = await client.getMilestone(1);
				expect(milestone).not.toBeNull();
				expect(mockClient.getMilestone).toHaveBeenCalledWith(1);
			});
		});

		describe("searchMilestones", () => {
			test("should search milestones", async () => {
				const { milestones, total } = await client.searchMilestones("Test Milestone");
				expect(milestones?.length).toBe(2);
				expect(total).toBe(2);
				expect(mockClient.searchMilestones).toHaveBeenCalled();
			});
		});
	});
});
