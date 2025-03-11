import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ShortcutClient } from "../shortcut-client";

export class BaseTools {
	constructor(protected client: ShortcutClient) {}

	protected toResult(content: string): CallToolResult {
		return { content: [{ type: "text", text: content }] };
	}
}
