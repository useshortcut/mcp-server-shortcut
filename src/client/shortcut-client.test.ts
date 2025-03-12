import { expect, test, describe, beforeEach, type Mock } from "bun:test";
import { ShortcutClient as MockClient } from "@shortcut/client";
import { ShortcutClient } from "./shortcut-client";

describe("ShortcutClient", () => {
	let client: ShortcutClient;
	let mockClient: MockClient;

	beforeEach(() => {
		client = new ShortcutClient("test-api-token");
		mockClient = new MockClient("", {});
		(MockClient as typeof MockClient & { clearAll: () => void }).clearAll();
	});

	describe("getCurrentUser", () => {
		test("should fetch first and return cached user after that", async () => {
			const user1 = await client.getCurrentUser();
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

	describe("getTeams and getTeam", () => {
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

	describe("getStory, getEpic, getIteration, and getMilestone", () => {
		test("should fetch story by ID", async () => {
			const story = await client.getStory(1);
			expect(story).not.toBeNull();
			expect(mockClient.getStory).toHaveBeenCalledWith(1);
		});

		test("should fetch epic by ID", async () => {
			const epic = await client.getEpic(1);
			expect(epic).not.toBeNull();
			expect(mockClient.getEpic).toHaveBeenCalledWith(1);
		});

		test("should fetch iteration by ID", async () => {
			const iteration = await client.getIteration(1);
			expect(iteration).not.toBeNull();
			expect(mockClient.getIteration).toHaveBeenCalledWith(1);
		});

		test("should fetch milestone by ID", async () => {
			const milestone = await client.getMilestone(1);
			expect(milestone).not.toBeNull();
			expect(mockClient.getMilestone).toHaveBeenCalledWith(1);
		});
	});

	describe("search methods", () => {
		test("should search stories", async () => {
			const { stories, total } = await client.searchStories("Test Story");
			expect(stories?.length).toBe(1);
			expect(total).toBe(1);
			expect(mockClient.searchStories).toHaveBeenCalled();
		});

		test("should search iterations", async () => {
			const { iterations, total } = await client.searchIterations("Test Iteration");
			expect(iterations?.length).toBe(1);
			expect(total).toBe(1);
			expect(mockClient.searchIterations).toHaveBeenCalled();
		});

		test("should search epics", async () => {
			const { epics, total } = await client.searchEpics("Test Epic");
			expect(epics?.length).toBe(1);
			expect(total).toBe(1);
			expect(mockClient.searchEpics).toHaveBeenCalled();
		});

		test("should search milestones", async () => {
			const { milestones, total } = await client.searchMilestones("Test Milestone");
			expect(milestones?.length).toBe(1);
			expect(total).toBe(1);
			expect(mockClient.searchMilestones).toHaveBeenCalled();
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
			(mockClient.listIterationStories as Mock<() => Promise<unknown>>).mockImplementationOnce(() =>
				Promise.resolve({ data: null }),
			);
			const { stories, total } = await client.listIterationStories(2);
			expect(stories).toBeNull();
			expect(total).toBeNull();
			expect(mockClient.listIterationStories).toHaveBeenCalled();
		});
	});
});
