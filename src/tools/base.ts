import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ShortcutClientWrapper } from "@/client/shortcut";

export class BaseTools {
	constructor(protected client: ShortcutClientWrapper) {}

	protected toResult(content: string): CallToolResult {
		return { content: [{ type: "text", text: content }] };
	}
}
