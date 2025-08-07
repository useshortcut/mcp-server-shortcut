import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import { BaseTools } from "./base";

export class WorkflowTools extends BaseTools {
	static create(client: ShortcutClientWrapper, server: McpServer) {
		const tools = new WorkflowTools(client);

		server.tool(
			"get-workflow",
			"Get a Shortcut workflow by public ID",
			{
				workflowPublicId: z.number().positive().describe("The public ID of the workflow to get"),
				full: z
					.boolean()
					.optional()
					.default(false)
					.describe(
						"True to return all workflow fields from the API. False to return a slim version that excludes uncommon fields",
					),
			},
			async ({ workflowPublicId, full }) => await tools.getWorkflow(workflowPublicId, full),
		);

		server.tool(
			"list-workflows",
			"List all Shortcut workflows",
			async () => await tools.listWorkflows(),
		);

		return tools;
	}

	async getWorkflow(workflowPublicId: number, full = false) {
		const workflow = await this.client.getWorkflow(workflowPublicId);

		if (!workflow) return this.toResult(`Workflow with public ID: ${workflowPublicId} not found.`);

		return this.toResult(
			`Workflow: ${workflow.id}`,
			await this.entityWithRelatedEntities(workflow, "workflow", full),
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
