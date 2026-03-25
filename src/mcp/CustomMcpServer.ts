import { McpServer, type RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	CallToolRequest,
	CallToolResult,
	ServerNotification,
	ServerRequest,
	ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js";
import { CallToolRequestSchema, ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import type { infer as ZodInfer, ZodObject, ZodRawShape } from "zod";
import { name, version } from "../../package.json";
import { BearerAuthError } from "../http-auth";

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
type ToolAccess = "read" | "write";
type AnyArgsCallback = (
	input: unknown,
	extra: ToolExtra,
) => CallToolResult | Promise<CallToolResult>;
type ToolConfig = {
	title: string;
	description?: string;
	inputSchema?: ZodRawShape;
	annotations?: ToolAnnotations;
};
type ParsedToolRegistration = {
	name: string;
	config: ToolConfig;
	cb: NoArgsCallback | AnyArgsCallback;
	hasInputSchema: boolean;
};

export class CustomMcpServer extends McpServer {
	private readonly: boolean;
	private tools: Set<string>;
	private authAwareToolHandlerInstalled = false;
	private static readonly toolAnnotationKeys = new Set([
		"title",
		"readOnlyHint",
		"destructiveHint",
		"idempotentHint",
		"openWorldHint",
	]);

	constructor({ readonly, tools }: { readonly: boolean; tools: string[] | null | undefined }) {
		super({ name, version });
		this.readonly = readonly;
		this.tools = new Set(tools || []);
		// The SDK's tool error handling flattens all tool exceptions into plain text.
		// Patch the instance method so auth failures can stay structured for clients.
		// biome-ignore lint/suspicious/noExplicitAny: overriding SDK internals for auth error passthrough
		(this as any).setToolRequestHandlers = () => {
			this.installAuthAwareToolHandlers();
		};
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

	private buildDefaultToolTitle(name: string): string {
		const [entity, ...actionParts] = name.split("-");
		const titleCase = (part: string) => {
			const upperCaseWords = new Set(["id", "ids", "pr", "prs", "url", "urls", "api"]);
			return upperCaseWords.has(part)
				? part.toUpperCase()
				: `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`;
		};
		const entityTitle = titleCase(entity ?? name);
		if (!actionParts.length) return entityTitle;
		return `${entityTitle}: ${actionParts.map(titleCase).join(" ")}`;
	}

	private isToolAnnotations(value: unknown): value is ToolAnnotations {
		if (!value || typeof value !== "object" || Array.isArray(value)) return false;
		const keys = Object.keys(value);
		return keys.length > 0 && keys.every((key) => CustomMcpServer.toolAnnotationKeys.has(key));
	}

	private defaultToolAnnotations(access: ToolAccess, name: string): ToolAnnotations {
		const isDestructiveWrite =
			access === "write" &&
			(name.includes("-delete") ||
				name.includes("-remove") ||
				name.includes("-archive") ||
				name.includes("-purge"));
		if (access === "read") {
			return {
				readOnlyHint: true,
				idempotentHint: true,
				destructiveHint: false,
				openWorldHint: false,
			};
		}
		return {
			readOnlyHint: false,
			idempotentHint: false,
			destructiveHint: isDestructiveWrite,
			openWorldHint: false,
		};
	}

	private parseToolRegistration(access: ToolAccess, args: unknown[]): ParsedToolRegistration {
		const [name] = args;
		if (typeof name !== "string" || args.length < 2) {
			throw new Error("Invalid tool registration arguments.");
		}

		const config: ToolConfig = {
			title: this.buildDefaultToolTitle(name),
			annotations: this.defaultToolAnnotations(access, name),
		};

		const setAnnotations = (annotations: ToolAnnotations | undefined) => {
			if (!annotations) return;
			config.annotations = {
				...config.annotations,
				...annotations,
			};
			config.title = annotations.title ?? config.title;
		};

		switch (args.length) {
			case 2:
				return {
					name,
					config,
					cb: args[1] as NoArgsCallback,
					hasInputSchema: false,
				};
			case 3:
				if (typeof args[1] === "string") {
					config.description = args[1] as string;
					return {
						name,
						config,
						cb: args[2] as NoArgsCallback,
						hasInputSchema: false,
					};
				}
				if (this.isToolAnnotations(args[1])) {
					setAnnotations(args[1]);
					return {
						name,
						config,
						cb: args[2] as NoArgsCallback,
						hasInputSchema: false,
					};
				}
				config.inputSchema = args[1] as ZodRawShape;
				return {
					name,
					config,
					cb: args[2] as AnyArgsCallback,
					hasInputSchema: true,
				};
			case 4:
				if (typeof args[1] === "string") {
					config.description = args[1] as string;
					if (this.isToolAnnotations(args[2])) {
						setAnnotations(args[2]);
						return {
							name,
							config,
							cb: args[3] as NoArgsCallback,
							hasInputSchema: false,
						};
					}
					config.inputSchema = args[2] as ZodRawShape;
					return {
						name,
						config,
						cb: args[3] as AnyArgsCallback,
						hasInputSchema: true,
					};
				}
				config.inputSchema = args[1] as ZodRawShape;
				setAnnotations(args[2] as ToolAnnotations);
				return {
					name,
					config,
					cb: args[3] as AnyArgsCallback,
					hasInputSchema: true,
				};
			case 5:
				config.description = args[1] as string;
				config.inputSchema = args[2] as ZodRawShape;
				setAnnotations(args[3] as ToolAnnotations);
				return {
					name,
					config,
					cb: args[4] as AnyArgsCallback,
					hasInputSchema: true,
				};
			default:
				throw new Error("Unsupported tool registration arguments.");
		}
	}

	private registerToolWithAccess(access: ToolAccess, ...args: unknown[]): RegisteredTool | null {
		const { name, config, cb, hasInputSchema } = this.parseToolRegistration(access, args);
		// biome-ignore lint/suspicious/noExplicitAny: Delegate to SDK registerTool with a normalized config object
		return (McpServer.prototype as any).registerTool.call(
			this,
			name,
			config,
			hasInputSchema
				? async (input: unknown, extra: ToolExtra) => await (cb as AnyArgsCallback)(input, extra)
				: async (_input: unknown, extra: ToolExtra) => await (cb as NoArgsCallback)(extra),
		);
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
		return this.registerToolWithAccess("write", ...args);
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
		return this.registerToolWithAccess("read", ...args);
	}

	/**
	 * Replaces the SDK's default tool handler wiring so bearer-token failures can
	 * bubble out as structured MCP errors when they happen after HTTP preflight.
	 * In the normal case, preflight auth should already have returned a real 401.
	 */
	private installAuthAwareToolHandlers(): void {
		// biome-ignore lint/suspicious/noExplicitAny: calling the original SDK implementation by prototype
		(McpServer.prototype as any).setToolRequestHandlers.call(this);
		if (this.authAwareToolHandlerInstalled) {
			return;
		}

		this.authAwareToolHandlerInstalled = true;
		this.server.setRequestHandler(
			CallToolRequestSchema,
			async (request: CallToolRequest, extra: ToolExtra) => {
				try {
					// biome-ignore lint/suspicious/noExplicitAny: accessing SDK internals to customize tool errors
					const tool = (this as any)._registeredTools[request.params.name];
					if (!tool) {
						throw new McpError(ErrorCode.InvalidParams, `Tool ${request.params.name} not found`);
					}
					if (!tool.enabled) {
						throw new McpError(ErrorCode.InvalidParams, `Tool ${request.params.name} disabled`);
					}

					const isTaskRequest = !!request.params.task;
					const taskSupport = tool.execution?.taskSupport;
					const isTaskHandler = "createTask" in tool.handler;
					if ((taskSupport === "required" || taskSupport === "optional") && !isTaskHandler) {
						throw new McpError(
							ErrorCode.InternalError,
							`Tool ${request.params.name} has taskSupport '${taskSupport}' but was not registered with registerToolTask`,
						);
					}
					if (taskSupport === "required" && !isTaskRequest) {
						throw new McpError(
							ErrorCode.MethodNotFound,
							`Tool ${request.params.name} requires task augmentation (taskSupport: 'required')`,
						);
					}
					if (taskSupport === "optional" && !isTaskRequest && isTaskHandler) {
						// biome-ignore lint/suspicious/noExplicitAny: accessing SDK internals to customize tool errors
						return await (this as any).handleAutomaticTaskPolling(tool, request, extra);
					}

					// biome-ignore lint/suspicious/noExplicitAny: accessing SDK internals to customize tool errors
					const args = await (this as any).validateToolInput(
						tool,
						request.params.arguments,
						request.params.name,
					);
					// biome-ignore lint/suspicious/noExplicitAny: accessing SDK internals to customize tool errors
					const result = await (this as any).executeToolHandler(tool, args, extra);
					if (isTaskRequest) {
						return result;
					}
					// biome-ignore lint/suspicious/noExplicitAny: accessing SDK internals to customize tool errors
					await (this as any).validateToolOutput(tool, result, request.params.name);
					return result;
				} catch (error) {
					if (error instanceof BearerAuthError) {
						// Fallback only: request-bound token preflight should handle most
						// invalid/expired bearer tokens before tool execution begins.
						throw new McpError(error.code, "Unauthorized", error.data);
					}
					if (error instanceof McpError && error.code === ErrorCode.UrlElicitationRequired) {
						throw error;
					}
					// biome-ignore lint/suspicious/noExplicitAny: accessing SDK internals to customize tool errors
					return (this as any).createToolError(
						error instanceof Error ? error.message : String(error),
					);
				}
			},
		);
	}

	tool(): never {
		throw new Error("Call addToolWithReadAccess or addToolWithWriteAccess instead.");
	}
}
