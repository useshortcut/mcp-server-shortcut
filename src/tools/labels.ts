import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Label } from "@shortcut/client";
import { z } from "zod";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { CustomMcpServer } from "@/mcp/CustomMcpServer";
import { BaseTools } from "./base";

/**
 * Tools for managing Shortcut labels.
 */
export class LabelTools extends BaseTools {
	static create(client: ShortcutClientWrapper, server: CustomMcpServer) {
		const tools = new LabelTools(client);

		server.addToolWithReadAccess(
			"labels-list",
			"List all labels in the Shortcut workspace.",
			{},
			async () => await tools.listLabels(),
		);

		server.addToolWithWriteAccess(
			"labels-create",
			"Create a new label in Shortcut.",
			{
				name: z.string().min(1).max(128).describe("The name of the new label. Required."),
				color: z
					.string()
					.regex(/^#[a-fA-F0-9]{6}$/)
					.optional()
					.describe('The hex color to be displayed with the label (e.g., "#ff0000").'),
				description: z.string().max(1024).optional().describe("A description of the label."),
			},
			async (params) => await tools.createLabel(params),
		);

		return tools;
	}

	private formatLabel(label: Label): Partial<Label> {
		return {
			id: label.id,
			name: label.name,
			app_url: label.app_url,
			color: label.color ?? null,
			description: label.description ?? null,
			archived: label.archived,
			stats: label.stats,
		};
	}

	async listLabels(): Promise<CallToolResult> {
		const labels = await this.client.listLabels();

		if (!labels.length) {
			return this.toResult("Result: No labels found.");
		}

		const formattedLabels = labels.map((label) => this.formatLabel(label));

		return this.toResult(`Result (${labels.length} labels found):`, {
			labels: formattedLabels,
		});
	}

	async createLabel({
		name,
		color,
		description,
	}: {
		name: string;
		color?: string;
		description?: string;
	}): Promise<CallToolResult> {
		const label = await this.client.createLabel({
			name,
			color,
			description,
		});

		return this.toResult(`Label created with ID: ${label.id}.`, {
			label: this.formatLabel(label),
		});
	}
}
