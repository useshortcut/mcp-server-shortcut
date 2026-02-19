import { describe, expect, mock, test } from "bun:test";
import type { DocSlim } from "@shortcut/client";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { CustomMcpServer } from "@/mcp/CustomMcpServer";
import { DocumentTools } from "./documents";
import { getTextContent } from "./utils/test-helpers";

describe("DocumentTools", () => {
	const mockDoc = {
		id: "doc-123",
		title: "Test Document",
		app_url: "https://app.shortcut.com/workspace/write/doc-123",
	} satisfies DocSlim;

	const mockDocFull = {
		...mockDoc,
		content_markdown: "Original content",
	};

	const createMockClient = (methods = {}) =>
		({
			createDoc: mock(async () => mockDoc),
			listDocs: mock(async () => [mockDoc]),
			searchDocuments: mock(async () => ({
				documents: [mockDoc],
				total: 1,
				next_page_token: null,
			})),
			getDocById: mock(async () => mockDoc),
			...methods,
		}) as unknown as ShortcutClientWrapper;

	describe("create method", () => {
		test("should register document tools with the server", () => {
			const mockClient = createMockClient();
			const mockWriteTool = mock();
			const mockReadTool = mock();
			const mockServer = {
				addToolWithWriteAccess: mockWriteTool,
				addToolWithReadAccess: mockReadTool,
			} as unknown as CustomMcpServer;

			DocumentTools.create(mockClient, mockServer);

			expect(mockWriteTool).toHaveBeenCalledTimes(2);
			expect(mockWriteTool.mock.calls?.[0]?.[0]).toBe("documents-create");
			expect(mockWriteTool.mock.calls?.[1]?.[0]).toBe("documents-update");
			expect(mockReadTool).toHaveBeenCalledTimes(3);
			const [listCall, findCall, getCall] = mockReadTool.mock.calls || [];
			expect(listCall?.[0]).toBe("documents-list");
			expect(findCall?.[0]).toBe("documents-search");
			expect(getCall?.[0]).toBe("documents-get-by-id");
		});
	});

	describe("tool handler", () => {
		test("should successfully create a document", async () => {
			const createDocMock = mock(async () => mockDoc);
			const mockClient = createMockClient({ createDoc: createDocMock });
			const mockWriteTool = mock();
			const mockReadTool = mock();
			const mockServer = {
				addToolWithWriteAccess: mockWriteTool,
				addToolWithReadAccess: mockReadTool,
			} as unknown as CustomMcpServer;

			DocumentTools.create(mockClient, mockServer);

			const handler = mockWriteTool.mock.calls?.[0]?.[3];
			const result = await handler({ title: "Test Document", content: "Test content" });

			expect(createDocMock).toHaveBeenCalledWith({
				title: "Test Document",
				content: "Test content",
				content_format: "markdown",
			});

			expect(getTextContent(result)).toContain("Document created successfully");
			expect(getTextContent(result)).toContain('"id": "doc-123"');
			expect(getTextContent(result)).toContain('"title": "Test Document"');
			expect(getTextContent(result)).toContain(
				'"app_url": "https://app.shortcut.com/workspace/write/doc-123"',
			);
		});

		test("should handle errors when document creation fails", async () => {
			const errorMessage = "API error: Unauthorized";
			const createDocMock = mock(async () => {
				throw new Error(errorMessage);
			});
			const mockClient = createMockClient({ createDoc: createDocMock });
			const mockWriteTool = mock();
			const mockReadTool = mock();
			const mockServer = {
				addToolWithWriteAccess: mockWriteTool,
				addToolWithReadAccess: mockReadTool,
			} as unknown as CustomMcpServer;

			DocumentTools.create(mockClient, mockServer);

			const handler = mockWriteTool.mock.calls?.[0]?.[3];
			const result = await handler({ title: "Test Document", content: "Test content" });

			expect(createDocMock).toHaveBeenCalledWith({
				title: "Test Document",
				content: "Test content",
				content_format: "markdown",
			});

			expect(getTextContent(result)).toBe(`Failed to create document: ${errorMessage}`);
		});

		test("should handle non-Error exceptions", async () => {
			const createDocMock = mock(async () => {
				throw "Some string error";
			});
			const mockClient = createMockClient({ createDoc: createDocMock });
			const mockWriteTool = mock();
			const mockReadTool = mock();
			const mockServer = {
				addToolWithWriteAccess: mockWriteTool,
				addToolWithReadAccess: mockReadTool,
			} as unknown as CustomMcpServer;

			DocumentTools.create(mockClient, mockServer);

			const handler = mockWriteTool.mock.calls?.[0]?.[3];
			const result = await handler({ title: "Test Document", content: "Test content" });

			expect(getTextContent(result)).toBe("Failed to create document: Unknown error");
		});

		test("should enforce title length constraint", () => {
			const mockClient = createMockClient();
			const mockWriteTool = mock();
			const mockReadTool = mock();
			const mockServer = {
				addToolWithWriteAccess: mockWriteTool,
				addToolWithReadAccess: mockReadTool,
			} as unknown as CustomMcpServer;

			DocumentTools.create(mockClient, mockServer);

			const schema = mockWriteTool.mock.calls?.[0]?.[2];
			expect(schema.title.maxLength).toBe(256);
		});

		test("should successfully update a document with title and content", async () => {
			const getDocByIdMock = mock(async () => mockDocFull);
			const updateDocMock = mock(async () => ({
				...mockDocFull,
				title: "Updated Title",
				content_markdown: "Updated content",
			}));
			const mockClient = createMockClient({
				getDocById: getDocByIdMock,
				updateDoc: updateDocMock,
			});
			const mockWriteTool = mock();
			const mockReadTool = mock();
			const mockServer = {
				addToolWithWriteAccess: mockWriteTool,
				addToolWithReadAccess: mockReadTool,
			} as unknown as CustomMcpServer;

			DocumentTools.create(mockClient, mockServer);

			const handler = mockWriteTool.mock.calls?.[1]?.[3];
			const result = await handler({
				docId: "doc-123",
				title: "Updated Title",
				content: "Updated content",
			});

			expect(getDocByIdMock).toHaveBeenCalledWith("doc-123");
			expect(updateDocMock).toHaveBeenCalledWith("doc-123", {
				title: "Updated Title",
				content: "Updated content",
				content_format: "markdown",
			});

			expect(getTextContent(result)).toContain("Document updated successfully");
			expect(getTextContent(result)).toContain('"title": "Updated Title"');
			expect(getTextContent(result)).toContain('"content": "Updated content"');
		});

		test("should update only title when content is not provided", async () => {
			const getDocByIdMock = mock(async () => mockDocFull);
			const updateDocMock = mock(async () => ({
				...mockDocFull,
				title: "Updated Title",
			}));
			const mockClient = createMockClient({
				getDocById: getDocByIdMock,
				updateDoc: updateDocMock,
			});
			const mockWriteTool = mock();
			const mockReadTool = mock();
			const mockServer = {
				addToolWithWriteAccess: mockWriteTool,
				addToolWithReadAccess: mockReadTool,
			} as unknown as CustomMcpServer;

			DocumentTools.create(mockClient, mockServer);

			const handler = mockWriteTool.mock.calls?.[1]?.[3];
			await handler({ docId: "doc-123", title: "Updated Title" });

			expect(updateDocMock).toHaveBeenCalledWith("doc-123", {
				title: "Updated Title",
				content: "Original content",
				content_format: "markdown",
			});
		});

		test("should update only content when title is not provided", async () => {
			const getDocByIdMock = mock(async () => mockDocFull);
			const updateDocMock = mock(async () => ({
				...mockDocFull,
				content_markdown: "Updated content",
			}));
			const mockClient = createMockClient({
				getDocById: getDocByIdMock,
				updateDoc: updateDocMock,
			});
			const mockWriteTool = mock();
			const mockReadTool = mock();
			const mockServer = {
				addToolWithWriteAccess: mockWriteTool,
				addToolWithReadAccess: mockReadTool,
			} as unknown as CustomMcpServer;

			DocumentTools.create(mockClient, mockServer);

			const handler = mockWriteTool.mock.calls?.[1]?.[3];
			await handler({ docId: "doc-123", content: "Updated content" });

			expect(updateDocMock).toHaveBeenCalledWith("doc-123", {
				title: "Test Document",
				content: "Updated content",
				content_format: "markdown",
			});
		});

		test("should handle document not found when updating", async () => {
			const getDocByIdMock = mock(async () => null);
			const updateDocMock = mock(async () => mockDocFull);
			const mockClient = createMockClient({
				getDocById: getDocByIdMock,
				updateDoc: updateDocMock,
			});
			const mockWriteTool = mock();
			const mockReadTool = mock();
			const mockServer = {
				addToolWithWriteAccess: mockWriteTool,
				addToolWithReadAccess: mockReadTool,
			} as unknown as CustomMcpServer;

			DocumentTools.create(mockClient, mockServer);

			const handler = mockWriteTool.mock.calls?.[1]?.[3];
			const result = await handler({ docId: "missing-doc", title: "Updated Title" });

			expect(getDocByIdMock).toHaveBeenCalledWith("missing-doc");
			expect(updateDocMock).not.toHaveBeenCalled();
			expect(getTextContent(result)).toBe("Document with ID missing-doc not found.");
		});

		test("should handle errors when document update fails", async () => {
			const getDocByIdMock = mock(async () => mockDocFull);
			const updateDocMock = mock(async () => {
				throw new Error("Update failed");
			});
			const mockClient = createMockClient({
				getDocById: getDocByIdMock,
				updateDoc: updateDocMock,
			});
			const mockWriteTool = mock();
			const mockReadTool = mock();
			const mockServer = {
				addToolWithWriteAccess: mockWriteTool,
				addToolWithReadAccess: mockReadTool,
			} as unknown as CustomMcpServer;

			DocumentTools.create(mockClient, mockServer);

			const handler = mockWriteTool.mock.calls?.[1]?.[3];
			const result = await handler({ docId: "doc-123", title: "Updated Title" });

			expect(getTextContent(result)).toBe("Failed to update document: Update failed");
		});

		test("should handle non-Error exceptions when updating", async () => {
			const getDocByIdMock = mock(async () => mockDocFull);
			const updateDocMock = mock(async () => {
				throw "Some string error";
			});
			const mockClient = createMockClient({
				getDocById: getDocByIdMock,
				updateDoc: updateDocMock,
			});
			const mockWriteTool = mock();
			const mockReadTool = mock();
			const mockServer = {
				addToolWithWriteAccess: mockWriteTool,
				addToolWithReadAccess: mockReadTool,
			} as unknown as CustomMcpServer;

			DocumentTools.create(mockClient, mockServer);

			const handler = mockWriteTool.mock.calls?.[1]?.[3];
			const result = await handler({ docId: "doc-123", title: "Updated Title" });

			expect(getTextContent(result)).toBe("Failed to update document: Unknown error");
		});

		test("should list documents", async () => {
			const listDocsMock = mock(async () => [mockDoc]);
			const mockClient = createMockClient({ listDocs: listDocsMock });
			const mockWriteTool = mock();
			const mockReadTool = mock();
			const mockServer = {
				addToolWithWriteAccess: mockWriteTool,
				addToolWithReadAccess: mockReadTool,
			} as unknown as CustomMcpServer;

			DocumentTools.create(mockClient, mockServer);

			const handler = mockReadTool.mock.calls?.[0]?.[2];
			const result = await handler();

			expect(listDocsMock).toHaveBeenCalled();
			expect(getTextContent(result)).toContain("Found 1 documents.");
			expect(getTextContent(result)).toContain('"id": "doc-123"');
		});

		test("should handle empty document list", async () => {
			const listDocsMock = mock(async () => [] as DocSlim[]);
			const mockClient = createMockClient({ listDocs: listDocsMock });
			const mockWriteTool = mock();
			const mockReadTool = mock();
			const mockServer = {
				addToolWithWriteAccess: mockWriteTool,
				addToolWithReadAccess: mockReadTool,
			} as unknown as CustomMcpServer;

			DocumentTools.create(mockClient, mockServer);

			const handler = mockReadTool.mock.calls?.[0]?.[2];
			const result = await handler();

			expect(getTextContent(result)).toBe("No documents were found.");
		});

		test("should handle list errors", async () => {
			const listDocsMock = mock(async () => {
				throw new Error("List failed");
			});
			const mockClient = createMockClient({ listDocs: listDocsMock });
			const mockWriteTool = mock();
			const mockReadTool = mock();
			const mockServer = {
				addToolWithWriteAccess: mockWriteTool,
				addToolWithReadAccess: mockReadTool,
			} as unknown as CustomMcpServer;

			DocumentTools.create(mockClient, mockServer);

			const handler = mockReadTool.mock.calls?.[0]?.[2];
			const result = await handler();

			expect(getTextContent(result)).toBe("Failed to list documents: List failed");
		});

		test("should search documents with filters and pagination", async () => {
			const searchDocumentsMock = mock(async () => ({
				documents: [mockDoc],
				total: 1,
				next_page_token: "next-token",
			}));
			const mockClient = createMockClient({ searchDocuments: searchDocumentsMock });
			const mockWriteTool = mock();
			const mockReadTool = mock();
			const mockServer = {
				addToolWithWriteAccess: mockWriteTool,
				addToolWithReadAccess: mockReadTool,
			} as unknown as CustomMcpServer;

			DocumentTools.create(mockClient, mockServer);

			const handler = mockReadTool.mock.calls?.[1]?.[3];
			const result = await handler({
				title: "Test",
				archived: false,
				createdByCurrentUser: true,
				followedByCurrentUser: false,
				nextPageToken: "token",
			});

			expect(searchDocumentsMock).toHaveBeenCalledWith({
				title: "Test",
				archived: false,
				createdByCurrentUser: true,
				followedByCurrentUser: false,
				nextPageToken: "token",
			});

			const text = getTextContent(result);
			expect(text).toContain("Result (1 shown of 1 total documents found):");
			expect(text).toContain('"id": "doc-123"');
			expect(text).toContain("<next-page-token>next-token</next-page-token>");
		});

		test("should handle empty search results", async () => {
			const searchDocumentsMock = mock(async () => ({
				documents: [] as DocSlim[],
				total: 0,
				next_page_token: null,
			}));
			const mockClient = createMockClient({ searchDocuments: searchDocumentsMock });
			const mockWriteTool = mock();
			const mockReadTool = mock();
			const mockServer = {
				addToolWithWriteAccess: mockWriteTool,
				addToolWithReadAccess: mockReadTool,
			} as unknown as CustomMcpServer;

			DocumentTools.create(mockClient, mockServer);

			const handler = mockReadTool.mock.calls?.[1]?.[3];
			const result = await handler({ title: "Test" });

			expect(getTextContent(result)).toBe("Result: No documents found.");
		});

		test("should handle search errors", async () => {
			const searchDocumentsMock = mock(async () => {
				throw new Error("Search failed");
			});
			const mockClient = createMockClient({ searchDocuments: searchDocumentsMock });
			const mockWriteTool = mock();
			const mockReadTool = mock();
			const mockServer = {
				addToolWithWriteAccess: mockWriteTool,
				addToolWithReadAccess: mockReadTool,
			} as unknown as CustomMcpServer;

			DocumentTools.create(mockClient, mockServer);

			const handler = mockReadTool.mock.calls?.[1]?.[3];
			const result = await handler({ title: "Test" });

			expect(getTextContent(result)).toBe("Failed to search documents: Search failed");
		});

		test("should get document by ID", async () => {
			const getDocByIdMock = mock(async () => mockDoc);
			const mockClient = createMockClient({ getDocById: getDocByIdMock });
			const mockWriteTool = mock();
			const mockReadTool = mock();
			const mockServer = {
				addToolWithWriteAccess: mockWriteTool,
				addToolWithReadAccess: mockReadTool,
			} as unknown as CustomMcpServer;

			DocumentTools.create(mockClient, mockServer);

			const handler = mockReadTool.mock.calls?.[2]?.[3];
			const result = await handler({ docId: "doc-123" });

			expect(getDocByIdMock).toHaveBeenCalledWith("doc-123");
			expect(getTextContent(result)).toContain("Document with ID doc-123");
			expect(getTextContent(result)).toContain('"id": "doc-123"');
		});

		test("should handle missing document by ID", async () => {
			const getDocByIdMock = mock(async () => null);
			const mockClient = createMockClient({ getDocById: getDocByIdMock });
			const mockWriteTool = mock();
			const mockReadTool = mock();
			const mockServer = {
				addToolWithWriteAccess: mockWriteTool,
				addToolWithReadAccess: mockReadTool,
			} as unknown as CustomMcpServer;

			DocumentTools.create(mockClient, mockServer);

			const handler = mockReadTool.mock.calls?.[2]?.[3];
			const result = await handler({ docId: "missing" });

			expect(getTextContent(result)).toBe("Document with ID missing not found.");
		});

		test("should handle errors when getting document by ID", async () => {
			const getDocByIdMock = mock(async () => {
				throw new Error("Get failed");
			});
			const mockClient = createMockClient({ getDocById: getDocByIdMock });
			const mockWriteTool = mock();
			const mockReadTool = mock();
			const mockServer = {
				addToolWithWriteAccess: mockWriteTool,
				addToolWithReadAccess: mockReadTool,
			} as unknown as CustomMcpServer;

			DocumentTools.create(mockClient, mockServer);

			const handler = mockReadTool.mock.calls?.[2]?.[3];
			const result = await handler({ docId: "doc-123" });

			expect(getTextContent(result)).toBe("Failed to get document: Get failed");
		});
	});
});
