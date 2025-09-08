import { describe, expect, test } from "bun:test";
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
});
