import { expect, test, describe, mock, beforeEach, spyOn } from "bun:test";
import { StoryTools } from "./stories";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
	StoryComment,
	Member,
	Story,
	Workflow,
	CreateStoryParams,
	UpdateStory,
	MemberInfo,
} from "@shortcut/client";

describe("StoryTools", () => {
	const mockCurrentUser = {
		id: "user1",
		mention_name: "testuser",
		name: "Test User",
	} as MemberInfo;

	const mockMembers: Member[] = [
		{
			id: mockCurrentUser.id,
			profile: {
				mention_name: mockCurrentUser.mention_name,
				name: mockCurrentUser.name,
			},
		} as Member,
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
			app_url: "https://app.shortcut.com/test/story/123",
			description: "Description for Test Story 1",
			archived: false,
			completed: false,
			started: true,
			blocked: false,
			blocker: false,
			deadline: "2023-12-31",
			owner_ids: ["user1"],
			comments: [
				{
					id: "comment1",
					author_id: "user1",
					text: "This is a comment",
					created_at: "2023-01-01T12:00:00Z",
				} as unknown as StoryComment,
			],
			formatted_vcs_branch_name: "user1/sc-123/test-story-1",
		} as unknown as Story,
		{
			id: 456,
			name: "Test Story 2",
			story_type: "bug",
			app_url: "https://app.shortcut.com/test/story/456",
			description: "Description for Test Story 2",
			archived: false,
			completed: true,
			started: true,
			blocked: false,
			blocker: false,
			deadline: null,
			owner_ids: ["user1", "user2"],
			comments: [],
		} as unknown as Story,
	];

	const mockWorkflow: Workflow = {
		id: 1,
		name: "Test Workflow",
		default_state_id: 101,
		states: [
			{ id: 101, name: "Unstarted", type: "unstarted" },
			{ id: 102, name: "Started", type: "started" },
		],
	} as Workflow;

	const mockTeam = {
		id: "team1",
		name: "Test Team",
		workflow_ids: [1],
	};

	describe("create method", () => {
		test("should register the correct tools with the server", () => {
			const mockClient = {} as ShortcutClientWrapper;
			const mockTool = mock();
			const mockServer = { tool: mockTool } as unknown as McpServer;

			StoryTools.create(mockClient, mockServer);

			expect(mockTool).toHaveBeenCalledTimes(13);
			expect(mockTool.mock.calls?.[0]?.[0]).toBe("get-story-branch-name");
			expect(mockTool.mock.calls?.[1]?.[0]).toBe("get-story");
			expect(mockTool.mock.calls?.[2]?.[0]).toBe("search-stories");
			expect(mockTool.mock.calls?.[3]?.[0]).toBe("create-story");
			expect(mockTool.mock.calls?.[4]?.[0]).toBe("assign-current-user-as-owner");
			expect(mockTool.mock.calls?.[5]?.[0]).toBe("unassign-current-user-as-owner");
			expect(mockTool.mock.calls?.[6]?.[0]).toBe("create-task");
			expect(mockTool.mock.calls?.[7]?.[0]).toBe("get-tasks");
			expect(mockTool.mock.calls?.[8]?.[0]).toBe("get-task");
			expect(mockTool.mock.calls?.[9]?.[0]).toBe("update-task");
			expect(mockTool.mock.calls?.[10]?.[0]).toBe("delete-task");
			expect(mockTool.mock.calls?.[11]?.[0]).toBe("complete-task");
			expect(mockTool.mock.calls?.[12]?.[0]).toBe("incomplete-task");
		});

		test("should call correct function from tool", async () => {
			const mockClient = {} as ShortcutClientWrapper;
			const mockTool = mock();
			const mockServer = { tool: mockTool } as unknown as McpServer;

			const tools = StoryTools.create(mockClient, mockServer);

			spyOn(tools, "getStoryBranchName").mockImplementation(async () => ({
				content: [{ text: "", type: "text" }],
			}));
			await mockTool.mock.calls?.[0]?.[3]({ storyPublicId: 123 });
			expect(tools.getStoryBranchName).toHaveBeenCalledWith(123);

			spyOn(tools, "getStory").mockImplementation(async () => ({
				content: [{ text: "", type: "text" }],
			}));
			await mockTool.mock.calls?.[1]?.[3]({ storyPublicId: 123 });
			expect(tools.getStory).toHaveBeenCalledWith(123);

			spyOn(tools, "searchStories").mockImplementation(async () => ({
				content: [{ text: "", type: "text" }],
			}));
			await mockTool.mock.calls?.[2]?.[3]({ id: 123 });
			expect(tools.searchStories).toHaveBeenCalledWith({ id: 123 });

			spyOn(tools, "createStory").mockImplementation(async () => ({
				content: [{ text: "", type: "text" }],
			}));
			await mockTool.mock.calls?.[3]?.[3]({ name: "Test Story 1" });
			expect(tools.createStory).toHaveBeenCalledWith({ name: "Test Story 1" });

			spyOn(tools, "assignCurrentUserAsOwner").mockImplementation(async () => ({
				content: [{ text: "", type: "text" }],
			}));
			await mockTool.mock.calls?.[4]?.[3]({ storyPublicId: 123 });
			expect(tools.assignCurrentUserAsOwner).toHaveBeenCalledWith(123);

			spyOn(tools, "unassignCurrentUserAsOwner").mockImplementation(async () => ({
				content: [{ text: "", type: "text" }],
			}));
			await mockTool.mock.calls?.[5]?.[3]({ storyPublicId: 123 });
			expect(tools.unassignCurrentUserAsOwner).toHaveBeenCalledWith(123);

			// Test new task operations
			spyOn(tools, "createTask").mockImplementation(async () => ({
				content: [{ text: "", type: "text" }],
			}));
			await mockTool.mock.calls?.[6]?.[3]({ storyPublicId: 123, description: "Test task" });
			expect(tools.createTask).toHaveBeenCalledWith(123, "Test task", undefined, undefined);

			spyOn(tools, "getTasks").mockImplementation(async () => ({
				content: [{ text: "", type: "text" }],
			}));
			await mockTool.mock.calls?.[7]?.[3]({ storyPublicId: 123 });
			expect(tools.getTasks).toHaveBeenCalledWith(123);

			spyOn(tools, "getTask").mockImplementation(async () => ({
				content: [{ text: "", type: "text" }],
			}));
			await mockTool.mock.calls?.[8]?.[3]({ storyPublicId: 123, taskPublicId: 456 });
			expect(tools.getTask).toHaveBeenCalledWith(123, 456);

			spyOn(tools, "updateTask").mockImplementation(async () => ({
				content: [{ text: "", type: "text" }],
			}));
			await mockTool.mock.calls?.[9]?.[3]({ 
				storyPublicId: 123, 
				taskPublicId: 456, 
				description: "Updated task",
				complete: true
			});
			expect(tools.updateTask).toHaveBeenCalledWith(123, 456, { 
				description: "Updated task", 
				complete: true,
				owner_ids: undefined
			});

			spyOn(tools, "deleteTask").mockImplementation(async () => ({
				content: [{ text: "", type: "text" }],
			}));
			await mockTool.mock.calls?.[10]?.[3]({ storyPublicId: 123, taskPublicId: 456 });
			expect(tools.deleteTask).toHaveBeenCalledWith(123, 456);

			spyOn(tools, "completeTask").mockImplementation(async () => ({
				content: [{ text: "", type: "text" }],
			}));
			await mockTool.mock.calls?.[11]?.[3]({ storyPublicId: 123, taskPublicId: 456 });
			expect(tools.completeTask).toHaveBeenCalledWith(123, 456);

			spyOn(tools, "incompleteTask").mockImplementation(async () => ({
				content: [{ text: "", type: "text" }],
			}));
			await mockTool.mock.calls?.[12]?.[3]({ storyPublicId: 123, taskPublicId: 456 });
			expect(tools.incompleteTask).toHaveBeenCalledWith(123, 456);
		});
	});

	describe("getStory method", () => {
		const getStoryMock = mock(async (id: number) => mockStories.find((story) => story.id === id));
		const getUserMapMock = mock(async (ids: string[]) => {
			const map = new Map<string, Member>();
			for (const id of ids) {
				const member = mockMembers.find((m) => m.id === id);
				if (member) map.set(id, member);
			}
			return map;
		});

		const mockClient = {
			getStory: getStoryMock,
			getUserMap: getUserMapMock,
		} as unknown as ShortcutClientWrapper;

		test("should return formatted story details when story is found", async () => {
			const storyTools = new StoryTools(mockClient);
			const result = await storyTools.getStory(123);

			expect(result.content[0].type).toBe("text");
			expect(String(result.content[0].text).split("\n")).toMatchObject([
				"Story: sc-123",
				"URL: https://app.shortcut.com/test/story/123",
				"Name: Test Story 1",
				"Type: feature",
				"Archived: No",
				"Completed: No",
				"Started: Yes",
				"Blocked: No",
				"Blocking: No",
				"Due date: 2023-12-31",
				"Team: [None]",
				"Owners:",
				"- id=user1 @testuser",
				"Epic: [None]",
				"Iteration: [None]",
				"",
				"Description:",
				"Description for Test Story 1",
				"",
				"Comments:",
				"- From: @testuser on 2023-01-01T12:00:00Z.",
				"This is a comment",
			]);
		});

		test("should handle story not found", async () => {
			const storyTools = new StoryTools({
				getStory: mock(async () => null),
			} as unknown as ShortcutClientWrapper);

			await expect(() => storyTools.getStory(999)).toThrow(
				"Failed to retrieve Shortcut story with public ID: 999.",
			);
		});

		test("should handle story with null deadline", async () => {
			const storyTools = new StoryTools({
				getStory: mock(async () => mockStories[1]),
				getUserMap: getUserMapMock,
			} as unknown as ShortcutClientWrapper);

			const result = await storyTools.getStory(456);

			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toContain("Due date: [None]");
		});
	});

	describe("searchStories method", () => {
		const searchStoriesMock = mock(async () => ({
			stories: mockStories,
			total: mockStories.length,
		}));
		const getCurrentUserMock = mock(async () => mockCurrentUser);
		const getUserMapMock = mock(async (ids: string[]) => {
			const map = new Map<string, Member>();
			for (const id of ids) {
				const member = mockMembers.find((m) => m.id === id);
				if (member) map.set(id, member);
			}
			return map;
		});

		const mockClient = {
			searchStories: searchStoriesMock,
			getCurrentUser: getCurrentUserMock,
			getUserMap: getUserMapMock,
		} as unknown as ShortcutClientWrapper;

		test("should return formatted list of stories when stories are found", async () => {
			const storyTools = new StoryTools(mockClient);
			const result = await storyTools.searchStories({});

			expect(result.content[0].type).toBe("text");
			expect(String(result.content[0].text).split("\n")).toMatchObject([
				"Result (first 2 shown of 2 total stories found):",
				"- sc-123: Test Story 1 (Type: feature, State: In Progress, Team: [None], Epic: [None], Iteration: [None], Owners: @testuser)",
				"- sc-456: Test Story 2 (Type: bug, State: Completed, Team: [None], Epic: [None], Iteration: [None], Owners: @testuser, @jane)",
			]);
		});

		test("should return no stories found message when no stories exist", async () => {
			const storyTools = new StoryTools({
				searchStories: mock(async () => ({ stories: [], total: 0 })),
				getCurrentUser: getCurrentUserMock,
			} as unknown as ShortcutClientWrapper);

			const result = await storyTools.searchStories({});

			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toBe("Result: No stories found.");
		});

		test("should throw error when stories search fails", async () => {
			const storyTools = new StoryTools({
				searchStories: mock(async () => ({ stories: null, total: 0 })),
				getCurrentUser: getCurrentUserMock,
			} as unknown as ShortcutClientWrapper);

			await expect(() => storyTools.searchStories({})).toThrow(
				"Failed to search for stories matching your query",
			);
		});
	});

	describe("createStory method", () => {
		const createStoryMock = mock(async (_: CreateStoryParams) => ({ id: 789 }));
		const getTeamMock = mock(async () => mockTeam);
		const getWorkflowMock = mock(async () => mockWorkflow);

		const mockClient = {
			createStory: createStoryMock,
			getTeam: getTeamMock,
			getWorkflow: getWorkflowMock,
		} as unknown as ShortcutClientWrapper;

		beforeEach(() => {
			createStoryMock.mockClear();
		});

		test("should create a story with workflow specified", async () => {
			const storyTools = new StoryTools(mockClient);
			const result = await storyTools.createStory({
				name: "New Story",
				description: "Description for New Story",
				type: "feature",
				workflow: 1,
			});

			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toBe("Created story: 789");
			expect(createStoryMock).toHaveBeenCalledTimes(1);
			expect(createStoryMock.mock.calls?.[0]?.[0]).toMatchObject({
				name: "New Story",
				description: "Description for New Story",
				story_type: "feature",
				workflow_state_id: mockWorkflow.default_state_id,
			});
		});

		test("should create a story with team specified", async () => {
			const storyTools = new StoryTools(mockClient);
			const result = await storyTools.createStory({
				name: "New Story",
				description: "Description for New Story",
				type: "bug",
				team: "team1",
			});

			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toBe("Created story: 789");
			expect(createStoryMock).toHaveBeenCalledTimes(1);
			expect(createStoryMock.mock.calls?.[0]?.[0]).toMatchObject({
				name: "New Story",
				description: "Description for New Story",
				story_type: "bug",
				group_id: "team1",
				workflow_state_id: mockWorkflow.default_state_id,
			});
		});

		test("should throw error when neither team nor workflow is specified", async () => {
			const storyTools = new StoryTools(mockClient);

			await expect(() =>
				storyTools.createStory({
					name: "New Story",
					type: "feature",
				}),
			).toThrow("Team or Workflow has to be specified");
		});

		test("should throw error when workflow is not found", async () => {
			const storyTools = new StoryTools({
				...mockClient,
				getWorkflow: mock(async () => null),
			} as unknown as ShortcutClientWrapper);

			await expect(() =>
				storyTools.createStory({
					name: "New Story",
					type: "feature",
					workflow: 999,
				}),
			).toThrow("Failed to find workflow");
		});
	});

	describe("assignCurrentUserAsOwner method", () => {
		const getStoryMock = mock(async () => mockStories[0]);
		const getCurrentUserMock = mock(async () => mockCurrentUser);
		const updateStoryMock = mock(async (_id: number, _args: UpdateStory) => ({ id: 123 }));

		const mockClient = {
			getStory: getStoryMock,
			getCurrentUser: getCurrentUserMock,
			updateStory: updateStoryMock,
		} as unknown as ShortcutClientWrapper;

		beforeEach(() => {
			updateStoryMock.mockClear();
		});

		test("should assign current user as owner", async () => {
			const storyTools = new StoryTools(mockClient);
			getCurrentUserMock.mockImplementationOnce(async () => ({
				...mockCurrentUser,
				id: "different-user",
			}));
			const result = await storyTools.assignCurrentUserAsOwner(123);

			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toBe("Assigned current user as owner of story sc-123");
			expect(updateStoryMock).toHaveBeenCalledTimes(1);
			expect(updateStoryMock.mock.calls?.[0]?.[0]).toBe(123);
			expect(updateStoryMock.mock.calls?.[0]?.[1]).toMatchObject({
				owner_ids: ["user1", "different-user"],
			});
		});

		test("should handle user already assigned", async () => {
			const storyTools = new StoryTools({
				...mockClient,
				getStory: mock(async () => ({
					...mockStories[0],
					owner_ids: ["user1"],
				})),
			} as unknown as ShortcutClientWrapper);

			const result = await storyTools.assignCurrentUserAsOwner(123);

			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toBe("Current user is already an owner of story sc-123");
			expect(updateStoryMock).not.toHaveBeenCalled();
		});

		test("should throw error when story is not found", async () => {
			const storyTools = new StoryTools({
				...mockClient,
				getStory: mock(async () => null),
			} as unknown as ShortcutClientWrapper);

			await expect(() => storyTools.assignCurrentUserAsOwner(999)).toThrow(
				"Failed to retrieve Shortcut story with public ID: 999",
			);
		});
	});

	describe("unassignCurrentUserAsOwner method", () => {
		const getStoryMock = mock(async () => ({
			...mockStories[0],
			owner_ids: ["user1", "user2"],
		}));
		const getCurrentUserMock = mock(async () => mockCurrentUser);
		const updateStoryMock = mock(async (_id: number, _args: UpdateStory) => ({ id: 123 }));

		const mockClient = {
			getStory: getStoryMock,
			getCurrentUser: getCurrentUserMock,
			updateStory: updateStoryMock,
		} as unknown as ShortcutClientWrapper;

		beforeEach(() => {
			updateStoryMock.mockClear();
		});

		test("should unassign current user as owner", async () => {
			const storyTools = new StoryTools(mockClient);
			const result = await storyTools.unassignCurrentUserAsOwner(123);

			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toBe("Unassigned current user as owner of story sc-123");
			expect(updateStoryMock).toHaveBeenCalledTimes(1);
			expect(updateStoryMock.mock.calls?.[0]?.[0]).toBe(123);
			expect(updateStoryMock.mock.calls?.[0]?.[1]).toMatchObject({
				owner_ids: ["user2"],
			});
		});

		test("should handle user not assigned", async () => {
			const storyTools = new StoryTools({
				...mockClient,
				getStory: mock(async () => ({
					...mockStories[0],
					owner_ids: ["user2"],
				})),
			} as unknown as ShortcutClientWrapper);

			const result = await storyTools.unassignCurrentUserAsOwner(123);

			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toBe("Current user is not an owner of story sc-123");
			expect(updateStoryMock).not.toHaveBeenCalled();
		});
	});

	describe("getStoryBranchName method", () => {
		const getStoryMock = mock(async () => mockStories[0]);
		const getCurrentUserMock = mock(async () => mockCurrentUser);

		const mockClient = {
			getStory: getStoryMock,
			getCurrentUser: getCurrentUserMock,
		} as unknown as ShortcutClientWrapper;

		test("should return branch name from api for story", async () => {
			const storyTools = new StoryTools(mockClient);
			const result = await storyTools.getStoryBranchName(123);

			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toBe(
				"Branch name for story sc-123: user1/sc-123/test-story-1",
			);
		});

		test("should generate a custom branch name if not included in api", async () => {
			const storyTools = new StoryTools({
				...mockClient,
				getStory: mock(async () => ({
					...mockStories[0],
					formatted_vcs_branch_name: null,
					name: "Story 1",
				})),
			} as unknown as ShortcutClientWrapper);

			const result = await storyTools.getStoryBranchName(123);

			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toBe("Branch name for story sc-123: testuser/sc-123/story-1");
		});

		test("should truncate long branch names when building custom branch name", async () => {
			const storyTools = new StoryTools({
				...mockClient,
				getStory: mock(async () => ({
					...mockStories[0],
					formatted_vcs_branch_name: null,
					name: "This is a very long story name that will be truncated in the branch name because it exceeds the maximum length allowed for branch names",
				})),
			} as unknown as ShortcutClientWrapper);

			const result = await storyTools.getStoryBranchName(123);

			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toBe(
				"Branch name for story sc-123: testuser/sc-123/this-is-a-very-long-story-name-tha",
			);
		});

		test("should handle special characters in story name when building custom branch name", async () => {
			const storyTools = new StoryTools({
				...mockClient,
				getStory: mock(async () => ({
					...mockStories[0],
					formatted_vcs_branch_name: null,
					name: "Special characters: !@#$%^&*()_+{}[]|\\:;\"'<>,.?/",
				})),
			} as unknown as ShortcutClientWrapper);

			const result = await storyTools.getStoryBranchName(123);

			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toBe(
				"Branch name for story sc-123: testuser/sc-123/special-characters-_",
			);
		});
	});

	describe("Task operations", () => {
		const mockTaskId = 123;
		const mockStoryId = 456;
		const mockTask = { 
			id: mockTaskId, 
			description: "Test task", 
			complete: false,
			owner_ids: ["user1", "user2"] 
		};
		
		test("createTask should create a task in a story", async () => {
			const createTaskMock = mock(async () => mockTask);
			const mockClient = {
				createTask: createTaskMock,
			} as unknown as ShortcutClientWrapper;
			
			const storyTools = new StoryTools(mockClient);
			const result = await storyTools.createTask(mockStoryId, "Test task");
			
			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toBe(`Created task ${mockTaskId} in story sc-${mockStoryId}`);
			expect(createTaskMock).toHaveBeenCalledTimes(1);
			expect(createTaskMock).toHaveBeenCalledWith(mockStoryId, "Test task", false, undefined);
		});
		
		test("getTasks should list all tasks in a story", async () => {
			const mockTasks = [
				{ id: 123, description: "Task 1", complete: false },
				{ id: 456, description: "Task 2", complete: true }
			];
			const getTasksMock = mock(async () => mockTasks);
			const mockClient = {
				getTasks: getTasksMock,
			} as unknown as ShortcutClientWrapper;
			
			const storyTools = new StoryTools(mockClient);
			const result = await storyTools.getTasks(mockStoryId);
			
			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toContain(`Tasks for story sc-${mockStoryId}`);
			expect(result.content[0].text).toContain("Task 123: [ ] Task 1");
			expect(result.content[0].text).toContain("Task 456: [x] Task 2");
			expect(getTasksMock).toHaveBeenCalledTimes(1);
			expect(getTasksMock).toHaveBeenCalledWith(mockStoryId);
		});
		
		test("getTask should retrieve a specific task", async () => {
			const getTaskMock = mock(async () => mockTask);
			const getUserMapMock = mock(async () => new Map([
				["user1", { profile: { mention_name: "testuser" } }],
				["user2", { profile: { mention_name: "jane" } }],
			]));
			const mockClient = {
				getTask: getTaskMock,
				getUserMap: getUserMapMock,
			} as unknown as ShortcutClientWrapper;
			
			const storyTools = new StoryTools(mockClient);
			const result = await storyTools.getTask(mockStoryId, mockTaskId);
			
			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toContain(`Task ${mockTaskId} for story sc-${mockStoryId}`);
			expect(result.content[0].text).toContain("Description: Test task");
			expect(result.content[0].text).toContain("Status: Incomplete");
			expect(getTaskMock).toHaveBeenCalledTimes(1);
			expect(getTaskMock).toHaveBeenCalledWith(mockStoryId, mockTaskId);
		});
		
		test("updateTask should update a task", async () => {
			const updateTaskMock = mock(async () => ({ ...mockTask, description: "Updated task" }));
			const mockClient = {
				updateTask: updateTaskMock,
			} as unknown as ShortcutClientWrapper;
			
			const storyTools = new StoryTools(mockClient);
			const result = await storyTools.updateTask(mockStoryId, mockTaskId, { 
				description: "Updated task",
				complete: true 
			});
			
			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toBe(`Updated task ${mockTaskId} in story sc-${mockStoryId}`);
			expect(updateTaskMock).toHaveBeenCalledTimes(1);
			expect(updateTaskMock).toHaveBeenCalledWith(mockStoryId, mockTaskId, { 
				description: "Updated task",
				complete: true 
			});
		});
		
		test("deleteTask should delete a task", async () => {
			const deleteTaskMock = mock(async () => true);
			const mockClient = {
				deleteTask: deleteTaskMock,
			} as unknown as ShortcutClientWrapper;
			
			const storyTools = new StoryTools(mockClient);
			const result = await storyTools.deleteTask(mockStoryId, mockTaskId);
			
			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toBe(`Deleted task ${mockTaskId} from story sc-${mockStoryId}`);
			expect(deleteTaskMock).toHaveBeenCalledTimes(1);
			expect(deleteTaskMock).toHaveBeenCalledWith(mockStoryId, mockTaskId);
		});
		
		test("completeTask should mark a task as complete", async () => {
			const updateTaskMock = mock(async () => ({ ...mockTask, complete: true }));
			const mockClient = {
				updateTask: updateTaskMock,
			} as unknown as ShortcutClientWrapper;
			
			const storyTools = new StoryTools(mockClient);
			const result = await storyTools.completeTask(mockStoryId, mockTaskId);
			
			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toBe(`Marked task ${mockTaskId} as complete in story sc-${mockStoryId}`);
			expect(updateTaskMock).toHaveBeenCalledTimes(1);
			expect(updateTaskMock).toHaveBeenCalledWith(mockStoryId, mockTaskId, { complete: true });
		});
		
		test("incompleteTask should mark a task as incomplete", async () => {
			const updateTaskMock = mock(async () => ({ ...mockTask, complete: false }));
			const mockClient = {
				updateTask: updateTaskMock,
			} as unknown as ShortcutClientWrapper;
			
			const storyTools = new StoryTools(mockClient);
			const result = await storyTools.incompleteTask(mockStoryId, mockTaskId);
			
			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toBe(`Marked task ${mockTaskId} as incomplete in story sc-${mockStoryId}`);
			expect(updateTaskMock).toHaveBeenCalledTimes(1);
			expect(updateTaskMock).toHaveBeenCalledWith(mockStoryId, mockTaskId, { complete: false });
		});
	});
});
