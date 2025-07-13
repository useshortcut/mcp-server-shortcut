import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BaseTools } from "./base";

export class ProjectTools extends BaseTools {
	static create(client: ShortcutClientWrapper, server: McpServer) {
		const tools = new ProjectTools(client);

		server.tool(
			"list-projects",
			"Get a list of all Shortcut projects",
			{},
			async () => await tools.listProjects(),
		);

		server.tool(
			"get-project",
			"Get a specific Shortcut project by ID",
			{
				projectId: z.number().positive().describe("The ID of the project to get"),
			},
			async ({ projectId }) => await tools.getProject(projectId),
		);

		server.tool(
			"search-projects",
			"Find Shortcut projects by name",
			{
				name: z.string().optional().describe("Find projects matching the specified name"),
			},
			async ({ name }) => await tools.searchProjects(name),
		);

		return tools;
	}

	async listProjects() {
		const projects = await this.client.listProjects();

		if (!projects || projects.length === 0) {
			return this.toResult("No projects found.");
		}

		return this.toResult(
			`Found ${projects.length} projects:`,
			projects, // TODO: toCorrectedEntitiesが必要であれば実装を行う
		);
	}

	async getProject(projectId: number) {
		const project = await this.client.getProject(projectId);

		if (!project) {
			throw new Error(`Failed to retrieve Shortcut project with ID: ${projectId}`);
		}

		return this.toResult(`Project ID ${projectId}:`, project); // TODO: toCorrectedEntityが必要であれば実装を行う
	}

	async searchProjects(name?: string) {
		const projects = await this.client.listProjects();

		if (!projects || projects.length === 0) {
			return this.toResult("No projects found.");
		}

		let filteredProjects = projects;
		if (name) {
			filteredProjects = projects.filter((project) =>
				project.name.toLowerCase().includes(name.toLowerCase()),
			);
		}

		if (filteredProjects.length === 0) {
			return this.toResult(`No projects found matching "${name}".`);
		}

		return this.toResult(
			`Found ${filteredProjects.length} projects matching "${name}":`,
			filteredProjects, // TODO: toCorrectedEntitiesが必要であれば実装を行う
		);
	}
}
