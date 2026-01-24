import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { CustomField } from "@shortcut/client";
import { z } from "zod";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { CustomMcpServer } from "@/mcp/CustomMcpServer";
import { BaseTools } from "./base";

/**
 * Tools for managing Shortcut custom fields.
 */
export class CustomFieldTools extends BaseTools {
	static create(client: ShortcutClientWrapper, server: CustomMcpServer) {
		const tools = new CustomFieldTools(client);

		server.addToolWithReadAccess(
			"custom-fields-list",
			"List all custom fields in the Shortcut workspace, including their possible values. Use this to discover field IDs and value IDs needed for setting custom fields on stories.",
			{
				includeDisabled: z
					.boolean()
					.optional()
					.describe("Whether to include disabled custom fields in the list.")
					.default(false),
			},
			async (params) => await tools.listCustomFields(params),
		);

		return tools;
	}

	private formatCustomField(
		field: CustomField,
		{ includeDisabled = false }: { includeDisabled?: boolean } = {},
	) {
		const values = (field.values || [])
			.filter((v) => includeDisabled || v.enabled)
			.map((v) => ({
				id: v.id,
				value: v.value,
				position: v.position,
				...(v.color_key ? { color_key: v.color_key } : {}),
				...(includeDisabled ? { enabled: v.enabled } : {}),
			}));

		return {
			id: field.id,
			name: field.name,
			field_type: field.field_type,
			...(field.description ? { description: field.description } : {}),
			...(field.canonical_name ? { canonical_name: field.canonical_name } : {}),
			...(includeDisabled ? { enabled: field.enabled } : {}),
			values,
		};
	}

	async listCustomFields({
		includeDisabled = false,
	}: {
		includeDisabled?: boolean;
	}): Promise<CallToolResult> {
		const customFields = await this.client.getCustomFields();

		const filteredFields = includeDisabled ? customFields : customFields.filter((f) => f.enabled);

		if (!filteredFields.length) {
			return this.toResult("Result: No custom fields found.");
		}

		const formattedFields = filteredFields.map((field) =>
			this.formatCustomField(field, { includeDisabled }),
		);

		return this.toResult(`Result (${filteredFields.length} custom fields found):`, {
			custom_fields: formattedFields,
		});
	}
}
