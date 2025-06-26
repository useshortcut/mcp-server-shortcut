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

			expect(mockTool).toHaveBeenCalledTimes(2);

			expect(mockTool.mock.calls?.[0]?.[0]).toBe("get-workflow");
			expect(mockTool.mock.calls?.[1]?.[0]).toBe("list-workflows");
		});

		test("should call correct function from tool", async () => {
			const mockClient = {} as ShortcutClientWrapper;
			const mockTool = mock();
			const mockServer = { tool: mockTool } as unknown as McpServer;

			const tools = WorkflowTools.create(mockClient, mockServer);

			spyOn(tools, "getWorkflow").mockImplementation(async () => ({
				content: [{ text: "", type: "text" }],
			}));
			await mockTool.mock.calls?.[0]?.[3]({ workflowPublicId: 1 });
			expect(tools.getWorkflow).toHaveBeenCalledWith(1);

			spyOn(tools, "listWorkflows").mockImplementation(async () => ({
				content: [{ text: "", type: "text" }],
			}));
			await mockTool.mock.calls?.[1]?.[2]();
			expect(tools.listWorkflows).toHaveBeenCalled();
		});
	});

	describe("getWorkflow method", () => {
		const getWorkflowMock = mock(async (id: number) =>
			mockWorkflows.find((workflow) => workflow.id === id),
		);
		const mockClient = { getWorkflow: getWorkflowMock } as unknown as ShortcutClientWrapper;

		test("should return formatted workflow details when workflow is found", async () => {
			const workflowTools = new WorkflowTools(mockClient);
			const result = await workflowTools.getWorkflow(1);

			expect(result.content[0].type).toBe("text");
			const textContent = String(result.content[0].text);
			expect(textContent).toContain("Workflow: 1");
			expect(textContent).toContain('"id": 1');
			expect(textContent).toContain('"name": "Workflow 1"');
			expect(textContent).toContain('"description": "Description for Workflow 1"');
			expect(textContent).toContain('"default_state_id": 101');
			expect(textContent).toContain('"states"');
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
