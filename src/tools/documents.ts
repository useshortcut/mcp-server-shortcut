import { z } from "zod";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { CustomMcpServer } from "@/mcp/CustomMcpServer";
import { BaseTools } from "./base";

export class DocumentTools extends BaseTools {
	static create(client: ShortcutClientWrapper, server: CustomMcpServer) {
		const tools = new DocumentTools(client);

		server.addToolWithWriteAccess(
			"documents-create",
			"Create a new document in Shortcut with a title and content. Returns the document's id, title, and app_url. Note: Use Markdown format for the content.",
			{
				title: z.string().max(256).describe("The title for the new document (max 256 characters)"),
				content: z.string().describe("The content for the new document in Markdown format."),
			},
			async ({ title, content }) => await tools.createDocument(title, content),
		);

		server.addToolWithWriteAccess(
			"documents-update",
			"Update the content and/or title of an existing document in Shortcut.",
			{
				docId: z.string().describe("The ID of the document to retrieve"),
				title: z
					.string()
					.max(256)
					.describe("The title for the document (max 256 characters)")
					.optional(),
				content: z
					.string()
					.describe("The updated content for the document in Markdown format")
					.optional(),
			},
			async ({ docId, content, title }: { docId: string; content?: string; title?: string }) =>
				await tools.updateDocument(docId, title, content),
		);

		server.addToolWithReadAccess(
			"documents-list",
			"List all documents in Shortcut.",
			async () => await tools.listDocuments(),
		);

		server.addToolWithReadAccess(
			"documents-search",
			"Find documents.",
			{
				nextPageToken: z
					.string()
					.optional()
					.describe(
						"If a next_page_token was returned from the search result, pass it in to get the next page of results. Should be combined with the original search parameters.",
					),
				title: z.string().describe("Find documents matching the specified name"),
				archived: z
					.boolean()
					.optional()
					.describe("Find only documents matching the specified archived status"),
				createdByCurrentUser: z
					.boolean()
					.optional()
					.describe("Find only documents created by current user"),
				followedByCurrentUser: z
					.boolean()
					.optional()
					.describe("Find only documents followed by current user"),
			},
			async ({ nextPageToken, title, archived, createdByCurrentUser, followedByCurrentUser }) =>
				await tools.searchDocuments(
					{ title, archived, createdByCurrentUser, followedByCurrentUser },
					nextPageToken,
				),
		);

		server.addToolWithReadAccess(
			"documents-get-by-id",
			"Get a document as markdown by its ID.",
			{
				docId: z.string().describe("The ID of the document to retrieve"),
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
