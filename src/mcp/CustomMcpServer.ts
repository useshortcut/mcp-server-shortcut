import {
	McpServer,
	type RegisteredTool,
	type ToolCallback,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { ZodRawShape } from "zod";
import { name, version } from "../../package.json";

export class CustomMcpServer extends McpServer {
	private readonly: boolean;
	private tools: Set<string>;

	constructor({ readonly, tools }: { readonly: boolean; tools: string[] | null | undefined }) {
		super({ name, version });
		this.readonly = readonly;
		this.tools = new Set(tools || []);
	}

	shouldAddTool(name: string) {
		console.log("Checking tool:", name, this.tools.size);
		if (!this.tools.size) return true;
		const [entityType] = name.split("-");
		if (this.tools.has(entityType) || this.tools.has(name)) return true;
		return false;
	}

	// Overloads for addToolWithWriteAccess to match all variants of the base tool() method
	addToolWithWriteAccess(name: string, cb: ToolCallback): RegisteredTool | null;
	addToolWithWriteAccess(
		name: string,
		description: string,
		cb: ToolCallback,
	): RegisteredTool | null;
	addToolWithWriteAccess<Args extends ZodRawShape>(
		name: string,
		paramsSchemaOrAnnotations: Args | ToolAnnotations,
		cb: ToolCallback<Args>,
	): RegisteredTool | null;
	addToolWithWriteAccess<Args extends ZodRawShape>(
		name: string,
		description: string,
		paramsSchemaOrAnnotations: Args | ToolAnnotations,
		cb: ToolCallback<Args>,
	): RegisteredTool | null;
	addToolWithWriteAccess<Args extends ZodRawShape>(
		name: string,
		paramsSchema: Args,
		annotations: ToolAnnotations,
		cb: ToolCallback<Args>,
	): RegisteredTool | null;
	addToolWithWriteAccess<Args extends ZodRawShape>(
		name: string,
		description: string,
		paramsSchema: Args,
		annotations: ToolAnnotations,
		cb: ToolCallback<Args>,
	): RegisteredTool | null;
	addToolWithWriteAccess(...args: any[]): RegisteredTool | null {
		if (this.readonly) return null;
		if (!this.shouldAddTool(args[0])) return null;
		return (super.tool as any)(...args);
	}

	// Overloads for addToolWithReadAccess to match all variants of the base tool() method
	addToolWithReadAccess(name: string, cb: ToolCallback): RegisteredTool | null;
	addToolWithReadAccess(name: string, description: string, cb: ToolCallback): RegisteredTool | null;
	addToolWithReadAccess<Args extends ZodRawShape>(
		name: string,
		paramsSchemaOrAnnotations: Args | ToolAnnotations,
		cb: ToolCallback<Args>,
	): RegisteredTool | null;
	addToolWithReadAccess<Args extends ZodRawShape>(
		name: string,
		description: string,
		paramsSchemaOrAnnotations: Args | ToolAnnotations,
		cb: ToolCallback<Args>,
	): RegisteredTool | null;
	addToolWithReadAccess<Args extends ZodRawShape>(
		name: string,
		paramsSchema: Args,
		annotations: ToolAnnotations,
		cb: ToolCallback<Args>,
	): RegisteredTool | null;
	addToolWithReadAccess<Args extends ZodRawShape>(
		name: string,
		description: string,
		paramsSchema: Args,
		annotations: ToolAnnotations,
		cb: ToolCallback<Args>,
	): RegisteredTool | null;
	addToolWithReadAccess(...args: any[]): RegisteredTool | null {
		if (!this.shouldAddTool(args[0])) return null;
		return (super.tool as any)(...args);
	}

	tool(): never {
		throw new Error("Call addToolWithReadAccess or addToolWithWriteAccess instead.");
	}
}
