import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import { BaseTools } from "./base";

export class DocumentTools extends BaseTools {
	static create(client: ShortcutClientWrapper, server: McpServer, isReadonly = false) {
		const tools = new DocumentTools(client, isReadonly);

		if (!isReadonly) {
			server.tool(
				"create-document",
				"Create a new document in Shortcut with a title and content. Returns the document's id, title, and app_url. Note: Use HTML markup for the content (e.g., <p>, <h1>, <ul>, <strong>) rather than Markdown.",
				{
					title: z
						.string()
						.max(256)
						.describe("The title for the new document (max 256 characters)"),
					content: z
						.string()
						.describe(
							"The content for the new document in HTML format (e.g., <p>Hello</p>, <h1>Title</h1>, <ul><li>Item</li></ul>)",
						),
				},
				async ({ title, content }) => await tools.createDocument(title, content),
			);
		}

		return tools;
	}

	private async createDocument(title: string, content: string) {
		try {
			const doc = await this.client.createDoc({
				title,
				content,
			});

			return this.toResult("Document created successfully", {
				id: doc.id,
				title: doc.title,
				app_url: doc.app_url,
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			return this.toResult(`Failed to create document: ${errorMessage}`);
		}
	}
}
