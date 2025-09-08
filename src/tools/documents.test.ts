import { describe, expect, mock, test } from "bun:test";
import type { DocSlim } from "@shortcut/client";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { CustomMcpServer } from "@/mcp/CustomMcpServer";
import { DocumentTools } from "./documents";

describe("DocumentTools", () => {
	const mockDoc = {
		id: "doc-123",
		title: "Test Document",
		app_url: "https://app.shortcut.com/workspace/write/doc-123",
	} satisfies DocSlim;

	const createMockClient = (methods = {}) =>
		({
			createDoc: mock(async () => mockDoc),
			...methods,
		}) as unknown as ShortcutClientWrapper;

	describe("create method", () => {
		test("should register the create-document tool with the server", () => {
			const mockClient = createMockClient();
			const mockTool = mock();
			const mockServer = { addToolWithWriteAccess: mockTool } as unknown as CustomMcpServer;

			DocumentTools.create(mockClient, mockServer);

			expect(mockTool).toHaveBeenCalledTimes(1);
			expect(mockTool.mock.calls?.[0]?.[0]).toBe("documents-create");
			expect(mockTool.mock.calls?.[0]?.[1]).toBe(
				"Create a new document in Shortcut with a title and content. Returns the document's id, title, and app_url. Note: Use HTML markup for the content (e.g., <p>, <h1>, <ul>, <strong>) rather than Markdown.",
			);
		});
	});

	describe("tool handler", () => {
		test("should successfully create a document", async () => {
			const createDocMock = mock(async () => mockDoc);
			const mockClient = createMockClient({ createDoc: createDocMock });
			const mockTool = mock();
			const mockServer = { addToolWithWriteAccess: mockTool } as unknown as CustomMcpServer;

			DocumentTools.create(mockClient, mockServer);

			// Get the handler from the registration call
			const handler = mockTool.mock.calls?.[0]?.[3];
			const result = await handler({ title: "Test Document", content: "Test content" });

			expect(createDocMock).toHaveBeenCalledWith({
				title: "Test Document",
				content: "Test content",
			});

			expect(result.content[0].text).toContain("Document created successfully");
			expect(result.content[0].text).toContain('"id": "doc-123"');
			expect(result.content[0].text).toContain('"title": "Test Document"');
			expect(result.content[0].text).toContain(
				'"app_url": "https://app.shortcut.com/workspace/write/doc-123"',
			);
		});

		test("should handle errors when document creation fails", async () => {
			const errorMessage = "API error: Unauthorized";
			const createDocMock = mock(async () => {
				throw new Error(errorMessage);
			});
			const mockClient = createMockClient({ createDoc: createDocMock });
			const mockTool = mock();
			const mockServer = { addToolWithWriteAccess: mockTool } as unknown as CustomMcpServer;

			DocumentTools.create(mockClient, mockServer);

			// Get the handler from the registration call
			const handler = mockTool.mock.calls?.[0]?.[3];
			const result = await handler({ title: "Test Document", content: "Test content" });

			expect(createDocMock).toHaveBeenCalledWith({
				title: "Test Document",
				content: "Test content",
			});

			expect(result.content[0].text).toBe(`Failed to create document: ${errorMessage}`);
		});

		test("should handle non-Error exceptions", async () => {
			const createDocMock = mock(async () => {
				throw "Some string error";
			});
			const mockClient = createMockClient({ createDoc: createDocMock });
			const mockTool = mock();
			const mockServer = { addToolWithWriteAccess: mockTool } as unknown as CustomMcpServer;

			DocumentTools.create(mockClient, mockServer);

			// Get the handler from the registration call
			const handler = mockTool.mock.calls?.[0]?.[3];
			const result = await handler({ title: "Test Document", content: "Test content" });

			expect(result.content[0].text).toBe("Failed to create document: Unknown error");
		});

		test("should enforce title length constraint", async () => {
			const mockClient = createMockClient();
			const mockTool = mock();
			const mockServer = { addToolWithWriteAccess: mockTool } as unknown as CustomMcpServer;

			DocumentTools.create(mockClient, mockServer);

			// Get the schema from the registration call
			const schema = mockTool.mock.calls?.[0]?.[2];
			expect(schema.title.maxLength).toBe(256);
		});
	});
});
