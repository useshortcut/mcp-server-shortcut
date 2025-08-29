import { describe, expect, mock, spyOn, test } from "bun:test";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Workflow } from "@shortcut/client";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import { WorkflowTools } from "./workflows";

describe("WorkflowTools", () => {
	const mockWorkflows: Workflow[] = [
		{
			entity_type: "workflow",
			id: 1,
			name: "Workflow 1",
			description: "Description for Workflow 1",
			default_state_id: 101,
			states: [
				{ id: 101, name: "Unstarted", type: "unstarted" },
				{ id: 102, name: "Started", type: "started" },
				{ id: 103, name: "Done", type: "done" },
			],
		} as Workflow,
		{
			entity_type: "workflow",
			id: 2,
			name: "Workflow 2",
			description: "Description for Workflow 2",
			default_state_id: 201,
			states: [
				{ id: 201, name: "Backlog", type: "unstarted" },
				{ id: 202, name: "In Progress", type: "started" },
				{ id: 203, name: "Completed", type: "done" },
			],
		} as Workflow,
	];

	describe("create method", () => {
		test("should register the correct tools with the server", () => {
			const mockClient = {} as ShortcutClientWrapper;
			const mockTool = mock();
			const mockServer = { tool: mockTool } as unknown as McpServer;

			WorkflowTools.create(mockClient, mockServer);

			expect(mockTool).toHaveBeenCalledTimes(3);

			expect(mockTool.mock.calls?.[0]?.[0]).toBe("get-default-workflow");
			expect(mockTool.mock.calls?.[1]?.[0]).toBe("get-workflow");
			expect(mockTool.mock.calls?.[2]?.[0]).toBe("list-workflows");
		});

		test("should register the same tools when readonly is true", () => {
			const mockClient = {} as ShortcutClientWrapper;
			const mockTool = mock();
			const mockServer = { tool: mockTool } as unknown as McpServer;

			WorkflowTools.create(mockClient, mockServer, true);

			expect(mockTool).toHaveBeenCalledTimes(3);

			expect(mockTool.mock.calls?.[0]?.[0]).toBe("get-default-workflow");
			expect(mockTool.mock.calls?.[1]?.[0]).toBe("get-workflow");
			expect(mockTool.mock.calls?.[2]?.[0]).toBe("list-workflows");
		});

		test("should call correct function from tool", async () => {
			const mockClient = {} as ShortcutClientWrapper;
			const mockTool = mock();
			const mockServer = { tool: mockTool } as unknown as McpServer;

			const tools = WorkflowTools.create(mockClient, mockServer);

			spyOn(tools, "getDefaultWorkflow").mockImplementation(async () => ({
				content: [{ text: "", type: "text" }],
			}));
			await mockTool.mock.calls?.[0]?.[3]({ teamPublicId: "team1" });
			expect(tools.getDefaultWorkflow).toHaveBeenCalledWith("team1");

			spyOn(tools, "getWorkflow").mockImplementation(async () => ({
				content: [{ text: "", type: "text" }],
			}));
			await mockTool.mock.calls?.[1]?.[3]({ workflowPublicId: 1, full: false });
			expect(tools.getWorkflow).toHaveBeenCalledWith(1, false);

			spyOn(tools, "listWorkflows").mockImplementation(async () => ({
				content: [{ text: "", type: "text" }],
			}));
			await mockTool.mock.calls?.[2]?.[2]();
			expect(tools.listWorkflows).toHaveBeenCalled();
		});
	});

	describe("getDefaultWorkflow method", () => {
		const mockCurrentUser = {
			id: "user1",
			workspace2: {
				default_workflow_id: 100,
			},
		};

		const mockTeam = {
			id: "team1",
			name: "Engineering",
			default_workflow_id: 200,
		};

		const mockDefaultWorkflow = {
			entity_type: "workflow",
			id: 100,
			name: "Default Workflow",
			description: "Default workflow description",
			default_state_id: 500,
			states: [
				{ id: 500, name: "Unstarted", type: "unstarted" },
				{ id: 501, name: "Started", type: "started" },
				{ id: 502, name: "Done", type: "done" },
			],
		} as Workflow;

		const mockTeamDefaultWorkflow = {
			entity_type: "workflow",
			id: 200,
			name: "Team Workflow",
			description: "Team specific workflow",
			default_state_id: 600,
			states: [
				{ id: 600, name: "Backlog", type: "unstarted" },
				{ id: 601, name: "Development", type: "started" },
				{ id: 602, name: "Complete", type: "done" },
			],
		} as Workflow;

		test("should return team default workflow when team has one", async () => {
			const workflowTools = new WorkflowTools({
				getTeam: mock(async () => mockTeam),
				getWorkflow: mock(async (id: number) =>
					id === 200 ? mockTeamDefaultWorkflow : mockDefaultWorkflow,
				),
				getCurrentUser: mock(async () => mockCurrentUser),
			} as unknown as ShortcutClientWrapper);

			const result = await workflowTools.getDefaultWorkflow("team1");

			expect(result.content[0].type).toBe("text");
			const textContent = String(result.content[0].text);
			expect(textContent).toContain('Default workflow for team "team1" has id 200.');
			expect(textContent).toContain('"id": 200');
			expect(textContent).toContain('"name": "Team Workflow"');
		});

		test("should return workspace default when team has no default workflow", async () => {
			const mockTeamWithoutDefault = { ...mockTeam, default_workflow_id: null };
			const workflowTools = new WorkflowTools({
				getTeam: mock(async () => mockTeamWithoutDefault),
				getWorkflow: mock(async () => mockDefaultWorkflow),
				getCurrentUser: mock(async () => mockCurrentUser),
			} as unknown as ShortcutClientWrapper);

			const result = await workflowTools.getDefaultWorkflow("team1");

			expect(result.content[0].type).toBe("text");
			const textContent = String(result.content[0].text);
			expect(textContent).toContain(
				'No default workflow found for team with public ID "team1". The general default workflow has id 100.',
			);
			expect(textContent).toContain('"id": 100');
			expect(textContent).toContain('"name": "Default Workflow"');
		});

		test("should return workspace default when team is not found", async () => {
			const workflowTools = new WorkflowTools({
				getTeam: mock(async () => null),
				getWorkflow: mock(async () => mockDefaultWorkflow),
				getCurrentUser: mock(async () => mockCurrentUser),
			} as unknown as ShortcutClientWrapper);

			const result = await workflowTools.getDefaultWorkflow("nonexistent-team");

			expect(result.content[0].type).toBe("text");
			const textContent = String(result.content[0].text);
			expect(textContent).toContain(
				'No default workflow found for team with public ID "nonexistent-team". The general default workflow has id 100.',
			);
			expect(textContent).toContain('"id": 100');
		});

		test("should return workspace default when no team is specified", async () => {
			const workflowTools = new WorkflowTools({
				getWorkflow: mock(async () => mockDefaultWorkflow),
				getCurrentUser: mock(async () => mockCurrentUser),
			} as unknown as ShortcutClientWrapper);

			const result = await workflowTools.getDefaultWorkflow();

			expect(result.content[0].type).toBe("text");
			const textContent = String(result.content[0].text);
			expect(textContent).toContain("Default workflow has id 100.");
			expect(textContent).toContain('"id": 100');
			expect(textContent).toContain('"name": "Default Workflow"');
		});

		test("should handle getTeam throwing error gracefully", async () => {
			const workflowTools = new WorkflowTools({
				getTeam: mock(async () => {
					throw new Error("Team API error");
				}),
				getWorkflow: mock(async () => mockDefaultWorkflow),
				getCurrentUser: mock(async () => mockCurrentUser),
			} as unknown as ShortcutClientWrapper);

			const result = await workflowTools.getDefaultWorkflow("team1");

			expect(result.content[0].type).toBe("text");
			const textContent = String(result.content[0].text);
			expect(textContent).toContain(
				'No default workflow found for team with public ID "team1". The general default workflow has id 100.',
			);
		});

		test("should return no default workflow found when workspace has no default", async () => {
			const workflowTools = new WorkflowTools({
				getWorkflow: mock(async () => null),
				getCurrentUser: mock(async () => mockCurrentUser),
			} as unknown as ShortcutClientWrapper);

			const result = await workflowTools.getDefaultWorkflow();

			expect(result.content[0].type).toBe("text");
			expect(String(result.content[0].text)).toBe("No default workflow found.");
		});

		test("should throw error when current user is not found", async () => {
			const workflowTools = new WorkflowTools({
				getCurrentUser: mock(async () => null),
			} as unknown as ShortcutClientWrapper);

			await expect(() => workflowTools.getDefaultWorkflow()).toThrow(
				"Failed to retrieve current user.",
			);
		});

		test("should handle team workflow retrieval failure", async () => {
			const workflowTools = new WorkflowTools({
				getTeam: mock(async () => mockTeam),
				getWorkflow: mock(async (id: number) => (id === 200 ? null : mockDefaultWorkflow)),
				getCurrentUser: mock(async () => mockCurrentUser),
			} as unknown as ShortcutClientWrapper);

			const result = await workflowTools.getDefaultWorkflow("team1");

			expect(result.content[0].type).toBe("text");
			const textContent = String(result.content[0].text);
			expect(textContent).toContain(
				'No default workflow found for team with public ID "team1". The general default workflow has id 100.',
			);
		});
	});

	describe("getWorkflow method", () => {
		const getWorkflowMock = mock(async (id: number) =>
			mockWorkflows.find((workflow) => workflow.id === id),
		);
		const mockClient = { getWorkflow: getWorkflowMock } as unknown as ShortcutClientWrapper;

		test("should return formatted workflow details when workflow is found", async () => {
			const workflowTools = new WorkflowTools(mockClient);
			const result = await workflowTools.getWorkflow(1, true);

			expect(result.content[0].type).toBe("text");
			const textContent = String(result.content[0].text);
			expect(textContent).toContain("Workflow: 1");
			expect(textContent).toContain('"id": 1');
			expect(textContent).toContain('"name": "Workflow 1"');
			expect(textContent).toContain('"description": "Description for Workflow 1"');
			expect(textContent).toContain('"default_state_id": 101');
			expect(textContent).toContain('"states"');
		});

		test("should return simplified workflow when full = false", async () => {
			const workflowTools = new WorkflowTools(mockClient);
			const result = await workflowTools.getWorkflow(1, false);

			expect(result.content[0].type).toBe("text");
			const textContent = String(result.content[0].text);
			expect(textContent).toContain("Workflow: 1");
			expect(textContent).toContain('"id": 1');
			expect(textContent).toContain('"name": "Workflow 1"');

			// When full = false, should return simplified entity structure
			expect(textContent).toContain('"workflow"');
			expect(textContent).toContain('"relatedEntities"');
		});

		test("should handle workflow not found", async () => {
			const workflowTools = new WorkflowTools({
				getWorkflow: mock(async () => null),
			} as unknown as ShortcutClientWrapper);

			const result = await workflowTools.getWorkflow(999);

			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toBe("Workflow with public ID: 999 not found.");
		});
	});

	describe("listWorkflows method", () => {
		const getWorkflowsMock = mock(async () => mockWorkflows);
		const mockClient = { getWorkflows: getWorkflowsMock } as unknown as ShortcutClientWrapper;

		test("should return formatted list of workflows when workflows are found", async () => {
			const workflowTools = new WorkflowTools(mockClient);
			const result = await workflowTools.listWorkflows();

			expect(result.content[0].type).toBe("text");
			const textContent = String(result.content[0].text);
			expect(textContent).toContain("Result (first 2 shown of 2 total workflows found):");
			expect(textContent).toContain('"id": 1');
			expect(textContent).toContain('"name": "Workflow 1"');
			expect(textContent).toContain('"id": 2');
			expect(textContent).toContain('"name": "Workflow 2"');
		});
	});

	test("should return no workflows found message when no workflows exist", async () => {
		const workflowTools = new WorkflowTools({
			getWorkflows: mock(async () => []),
		} as unknown as ShortcutClientWrapper);

		const result = await workflowTools.listWorkflows();

		expect(result.content[0].type).toBe("text");
		expect(result.content[0].text).toBe("No workflows found.");
	});

	test("should handle workflow with unknown default state", async () => {
		const workflowTools = new WorkflowTools({
			getWorkflows: mock(async () => [
				{
					id: 3,
					name: "Workflow 3",
					description: "Description for Workflow 3",
					default_state_id: 999, // Non-existent state ID
					states: [
						{ id: 301, name: "Unstarted", type: "unstarted" },
						{ id: 302, name: "Started", type: "started" },
					],
				} as Workflow,
			]),
		} as unknown as ShortcutClientWrapper);

		const result = await workflowTools.listWorkflows();

		expect(result.content[0].type).toBe("text");
		const textContent = String(result.content[0].text);
		expect(textContent).toContain("Result (first 1 shown of 1 total workflows found):");
		expect(textContent).toContain('"id": 3');
		expect(textContent).toContain('"name": "Workflow 3"');
	});
});
