import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export class BaseTools {
	constructor(protected client: ShortcutClientWrapper) {}

	protected toResult(content: string): CallToolResult {
		return { content: [{ type: "text", text: content }] };
	}
}
