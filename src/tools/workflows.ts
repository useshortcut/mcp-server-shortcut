import { z } from "zod";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { CustomMcpServer } from "@/mcp/CustomMcpServer";
import { BaseTools } from "./base";

export class WorkflowTools extends BaseTools {
	static create(client: ShortcutClientWrapper, server: CustomMcpServer) {
		const tools = new WorkflowTools(client);

		server.addToolWithReadAccess(
			"workflows-get-default",
			"Get the default workflow for a specific team or the global default if no team is specified.",
			{
				teamPublicId: z
					.string()
					.optional()
					.describe("The public ID of the team to get the default workflow for."),
			},
			async ({ teamPublicId }) => await tools.getDefaultWorkflow(teamPublicId),
		);

		server.addToolWithReadAccess(
			"workflows-get-by-id",
			"Get a Shortcut workflow by public ID.",
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

		server.addToolWithReadAccess(
			"workflows-list",
			"List all Shortcut workflows.",
			async () => await tools.listWorkflows(),
		);

		return tools;
	}

	async getDefaultWorkflow(teamPublicId?: string) {
		if (teamPublicId) {
			try {
				const teamDefaultWorkflowId = await this.client
					.getTeam(teamPublicId)
					.then((t) => t?.default_workflow_id);
				if (teamDefaultWorkflowId) {
					const teamDefaultWorkflow = await this.client.getWorkflow(teamDefaultWorkflowId);
					if (teamDefaultWorkflow) {
						return this.toResult(
							`Default workflow for team "${teamPublicId}" has id ${teamDefaultWorkflow.id}.`,
							await this.entityWithRelatedEntities(teamDefaultWorkflow, "workflow"),
						);
					}
				}
			} catch {}
		}

		const currentUser = await this.client.getCurrentUser();
		if (!currentUser) throw new Error("Failed to retrieve current user.");

		const workspaceDefaultWorkflowId = currentUser.workspace2.default_workflow_id;
		const workspaceDefaultWorkflow = await this.client.getWorkflow(workspaceDefaultWorkflowId);

		if (workspaceDefaultWorkflow) {
			return this.toResult(
				`${teamPublicId ? `No default workflow found for team with public ID "${teamPublicId}". The general default workflow has id ` : "Default workflow has id "}${workspaceDefaultWorkflow.id}.`,
				await this.entityWithRelatedEntities(workspaceDefaultWorkflow, "workflow"),
			);
		}

		return this.toResult("No default workflow found.");
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
