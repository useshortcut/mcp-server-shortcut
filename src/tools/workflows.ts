import { z } from "zod";
import type { ShortcutClient } from "../shortcut-client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BaseTools } from "./base";

export class WorkflowTools extends BaseTools {
	static create(client: ShortcutClient, server: McpServer) {
		const tools = new WorkflowTools(client);

		server.tool(
			"get-workflow",
			"Get a Shortcut workflow by public ID",
			{ workflowPublicId: z.number().positive().describe("The public ID of the workflow to get") },
			async ({ workflowPublicId }) => await tools.getWorkflow(workflowPublicId),
		);

		server.tool(
			"list-workflows",
			"List all Shortcut workflows",
			async () => await tools.listWorkflows(),
		);

		return tools;
	}

	async getWorkflow(workflowPublicId: number) {
		const workflow = await this.client.getWorkflow(workflowPublicId);

		if (!workflow) return this.toResult(`Workflow with public ID: ${workflowPublicId} not found.`);

		return this.toResult(`Workflow with id: ${workflow.id}
Name: ${workflow.name}
Description: ${workflow.description}
States:
${workflow.states.map((state) => `- ${state.id}: ${state.name} (default: ${state.id === workflow.default_state_id ? "yes" : "no"}, type: ${state.type})`).join("\n")}
`);
	}

	async listWorkflows() {
		const workflows = await this.client.getWorkflows();

		if (!workflows.length) return this.toResult(`No workflows found.`);

		return this.toResult(`Result (first ${workflows.length} shown of ${workflows.length} total workflows found):
${workflows
	.map(
		(workflow) => `Workflow with id: ${workflow.id}
Name: ${workflow.name}
Description: ${workflow.description}
Default State: ${workflow.states.find((state) => state.id === workflow.default_state_id)?.name || "[Unknown]"}
`,
	)
	.join("\n\n")}`);
	}
}
