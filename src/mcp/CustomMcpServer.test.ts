import { describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { BearerAuthError } from "../http-auth";
import { CustomMcpServer } from "./CustomMcpServer";

describe("CustomMcpServer", () => {
	test("should allow read only tools when readonly is true", () => {
		const server = new CustomMcpServer({ readonly: true, tools: null });
		expect(
			server.addToolWithReadAccess("test", "test", async () => {
				return { content: [] };
			}),
		).not.toBeNull();
	});

	test("should not allow write tools when readonly is true", () => {
		const server = new CustomMcpServer({ readonly: true, tools: null });
		expect(
			server.addToolWithWriteAccess("test", "test", async () => {
				return { content: [] };
			}),
		).toBeNull();
	});

	test("should allow write tools when readonly is false", () => {
		const server = new CustomMcpServer({ readonly: false, tools: null });
		expect(
			server.addToolWithWriteAccess("test", "test", async () => {
				return { content: [] };
			}),
		).not.toBeNull();
	});

	test("should only allow tools in the tools list", () => {
		const server = new CustomMcpServer({ readonly: false, tools: ["test"] });
		expect(
			server.addToolWithReadAccess("test", "test", async () => {
				return { content: [] };
			}),
		).not.toBeNull();
		expect(
			server.addToolWithReadAccess("test-sub-tool", "test", async () => {
				return { content: [] };
			}),
		).not.toBeNull();
		expect(
			server.addToolWithReadAccess("test2", "test", async () => {
				return { content: [] };
			}),
		).toBeNull();
	});

	test("should handle hyphenated entity types like custom-fields", () => {
		const server = new CustomMcpServer({ readonly: false, tools: ["custom-fields"] });
		expect(
			server.addToolWithReadAccess("custom-fields-list", "test", async () => {
				return { content: [] };
			}),
		).not.toBeNull();
		expect(
			server.addToolWithReadAccess("custom-other", "test", async () => {
				return { content: [] };
			}),
		).toBeNull();
		expect(
			server.addToolWithReadAccess("stories-get-by-id", "test", async () => {
				return { content: [] };
			}),
		).toBeNull();
	});

	test("adds a default title to discovered tools", async () => {
		const server = new CustomMcpServer({ readonly: false, tools: null });
		server.addToolWithReadAccess("stories-get-by-id", "test", async () => {
			return { content: [] };
		});

		const client = new Client({
			name: "test-client",
			version: "1.0.0",
		});
		const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

		await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

		const { tools } = await client.listTools();
		expect(tools).toContainEqual(
			expect.objectContaining({
				name: "stories-get-by-id",
				title: "Stories: Get By ID",
			}),
		);
	});

	test("adds default annotations to read tools", async () => {
		const server = new CustomMcpServer({ readonly: false, tools: null });
		server.addToolWithReadAccess("stories-search", "test", async () => {
			return { content: [] };
		});

		const client = new Client({
			name: "test-client",
			version: "1.0.0",
		});
		const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

		await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

		const { tools } = await client.listTools();
		expect(tools).toContainEqual(
			expect.objectContaining({
				name: "stories-search",
				annotations: expect.objectContaining({
					readOnlyHint: true,
					idempotentHint: true,
					destructiveHint: false,
					openWorldHint: false,
				}),
			}),
		);
	});

	test("marks delete and remove write tools as destructive", async () => {
		const server = new CustomMcpServer({ readonly: false, tools: null });
		server.addToolWithWriteAccess("stories-remove-subtask", "test", async () => {
			return { content: [] };
		});

		const client = new Client({
			name: "test-client",
			version: "1.0.0",
		});
		const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

		await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

		const { tools } = await client.listTools();
		expect(tools).toContainEqual(
			expect.objectContaining({
				name: "stories-remove-subtask",
				annotations: expect.objectContaining({
					readOnlyHint: false,
					idempotentHint: false,
					destructiveHint: true,
					openWorldHint: false,
				}),
			}),
		);
	});

	test("surfaces bearer auth failures as structured MCP errors", async () => {
		const server = new CustomMcpServer({ readonly: false, tools: null });
		server.addToolWithReadAccess("test-auth", "test", async () => {
			throw new BearerAuthError({
				error: "invalid_token",
				errorDescription: "The access token expired",
				headerValue: 'Bearer error="invalid_token", error_description="The access token expired"',
				tokenExpired: true,
			});
		});

		const client = new Client({
			name: "test-client",
			version: "1.0.0",
		});
		const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

		await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

		try {
			await client.callTool({
				name: "test-auth",
			});
			throw new Error("Expected tool call to fail");
		} catch (error) {
			expect(error).toMatchObject({
				code: 401,
				data: {
					httpStatus: 401,
					headers: {
						"WWW-Authenticate":
							'Bearer error="invalid_token", error_description="The access token expired"',
					},
					body: {
						error: "invalid_token",
						error_description: "The access token expired",
					},
					isAuthenticationError: true,
					tokenExpired: true,
				},
			});
		}
	});
});
