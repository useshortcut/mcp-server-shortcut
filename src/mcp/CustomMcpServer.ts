import { McpServer, type RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	CallToolResult,
	ServerNotification,
	ServerRequest,
	ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js";
import type { infer as ZodInfer, ZodObject, ZodRawShape } from "zod";
import { name, version } from "../../package.json";

// The extra context provided to tool callbacks
type ToolExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

// Simplified callback types that avoid the SDK's complex AnySchema union type
// which includes both Zod v3 and v4 types. Using these simpler types prevents
// TypeScript from doing excessively deep type instantiation that causes OOM.
type NoArgsCallback = (extra: ToolExtra) => CallToolResult | Promise<CallToolResult>;
type WithArgsCallback<Args extends ZodRawShape> = (
	args: ZodInfer<ZodObject<Args>>,
	extra: ToolExtra,
) => CallToolResult | Promise<CallToolResult>;

export class CustomMcpServer extends McpServer {
	private readonly: boolean;
	private tools: Set<string>;

	constructor({ readonly, tools }: { readonly: boolean; tools: string[] | null | undefined }) {
		super({ name, version });
		this.readonly = readonly;
		this.tools = new Set(tools || []);
	}

	shouldAddTool(name: string) {
		if (!this.tools.size) return true;
		// Check exact tool name first
		if (this.tools.has(name)) return true;
		// Check if tool name starts with any configured entity type
		// This handles hyphenated entity types like "custom-fields"
		for (const tool of this.tools) {
			if (name.startsWith(`${tool}-`)) return true;
		}
		return false;
	}

	// Overloads for addToolWithWriteAccess to match all variants of the base tool() method
	addToolWithWriteAccess(name: string, cb: NoArgsCallback): RegisteredTool | null;
	addToolWithWriteAccess(
		name: string,
		description: string,
		cb: NoArgsCallback,
	): RegisteredTool | null;
	addToolWithWriteAccess<Args extends ZodRawShape>(
		name: string,
		paramsSchemaOrAnnotations: Args | ToolAnnotations,
		cb: WithArgsCallback<Args>,
	): RegisteredTool | null;
	addToolWithWriteAccess<Args extends ZodRawShape>(
		name: string,
		description: string,
		paramsSchemaOrAnnotations: Args | ToolAnnotations,
		cb: WithArgsCallback<Args>,
	): RegisteredTool | null;
	addToolWithWriteAccess<Args extends ZodRawShape>(
		name: string,
		paramsSchema: Args,
		annotations: ToolAnnotations,
		cb: WithArgsCallback<Args>,
	): RegisteredTool | null;
	addToolWithWriteAccess<Args extends ZodRawShape>(
		name: string,
		description: string,
		paramsSchema: Args,
		annotations: ToolAnnotations,
		cb: WithArgsCallback<Args>,
	): RegisteredTool | null;
	// biome-ignore lint/suspicious/noExplicitAny: Implementation signature uses any to allow all overload variants
	addToolWithWriteAccess(...args: any[]): RegisteredTool | null {
		if (this.readonly) return null;
		if (!this.shouldAddTool(args[0])) return null;
		// biome-ignore lint/suspicious/noExplicitAny: Delegate to parent with proper type casting
		return (super.tool as any)(...args);
	}

	// Overloads for addToolWithReadAccess to match all variants of the base tool() method
	addToolWithReadAccess(name: string, cb: NoArgsCallback): RegisteredTool | null;
	addToolWithReadAccess(
		name: string,
		description: string,
		cb: NoArgsCallback,
	): RegisteredTool | null;
	addToolWithReadAccess<Args extends ZodRawShape>(
		name: string,
		paramsSchemaOrAnnotations: Args | ToolAnnotations,
		cb: WithArgsCallback<Args>,
	): RegisteredTool | null;
	addToolWithReadAccess<Args extends ZodRawShape>(
		name: string,
		description: string,
		paramsSchemaOrAnnotations: Args | ToolAnnotations,
		cb: WithArgsCallback<Args>,
	): RegisteredTool | null;
	addToolWithReadAccess<Args extends ZodRawShape>(
		name: string,
		paramsSchema: Args,
		annotations: ToolAnnotations,
		cb: WithArgsCallback<Args>,
	): RegisteredTool | null;
	addToolWithReadAccess<Args extends ZodRawShape>(
		name: string,
		description: string,
		paramsSchema: Args,
		annotations: ToolAnnotations,
		cb: WithArgsCallback<Args>,
	): RegisteredTool | null;
	// biome-ignore lint/suspicious/noExplicitAny: Implementation signature uses any to allow all overload variants
	addToolWithReadAccess(...args: any[]): RegisteredTool | null {
		if (!this.shouldAddTool(args[0])) return null;
		// biome-ignore lint/suspicious/noExplicitAny: Delegate to parent with proper type casting
		return (super.tool as any)(...args);
	}

	tool(): never {
		throw new Error("Call addToolWithReadAccess or addToolWithWriteAccess instead.");
	}
}
