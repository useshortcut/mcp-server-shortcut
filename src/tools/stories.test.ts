import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
	Branch,
	CreateStoryCommentParams,
	CreateStoryParams,
	Member,
	MemberInfo,
	PullRequest,
	Story,
	StoryComment,
	Task,
	UpdateStory,
	Workflow,
} from "@shortcut/client";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import { StoryTools } from "./stories";

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
			entity_type: "story",
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
			branches: [
				{
					id: 1,
					name: "user1/sc-123/test-story-1",
					created_at: "2023-01-01T12:00:00Z",
					pull_requests: [
						{
							id: 1,
							title: "Test PR 1",
							url: "https://github.com/user1/repo1/pull/1",
							merged: true,
							closed: true,
						} as unknown as PullRequest,
					],
				} as unknown as Branch,
			],
			comments: [
				{
					id: "comment1",
					author_id: "user1",
					text: "This is a comment",
					created_at: "2023-01-01T12:00:00Z",
				} as unknown as StoryComment,
			],
			formatted_vcs_branch_name: "user1/sc-123/test-story-1",
			external_links: ["https://example.com", "https://example2.com"],
			tasks: [
				{
					id: 1,
					description: "task 1",
					complete: false,
				},
				{
					id: 2,
					description: "task 2",
					complete: true,
				},
			] satisfies Partial<Task>[],
		} as unknown as Story,
		{
			entity_type: "story",
			id: 456,
			name: "Test Story 2",
			branches: [],
			external_links: [],
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

	const createMockClient = (methods?: object) =>
		({
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
			const mockTool = mock();
			const mockServer = { tool: mockTool } as unknown as McpServer;

			StoryTools.create(mockClient, mockServer);

			expect(mockTool).toHaveBeenCalledTimes(15);
			expect(mockTool.mock.calls?.[0]?.[0]).toBe("get-story-branch-name");
			expect(mockTool.mock.calls?.[1]?.[0]).toBe("get-story");
			expect(mockTool.mock.calls?.[2]?.[0]).toBe("search-stories");
			expect(mockTool.mock.calls?.[3]?.[0]).toBe("create-story");
			expect(mockTool.mock.calls?.[4]?.[0]).toBe("update-story");
			expect(mockTool.mock.calls?.[5]?.[0]).toBe("assign-current-user-as-owner");
			expect(mockTool.mock.calls?.[6]?.[0]).toBe("unassign-current-user-as-owner");
			expect(mockTool.mock.calls?.[7]?.[0]).toBe("create-story-comment");
			expect(mockTool.mock.calls?.[8]?.[0]).toBe("add-task-to-story");
			expect(mockTool.mock.calls?.[9]?.[0]).toBe("add-relation-to-story");
			expect(mockTool.mock.calls?.[10]?.[0]).toBe("update-task");
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
			getWorkflowMap: mock(async () => new Map()),
			getTeamMap: mock(async () => new Map()),
			getMilestone: mock(async () => null),
			getIteration: mock(async () => null),
			getEpic: mock(async () => null),
		} as unknown as ShortcutClientWrapper;

		test("should return formatted story details when story is found", async () => {
			const storyTools = new StoryTools(mockClient);
			const result = await storyTools.getStory(123);

			expect(result.content[0].type).toBe("text");
			const textContent = String(result.content[0].text);
			expect(textContent).toContain("Story: sc-123");
			expect(textContent).toContain('"id": 123');
			expect(textContent).toContain('"name": "Test Story 1"');
			expect(textContent).toContain('"story_type": "feature"');
			expect(textContent).toContain('"description": "Description for Test Story 1"');
			expect(textContent).toContain('"archived": false');
			expect(textContent).toContain('"completed": false');
			expect(textContent).toContain('"started": true');
			expect(textContent).toContain('"deadline": "2023-12-31"');
			expect(textContent).toContain('"app_url": "https://app.shortcut.com/test/story/123"');
		});

		test("should handle story not found", async () => {
			const storyTools = new StoryTools({
				getStory: mock(async () => null),
				getUserMap: mock(async () => new Map()),
				getWorkflowMap: mock(async () => new Map()),
				getTeamMap: mock(async () => new Map()),
				getMilestone: mock(async () => null),
				getIteration: mock(async () => null),
				getEpic: mock(async () => null),
			} as unknown as ShortcutClientWrapper);

			await expect(() => storyTools.getStory(999)).toThrow(
				"Failed to retrieve Shortcut story with public ID: 999.",
			);
		});

		test("should handle story with null deadline", async () => {
			const storyTools = new StoryTools({
				getStory: mock(async () => mockStories[1]),
				getUserMap: getUserMapMock,
				getWorkflowMap: mock(async () => new Map()),
				getTeamMap: mock(async () => new Map()),
				getMilestone: mock(async () => null),
				getIteration: mock(async () => null),
				getEpic: mock(async () => null),
			} as unknown as ShortcutClientWrapper);

			const result = await storyTools.getStory(456);

			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toContain('"deadline": null');
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
			getWorkflowMap: mock(async () => new Map()),
			getTeamMap: mock(async () => new Map()),
			getMilestone: mock(async () => null),
			getIteration: mock(async () => null),
			getEpic: mock(async () => null),
		} as unknown as ShortcutClientWrapper;

		test("should return formatted list of stories when stories are found", async () => {
			const storyTools = new StoryTools(mockClient);
			const result = await storyTools.searchStories({});

			expect(result.content[0].type).toBe("text");
			const textContent = String(result.content[0].text);
			expect(textContent).toContain("Result (first 2 shown of 2 total stories found):");
			expect(textContent).toContain('"id": 123');
			expect(textContent).toContain('"name": "Test Story 1"');
			expect(textContent).toContain('"id": 456');
			expect(textContent).toContain('"name": "Test Story 2"');
		});

		test("should return no stories found message when no stories exist", async () => {
			const storyTools = new StoryTools({
				searchStories: mock(async () => ({ stories: [], total: 0 })),
				getCurrentUser: getCurrentUserMock,
				getUserMap: mock(async () => new Map()),
				getWorkflowMap: mock(async () => new Map()),
				getTeamMap: mock(async () => new Map()),
				getMilestone: mock(async () => null),
				getIteration: mock(async () => null),
				getEpic: mock(async () => null),
			} as unknown as ShortcutClientWrapper);

			const result = await storyTools.searchStories({});

			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toBe("Result: No stories found.");
		});

		test("should throw error when stories search fails", async () => {
			const storyTools = new StoryTools({
				searchStories: mock(async () => ({ stories: null, total: 0 })),
				getCurrentUser: getCurrentUserMock,
				getUserMap: mock(async () => new Map()),
				getWorkflowMap: mock(async () => new Map()),
				getTeamMap: mock(async () => new Map()),
				getMilestone: mock(async () => null),
				getIteration: mock(async () => null),
				getEpic: mock(async () => null),
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

		const mockClient = createMockClient({
			createStory: createStoryMock,
			getTeam: getTeamMock,
			getWorkflow: getWorkflowMock,
		});

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
			const storyTools = new StoryTools(
				createMockClient({
					...mockClient,
					getWorkflow: mock(async () => null),
				}),
			);

			await expect(() =>
				storyTools.createStory({
					name: "New Story",
					type: "feature",
					workflow: 999,
				}),
			).toThrow("Failed to find workflow");
		});
	});

	describe("updateStory method", () => {
		const getStoryMock = mock(async (id: number) => mockStories.find((story) => story.id === id));
		const updateStoryMock = mock(async (_id: number, _args: UpdateStory) => ({
			id: 123,
			app_url: "https://app.shortcut.com/test/story/123",
		}));

		const mockClient = createMockClient({
			getStory: getStoryMock,
			updateStory: updateStoryMock,
		});

		beforeEach(() => {
			updateStoryMock.mockClear();
		});

		test("should update a story with provided fields", async () => {
			const storyTools = new StoryTools(mockClient);
			const result = await storyTools.updateStory({
				storyPublicId: 123,
				name: "Updated Story Name",
				description: "Updated description",
				type: "bug",
			});

			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toBe(
				"Updated story sc-123. Story URL: https://app.shortcut.com/test/story/123",
			);
			expect(updateStoryMock).toHaveBeenCalledTimes(1);
			expect(updateStoryMock.mock.calls?.[0]?.[0]).toBe(123);
			expect(updateStoryMock.mock.calls?.[0]?.[1]).toMatchObject({
				name: "Updated Story Name",
				description: "Updated description",
				story_type: "bug",
			});
		});

		test("should handle null values for optional fields", async () => {
			const storyTools = new StoryTools(mockClient);
			await storyTools.updateStory({
				storyPublicId: 123,
				epic: null,
				estimate: null,
			});

			expect(updateStoryMock).toHaveBeenCalledTimes(1);
			expect(updateStoryMock.mock.calls?.[0]?.[1]).toMatchObject({
				epic_id: null,
				estimate: null,
			});
		});

		test("should update owner_ids and workflow_state_id", async () => {
			const storyTools = new StoryTools(mockClient);
			await storyTools.updateStory({
				storyPublicId: 123,
				owner_ids: ["user1", "user2"],
				workflow_state_id: 102,
			});

			expect(updateStoryMock).toHaveBeenCalledTimes(1);
			expect(updateStoryMock.mock.calls?.[0]?.[1]).toMatchObject({
				owner_ids: ["user1", "user2"],
				workflow_state_id: 102,
			});
		});

		test("should throw error when story is not found", async () => {
			const storyTools = new StoryTools(
				createMockClient({
					...mockClient,
					getStory: mock(async () => null),
				}),
			);

			await expect(() =>
				storyTools.updateStory({
					storyPublicId: 999,
					name: "Updated Story",
				}),
			).toThrow("Failed to retrieve Shortcut story with public ID: 999");
		});

		test("should throw error when story ID is not provided", async () => {
			const storyTools = new StoryTools(mockClient);

			// @ts-ignore - Testing runtime check for missing ID
			await expect(() => storyTools.updateStory({})).toThrow("Story public ID is required");
		});
	});

	describe("assignCurrentUserAsOwner method", () => {
		const getStoryMock = mock(async () => mockStories[0]);
		const getCurrentUserMock = mock(async () => mockCurrentUser);
		const updateStoryMock = mock(async (_id: number, _args: UpdateStory) => ({
			id: 123,
		}));

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
		const updateStoryMock = mock(async (_id: number, _args: UpdateStory) => ({
			id: 123,
		}));

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

	describe("createStoryComment method", () => {
		const createStoryCommentMock = mock(async (_: CreateStoryCommentParams) => ({
			id: 1000,
			text: "Added comment to story sc-123.",
		}));
		const getStoryMock = mock(async (id: number) => mockStories.find((story) => story.id === id));

		const mockClient = {
			getStory: getStoryMock,
			createStoryComment: createStoryCommentMock,
		} as unknown as ShortcutClientWrapper;

		beforeEach(() => {
			createStoryCommentMock.mockClear();
		});

		test("should create a story comment", async () => {
			const storyTools = new StoryTools(mockClient);
			const result = await storyTools.createStoryComment({
				storyPublicId: 123,
				text: "Added comment to story sc-123.",
			});

			expect(result.content[0].text).toBe(
				`Created comment on story sc-123. Comment URL: ${mockStories[0].comments[0].app_url}.`,
			);
			expect(createStoryCommentMock).toHaveBeenCalledTimes(1);
		});

		test("should throw error if comment is not specified", async () => {
			const storyTools = new StoryTools(mockClient);

			await expect(() =>
				storyTools.createStoryComment({
					storyPublicId: 123,
					text: "",
				}),
			).toThrow("Story comment text is required");
		});

		test("should throw error if story ID is not found", async () => {
			const storyTools = new StoryTools({
				...mockClient,
				createStoryComment: mock(async () => null),
			} as unknown as ShortcutClientWrapper);

			await expect(() =>
				storyTools.createStoryComment({
					storyPublicId: 124,
					text: "This is a new comment",
				}),
			).toThrow("Failed to retrieve Shortcut story with public ID: 124");
		});
	});

	describe("addTaskToStory method", () => {
		const getStoryMock = mock(async (id: number) => mockStories.find((story) => story.id === id));
		const addTaskMock = mock(async (_id: number, _args: Partial<Task>) => ({
			id: 123,
			description: "New task",
		}));

		const mockClient = {
			getStory: getStoryMock,
			addTaskToStory: addTaskMock,
		} as unknown as ShortcutClientWrapper;

		beforeEach(() => {
			addTaskMock.mockClear();
		});

		test("should add a task to a story", async () => {
			const storyTools = new StoryTools(mockClient);
			const result = await storyTools.addTaskToStory({
				storyPublicId: 123,
				taskDescription: "New task",
			});

			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toBe("Created task for story sc-123. Task ID: 123.");
			expect(addTaskMock).toHaveBeenCalledTimes(1);
			expect(addTaskMock.mock.calls?.[0]?.[0]).toBe(123);
			expect(addTaskMock.mock.calls?.[0]?.[1]).toMatchObject({
				description: "New task",
			});
		});

		test("should throw error if description is not specified", async () => {
			const storyTools = new StoryTools(mockClient);

			await expect(() =>
				storyTools.addTaskToStory({
					storyPublicId: 123,
					taskDescription: "",
				}),
			).toThrow("Task description is required");
		});

		test("should throw error if story ID is not found", async () => {
			const storyTools = new StoryTools({
				...mockClient,
				getStory: mock(async () => null),
			} as unknown as ShortcutClientWrapper);

			await expect(() =>
				storyTools.addTaskToStory({
					storyPublicId: 124,
					taskDescription: "This is a new task",
				}),
			).toThrow("Failed to retrieve Shortcut story with public ID: 124");
		});
	});

	describe("updateTaskWithOwners method", () => {
		const getStoryMock = mock(async (id: number) => mockStories.find((story) => story.id === id));
		const updateTaskMock = mock(async (_id: number, _args: Partial<Task>) => ({
			id: 1,
			description: "Updated task",
			owner_ids: ["user1", "user2"],
			isCompleted: true,
		}));

		const mockClient = {
			getStory: getStoryMock,
			updateTask: updateTaskMock,
			getTask: mock(async (storyId: number, id: number) => {
				const story = mockStories.find((s) => s.id === storyId);
				if (!story) return null;
				return story.tasks?.find((task) => task.id === id) ?? null;
			}),
		} as unknown as ShortcutClientWrapper;

		beforeEach(() => {
			updateTaskMock.mockClear();
		});

		test("should update a task with owners", async () => {
			const storyTools = new StoryTools(mockClient);
			const result = await storyTools.updateTask({
				storyPublicId: 123,
				taskPublicId: 1,
				taskOwnerIds: ["user1", "user2"],
			});

			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toBe("Updated task for story sc-123. Task ID: 1.");
			expect(updateTaskMock).toHaveBeenCalledTimes(1);
			expect(updateTaskMock.mock.calls?.[0]?.[0]).toBe(123);
		});

		test("should throw error if task ID is not found", async () => {
			const storyTools = new StoryTools(mockClient);

			await expect(() =>
				storyTools.updateTask({
					storyPublicId: 123,
					taskPublicId: 999,
					taskOwnerIds: ["user1"],
				}),
			).toThrow("Failed to retrieve Shortcut task with public ID: 999");
		});

		test("should throw error if story ID is not found", async () => {
			const storyTools = new StoryTools({
				...mockClient,
				getStory: mock(async () => null),
			} as unknown as ShortcutClientWrapper);

			await expect(() =>
				storyTools.updateTask({
					storyPublicId: 999,
					taskPublicId: 1,
					taskOwnerIds: ["user1"],
				}),
			).toThrow("Failed to retrieve Shortcut story with public ID: 999");
		});

		test("should mark task as completed", async () => {
			const storyTools = new StoryTools(mockClient);
			const result = await storyTools.updateTask({
				storyPublicId: 123,
				taskPublicId: 1,
				isCompleted: true,
			});

			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toBe("Completed task for story sc-123. Task ID: 1.");
			expect(updateTaskMock).toHaveBeenCalledTimes(1);
		});
	});

	describe("addRelationToStory method", () => {
		const getStoryMock = mock(async (id: number) => mockStories.find((story) => story.id === id));
		const addStoryRelationMock = mock(async (_id: number, _args: { related_story_id: number }) => ({
			id: 123,
			related_story_id: 456,
		}));

		const mockClient = {
			addRelationToStory: addStoryRelationMock,
			getStory: getStoryMock,
		} as unknown as ShortcutClientWrapper;

		beforeEach(() => {
			addStoryRelationMock.mockClear();
		});

		test("should add a story relation", async () => {
			const storyTools = new StoryTools(mockClient);
			const result = await storyTools.addRelationToStory({
				storyPublicId: 123,
				relatedStoryPublicId: 456,
				relationshipType: "relates to",
			});

			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toBe("Added a relationship between sc-123 and sc-456.");
			expect(addStoryRelationMock).toHaveBeenCalledTimes(1);
			expect(addStoryRelationMock.mock.calls?.[0]?.[0]).toBe(123);
		});

		test("should throw error if related story ID is not found", async () => {
			const storyTools = new StoryTools(mockClient);

			await expect(() =>
				storyTools.addRelationToStory({
					storyPublicId: 123,
					relatedStoryPublicId: 999,
					relationshipType: "relates to",
				}),
			).toThrow("Failed to retrieve Shortcut story with public ID: 999");
		});

		test("should throw error if story ID is not found", async () => {
			const storyTools = new StoryTools({
				...mockClient,
				getStory: mock(async () => null),
			} as unknown as ShortcutClientWrapper);

			await expect(() =>
				storyTools.addRelationToStory({
					storyPublicId: 999,
					relatedStoryPublicId: 456,
					relationshipType: "relates to",
				}),
			).toThrow("Failed to retrieve Shortcut story with public ID: 999");
		});

		test("should add duplicating relationship", async () => {
			const storyTools = new StoryTools(mockClient);
			const result = await storyTools.addRelationToStory({
				storyPublicId: 123,
				relatedStoryPublicId: 456,
				relationshipType: "duplicates",
			});

			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toBe("Marked sc-123 as a duplicate of sc-456.");
			expect(addStoryRelationMock).toHaveBeenCalledTimes(1);
			expect(addStoryRelationMock.mock.calls?.[0]?.[0]).toBe(123);
		});

		test("should add duplicated by relationship", async () => {
			const storyTools = new StoryTools(mockClient);
			const result = await storyTools.addRelationToStory({
				storyPublicId: 123,
				relatedStoryPublicId: 456,
				relationshipType: "duplicated by",
			});

			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toBe("Marked sc-456 as a duplicate of sc-123.");
			expect(addStoryRelationMock).toHaveBeenCalledTimes(1);
			expect(addStoryRelationMock.mock.calls?.[0]?.[0]).toBe(456);
		});

		test("should add blocking relationship", async () => {
			const storyTools = new StoryTools(mockClient);
			const result = await storyTools.addRelationToStory({
				storyPublicId: 123,
				relatedStoryPublicId: 456,
				relationshipType: "blocks",
			});

			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toBe("Marked sc-123 as a blocker to sc-456.");
			expect(addStoryRelationMock).toHaveBeenCalledTimes(1);
			expect(addStoryRelationMock.mock.calls?.[0]?.[0]).toBe(123);
		});

		test("should add blocked by relationship", async () => {
			const storyTools = new StoryTools(mockClient);
			const result = await storyTools.addRelationToStory({
				storyPublicId: 123,
				relatedStoryPublicId: 456,
				relationshipType: "blocked by",
			});

			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toBe("Marked sc-456 as a blocker to sc-123.");
			expect(addStoryRelationMock).toHaveBeenCalledTimes(1);
			expect(addStoryRelationMock.mock.calls?.[0]?.[0]).toBe(456);
		});
	});

	describe("addExternalLinkToStory method", () => {
		const addExternalLinkToStoryMock = mock(async () => ({
			...mockStories[0],
			external_links: ["https://example.com", "https://newlink.com"],
		}));

		const mockClient = {
			addExternalLinkToStory: addExternalLinkToStoryMock,
		} as unknown as ShortcutClientWrapper;

		beforeEach(() => {
			addExternalLinkToStoryMock.mockClear();
		});

		test("should add external link to story", async () => {
			const storyTools = new StoryTools(mockClient);
			const result = await storyTools.addExternalLinkToStory(123, "https://newlink.com");

			expect(addExternalLinkToStoryMock).toHaveBeenCalledWith(123, "https://newlink.com");
			expect(result.content[0].text).toContain("Added external link to story sc-123");
		});
	});

	describe("removeExternalLinkFromStory method", () => {
		const removeExternalLinkFromStoryMock = mock(async () => ({
			...mockStories[0],
			external_links: ["https://example.com"],
		}));

		const mockClient = {
			removeExternalLinkFromStory: removeExternalLinkFromStoryMock,
		} as unknown as ShortcutClientWrapper;

		beforeEach(() => {
			removeExternalLinkFromStoryMock.mockClear();
		});

		test("should remove external link from story", async () => {
			const storyTools = new StoryTools(mockClient);
			const result = await storyTools.removeExternalLinkFromStory(123, "https://example2.com");

			expect(removeExternalLinkFromStoryMock).toHaveBeenCalledWith(123, "https://example2.com");
			expect(result.content[0].text).toContain("Removed external link from story sc-123");
		});
	});

	describe("getStoriesByExternalLink method", () => {
		const getStoriesByExternalLinkMock = mock(async () => ({
			stories: [mockStories[0]],
			total: 1,
		}));

		const mockClient = createMockClient({
			getStoriesByExternalLink: getStoriesByExternalLinkMock,
		});

		beforeEach(() => {
			getStoriesByExternalLinkMock.mockClear();
		});

		test("should find stories by external link", async () => {
			const storyTools = new StoryTools(mockClient);
			const result = await storyTools.getStoriesByExternalLink("https://example.com");

			expect(getStoriesByExternalLinkMock).toHaveBeenCalledWith("https://example.com");
			expect(result.content[0].text).toContain("Found 1 stories with external link");
		});
	});

	describe("setStoryExternalLinks method", () => {
		const setStoryExternalLinksMock = mock(async () => ({
			...mockStories[0],
			external_links: ["https://link1.com", "https://link2.com"],
		}));

		const mockClient = {
			setStoryExternalLinks: setStoryExternalLinksMock,
		} as unknown as ShortcutClientWrapper;

		beforeEach(() => {
			setStoryExternalLinksMock.mockClear();
		});

		test("should set story external links", async () => {
			const newLinks = ["https://link1.com", "https://link2.com"];
			const storyTools = new StoryTools(mockClient);
			const result = await storyTools.setStoryExternalLinks(123, newLinks);

			expect(setStoryExternalLinksMock).toHaveBeenCalledWith(123, newLinks);
			expect(result.content[0].text).toContain("Set 2 external links on story sc-123");
		});

		test("should remove all external links when empty array provided", async () => {
			const mockUpdatedStory = { ...mockStories[0], external_links: [] };

			const mockClientForEmpty = {
				setStoryExternalLinks: mock(async () => mockUpdatedStory),
			} as unknown as ShortcutClientWrapper;

			const storyTools = new StoryTools(mockClientForEmpty);
			const result = await storyTools.setStoryExternalLinks(123, []);

			expect(result.content[0].text).toContain("Removed all external links from story sc-123");
		});
	});
});
