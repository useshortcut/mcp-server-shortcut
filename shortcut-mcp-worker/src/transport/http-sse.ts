import type { McpServerTransport } from "@modelcontextprotocol/sdk/server/transport.js";
import type { McpRequest, McpResponse } from "@modelcontextprotocol/sdk/server/types.js";

export class HttpSseTransport implements McpServerTransport {
	private controller = new AbortController();
	private responseStream: ReadableStream | null = null;
	private writer: WritableStreamDefaultWriter | null = null;
	private requestPromise: Promise<McpRequest> | null = null;

	constructor(
		private request: Request,
		private env: Record<string, unknown>,
	) {
		this.setupStream();
		this.requestPromise = this.parseRequest();
	}

	private setupStream() {
		const { readable, writable } = new TransformStream();
		this.responseStream = readable;
		this.writer = writable.getWriter();
	}

	private async parseRequest(): Promise<McpRequest> {
		try {
			const body = await this.request.json();
			return body as McpRequest;
		} catch (error) {
			console.error("Failed to parse request:", error);
			throw new Error(`Invalid MCP request: ${error.message}`);
		}
	}

	async receive(): Promise<McpRequest> {
		if (!this.requestPromise) {
			throw new Error("Request not initialized");
		}
		return this.requestPromise;
	}

	async send(response: McpResponse): Promise<void> {
		if (!this.writer) {
			throw new Error("Writer not initialized");
		}

		const encoder = new TextEncoder();
		const data = `data: ${JSON.stringify(response)}\n\n`;
		await this.writer.write(encoder.encode(data));
	}

	async getResponse(): Promise<Response> {
		if (!this.responseStream) {
			throw new Error("Response stream not initialized");
		}

		return new Response(this.responseStream, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "POST, OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type, Authorization",
			},
		});
	}

	close(): void {
		this.controller.abort();
		if (this.writer) {
			this.writer.close().catch((err) => {
				console.error("Error closing writer:", err);
			});
		}
	}
}
