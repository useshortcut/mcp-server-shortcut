import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Extracts the text content from the first content item of a CallToolResult.
 * Throws if the content is not of type "text".
 */
export function getTextContent(result: CallToolResult): string {
	const content = result.content[0];

	if (content.type !== "text") {
		throw new Error(`Expected text content but got ${content.type}`);
	}

	return content.text;
}
