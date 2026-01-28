import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Member, MemberInfo, Project, Story } from "@shortcut/client";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { CustomMcpServer } from "@/mcp/CustomMcpServer";
import { ProjectTools } from "./projects";
import { getTextContent } from "./utils/test-helpers";

describe("ProjectTools", () => {
	const mockProjects: Project[] = [
		{
			entity_type: "project",
			id: 1,
			name: "Project Alpha",
			app_url: "https://app.shortcut.com/test/project/1",
			abbreviation: "PA",
			description: "First test project",
			color: "#ff0000",
			team_id: "team-1",
			workflow_id: 100,
			archived: false,
			stats: {
				num_stories: 10,
				num_stories_unstarted: 5,
				num_stories_started: 3,
				num_stories_done: 2,
			},
		} as unknown as Project,
		{
			entity_type: "project",
			id: 2,
			name: "Project Beta",
			app_url: "https://app.shortcut.com/test/project/2",
			abbreviation: "PB",
			description: null,
			color: null,
			team_id: "team-2",
			workflow_id: 101,
			archived: false,
			stats: {
				num_stories: 5,
				num_stories_unstarted: 2,
				num_stories_started: 2,
				num_stories_done: 1,
			},
		} as unknown as Project,
		{
			entity_type: "project",
			id: 3,
			name: "Archived Project",
			app_url: "https://app.shortcut.com/test/project/3",
			abbreviation: "AP",
			description: "An archived project",
			color: "#0000ff",
			team_id: "team-1",
			workflow_id: 100,
			archived: true,
			stats: {
				num_stories: 0,
				num_stories_unstarted: 0,
				num_stories_started: 0,
				num_stories_done: 0,
			},
		} as unknown as Project,
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

			ProjectTools.create(mockClient, mockServer);

			expect(mockToolRead).toHaveBeenCalledTimes(3);
			expect(mockToolRead.mock.calls?.[0]?.[0]).toBe("projects-list");
			expect(mockToolRead.mock.calls?.[1]?.[0]).toBe("projects-get-by-id");
			expect(mockToolRead.mock.calls?.[2]?.[0]).toBe("projects-get-stories");

			expect(mockToolWrite).toHaveBeenCalledTimes(0);
		});
	});

	describe("listProjects method", () => {
		const listProjectsMock = mock(async () => mockProjects);

		beforeEach(() => {
			listProjectsMock.mockClear();
		});

		test("should return formatted list of projects when projects exist", async () => {
			const mockClient = createMockClient({ listProjects: listProjectsMock });
			const projectTools = new ProjectTools(mockClient);
			const result = await projectTools.listProjects({ includeArchived: false });

			expect(listProjectsMock).toHaveBeenCalled();

			const textContent = getTextContent(result);
			expect(textContent).toContain("Result (2 projects found):");
			expect(textContent).toContain('"id": 1');
			expect(textContent).toContain('"name": "Project Alpha"');
			expect(textContent).toContain('"id": 2');
			expect(textContent).toContain('"name": "Project Beta"');
			// Should not contain archived project when includeArchived is false
			expect(textContent).not.toContain('"name": "Archived Project"');
		});

		test("should return no projects found message when no projects exist", async () => {
			const emptyMock = mock(async () => []);
			const mockClient = createMockClient({ listProjects: emptyMock });
			const projectTools = new ProjectTools(mockClient);
			const result = await projectTools.listProjects({ includeArchived: false });

			expect(getTextContent(result)).toBe("Result: No projects found.");
		});

		test("should include archived projects when includeArchived is true", async () => {
			const mockClient = createMockClient({ listProjects: listProjectsMock });
			const projectTools = new ProjectTools(mockClient);
			const result = await projectTools.listProjects({ includeArchived: true });

			expect(listProjectsMock).toHaveBeenCalled();

			const textContent = getTextContent(result);
			expect(textContent).toContain("Result (3 projects found):");
			expect(textContent).toContain('"id": 1');
			expect(textContent).toContain('"id": 2');
			expect(textContent).toContain('"id": 3');
			expect(textContent).toContain('"name": "Archived Project"');
			expect(textContent).toContain('"archived": true');
		});

		test("should include project details", async () => {
			const mockClient = createMockClient({ listProjects: listProjectsMock });
			const projectTools = new ProjectTools(mockClient);
			const result = await projectTools.listProjects({ includeArchived: false });

			const textContent = getTextContent(result);
			expect(textContent).toContain('"abbreviation": "PA"');
			expect(textContent).toContain('"description": "First test project"');
			expect(textContent).toContain('"color": "#ff0000"');
			expect(textContent).toContain('"team_id": "team-1"');
			expect(textContent).toContain('"workflow_id": 100');
		});
	});

	describe("getProject method", () => {
		const getProjectMock = mock(async (id: number) =>
			mockProjects.find((project) => project.id === id),
		);

		beforeEach(() => {
			getProjectMock.mockClear();
		});

		test("should return formatted project details when project is found", async () => {
			const mockClient = createMockClient({ getProject: getProjectMock });
			const projectTools = new ProjectTools(mockClient);
			const result = await projectTools.getProject(1);

			expect(getProjectMock).toHaveBeenCalledWith(1);

			const textContent = getTextContent(result);
			expect(textContent).toContain("Project: 1");
			expect(textContent).toContain('"id": 1');
			expect(textContent).toContain('"name": "Project Alpha"');
			expect(textContent).toContain('"abbreviation": "PA"');
			expect(textContent).toContain('"description": "First test project"');
			expect(textContent).toContain('"app_url": "https://app.shortcut.com/test/project/1"');
		});

		test("should throw error when project is not found", async () => {
			const mockClient = createMockClient({ getProject: mock(async () => null) });
			const projectTools = new ProjectTools(mockClient);

			await expect(() => projectTools.getProject(999)).toThrow(
				"Failed to retrieve Shortcut project with public ID: 999",
			);
		});

		test("should handle project with null optional fields", async () => {
			const mockClient = createMockClient({ getProject: getProjectMock });
			const projectTools = new ProjectTools(mockClient);
			const result = await projectTools.getProject(2);

			const textContent = getTextContent(result);
			expect(textContent).toContain("Project: 2");
			expect(textContent).toContain('"name": "Project Beta"');
			// Project 2 has null description and color
			expect(textContent).not.toContain('"description": null');
		});
	});

	describe("getProjectStories method", () => {
		const getProjectMock = mock(async (id: number) =>
			mockProjects.find((project) => project.id === id),
		);
		const listProjectStoriesMock = mock(async () => mockStories);

		beforeEach(() => {
			getProjectMock.mockClear();
			listProjectStoriesMock.mockClear();
		});

		test("should return formatted list of stories in project", async () => {
			const mockClient = createMockClient({
				getProject: getProjectMock,
				listProjectStories: listProjectStoriesMock,
			});
			const projectTools = new ProjectTools(mockClient);
			const result = await projectTools.getProjectStories(1);

			expect(getProjectMock).toHaveBeenCalledWith(1);
			expect(listProjectStoriesMock).toHaveBeenCalledWith(1);

			const textContent = getTextContent(result);
			expect(textContent).toContain("Result (2 stories found in project 1):");
			expect(textContent).toContain('"name": "Test Story 1"');
			expect(textContent).toContain('"name": "Test Story 2"');
		});

		test("should return no stories found message when project has no stories", async () => {
			const mockClient = createMockClient({
				getProject: getProjectMock,
				listProjectStories: mock(async () => []),
			});
			const projectTools = new ProjectTools(mockClient);
			const result = await projectTools.getProjectStories(1);

			expect(getTextContent(result)).toBe("Result: No stories found in project 1.");
		});

		test("should throw error when project is not found", async () => {
			const mockClient = createMockClient({
				getProject: mock(async () => null),
				listProjectStories: listProjectStoriesMock,
			});
			const projectTools = new ProjectTools(mockClient);

			await expect(() => projectTools.getProjectStories(999)).toThrow(
				"Failed to retrieve Shortcut project with public ID: 999",
			);
		});
	});
});
