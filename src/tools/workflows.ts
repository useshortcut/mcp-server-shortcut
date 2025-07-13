import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import { BaseTools } from "./base";

export class WorkflowTools extends BaseTools {
	static create(client: ShortcutClientWrapper, server: McpServer) {
		const tools = new WorkflowTools(client);

		server.tool(
			"get_workflow",
			"Get a Shortcut workflow by public ID",
			{ workflowPublicId: z.number().positive().describe("The public ID of the workflow to get") },
			async ({ workflowPublicId }) => await tools.getWorkflow(workflowPublicId),
		);

		server.tool(
			"list_workflows",
			"List all Shortcut workflows",
			async () => await tools.listWorkflows(),
		);

		return tools;
	}

	async getWorkflow(workflowPublicId: number) {
		const workflow = await this.client.getWorkflow(workflowPublicId);

		if (!workflow) return this.toResult(`Workflow with public ID: ${workflowPublicId} not found.`);

		return this.toResult(
			`Workflow: ${workflow.id}`,
			await this.entityWithRelatedEntities(workflow, "workflow"),
		);
	}

	async listWorkflows() {
		const workflows = await this.client.getWorkflows();

		if (!workflows.length) return this.toResult(`No workflows found.`);

		return this.toResult(
			`Result (first ${workflows.length} shown of ${workflows.length} total workflows found):`,
			await this.entitiesWithRelatedEntities(workflows, "workflows"),
		);
	}
}
