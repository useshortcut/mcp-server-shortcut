import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Project } from "@shortcut/client";
import { z } from "zod";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { CustomMcpServer } from "@/mcp/CustomMcpServer";
import { BaseTools } from "./base";

/**
 * Tools for managing Shortcut projects.
 */
export class ProjectTools extends BaseTools {
	static create(client: ShortcutClientWrapper, server: CustomMcpServer) {
		const tools = new ProjectTools(client);

		server.addToolWithReadAccess(
			"projects-list",
			"List all projects in the Shortcut workspace.",
			{
				includeArchived: z
					.boolean()
					.optional()
					.describe("Whether to include archived projects in the list.")
					.default(false),
			},
			async (params) => await tools.listProjects(params),
		);

		server.addToolWithReadAccess(
			"projects-get-by-id",
			"Get a Shortcut project by public ID.",
			{
				projectPublicId: z.number().positive().describe("The public ID of the project to get"),
			},
			async ({ projectPublicId }) => await tools.getProject(projectPublicId),
		);

		server.addToolWithReadAccess(
			"projects-get-stories",
			"Get all stories in a specific project.",
			{
				projectPublicId: z.number().positive().describe("The public ID of the project"),
			},
			async ({ projectPublicId }) => await tools.getProjectStories(projectPublicId),
		);

		return tools;
	}

	private formatProject(
		project: Project,
		{ includeArchived = false }: { includeArchived?: boolean } = {},
	) {
		return {
			id: project.id,
			name: project.name,
			app_url: project.app_url,
			abbreviation: project.abbreviation,
			...(project.description ? { description: project.description } : {}),
			...(project.color ? { color: project.color } : {}),
			team_id: project.team_id,
			workflow_id: project.workflow_id,
			...(includeArchived ? { archived: project.archived } : {}),
			stats: project.stats,
		};
	}

	async listProjects({
		includeArchived = false,
	}: {
		includeArchived?: boolean;
	}): Promise<CallToolResult> {
		const projects = await this.client.listProjects();

		const filteredProjects = includeArchived ? projects : projects.filter((p) => !p.archived);

		if (!filteredProjects.length) {
			return this.toResult("Result: No projects found.");
		}

		const formattedProjects = filteredProjects.map((project) =>
			this.formatProject(project, { includeArchived }),
		);

		return this.toResult(`Result (${filteredProjects.length} projects found):`, {
			projects: formattedProjects,
		});
	}

	async getProject(projectPublicId: number): Promise<CallToolResult> {
		const project = await this.client.getProject(projectPublicId);

		if (!project)
			throw new Error(`Failed to retrieve Shortcut project with public ID: ${projectPublicId}`);

		return this.toResult(`Project: ${projectPublicId}`, this.formatProject(project));
	}

	async getProjectStories(projectPublicId: number): Promise<CallToolResult> {
		const project = await this.client.getProject(projectPublicId);
		if (!project)
			throw new Error(`Failed to retrieve Shortcut project with public ID: ${projectPublicId}`);

		const stories = await this.client.listProjectStories(projectPublicId);

		if (!stories.length) {
			return this.toResult(`Result: No stories found in project ${projectPublicId}.`);
		}

		return this.toResult(
			`Result (${stories.length} stories found in project ${projectPublicId}):`,
			await this.entitiesWithRelatedEntities(stories, "stories"),
		);
	}
}
