import { z } from "zod";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { CustomMcpServer } from "@/mcp/CustomMcpServer";
import { BaseTools } from "./base";

export class DocumentTools extends BaseTools {
	static create(client: ShortcutClientWrapper, server: CustomMcpServer) {
		const tools = new DocumentTools(client);

		server.addToolWithWriteAccess(
			"documents-create",
			"Create a new document (Markdown format).",
			{
				title: z.string().max(256).describe("Document title"),
				content: z.string().describe("Content in Markdown"),
			},
			async ({ title, content }) => await tools.createDocument(title, content),
		);

		server.addToolWithWriteAccess(
			"documents-update",
			"Update a document's title or content.",
			{
				docId: z.string().describe("Document ID"),
				title: z.string().max(256).optional().describe("Document title"),
				content: z.string().optional().describe("Content in Markdown"),
			},
			async ({ docId, content, title }: { docId: string; content?: string; title?: string }) =>
				await tools.updateDocument(docId, title, content),
		);

		server.addToolWithReadAccess(
			"documents-list",
			"List all documents.",
			async () => await tools.listDocuments(),
		);

		server.addToolWithReadAccess(
			"documents-search",
			"Search for documents.",
			{
				nextPageToken: z.string().optional().describe("Pagination token from previous search"),
				title: z.string().describe("Title contains"),
				archived: z.boolean().optional().describe("Filter by archived status"),
				createdByCurrentUser: z.boolean().optional().describe("Created by me"),
				followedByCurrentUser: z.boolean().optional().describe("Followed by me"),
			},
			async ({ nextPageToken, title, archived, createdByCurrentUser, followedByCurrentUser }) =>
				await tools.searchDocuments(
					{ title, archived, createdByCurrentUser, followedByCurrentUser },
					nextPageToken,
				),
		);

		server.addToolWithReadAccess(
			"documents-get-by-id",
			"Get a document by ID (returns Markdown).",
			{
				docId: z.string().describe("Document ID"),
			},
			async ({ docId }: { docId: string }) => await tools.getDocumentById(docId),
		);

		return tools;
	}

	private async createDocument(title: string, content: string) {
		try {
			const doc = await this.client.createDoc({
				title,
				content,
				content_format: "markdown",
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

	private async updateDocument(docId: string, title?: string, content?: string) {
		try {
			const doc = await this.client.getDocById(docId);
			if (!doc) return this.toResult(`Document with ID ${docId} not found.`);

			const result = await this.client.updateDoc(docId, {
				title: title ?? doc.title ?? "",
				content: content ?? doc.content_markdown ?? "",
				content_format: "markdown",
			});

			return this.toResult("Document updated successfully", {
				id: result.id,
				title: result.title,
				content: result.content_markdown,
				app_url: result.app_url,
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			return this.toResult(`Failed to update document: ${errorMessage}`);
		}
	}

	private async listDocuments() {
		try {
			const docs = await this.client.listDocs();
			if (!docs?.length) return this.toResult("No documents were found.");
			return this.toResult(`Found ${docs.length} documents.`, docs);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			return this.toResult(`Failed to list documents: ${errorMessage}`);
		}
	}

	private async searchDocuments(
		params: {
			title: string;
			archived?: boolean;
			createdByCurrentUser?: boolean;
			followedByCurrentUser?: boolean;
		},
		nextPageToken?: string,
	) {
		try {
			const { documents, total, next_page_token } = await this.client.searchDocuments({
				...params,
				nextPageToken,
			});

			if (!documents) throw new Error(`Failed to search for document matching your query.`);
			if (!documents.length) return this.toResult(`Result: No documents found.`);

			return this.toResult(
				`Result (${documents.length} shown of ${total} total documents found):`,
				documents,
				next_page_token,
			);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			return this.toResult(`Failed to search documents: ${errorMessage}`);
		}
	}

	private async getDocumentById(docId: string) {
		try {
			const doc = await this.client.getDocById(docId);
			if (!doc) return this.toResult(`Document with ID ${docId} not found.`);
			return this.toResult(`Document with ID ${docId}`, doc);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			return this.toResult(`Failed to get document: ${errorMessage}`);
		}
	}
}
