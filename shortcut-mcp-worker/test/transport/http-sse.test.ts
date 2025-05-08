import { describe, expect, test, mock, beforeEach } from "bun:test";
import { HttpSseTransport } from "../../src/transport/http-sse";
import { env } from "../setup";

describe("HttpSseTransport", () => {
  let request: Request;
  
  beforeEach(() => {
    // Create a fresh request for each test
    request = new Request("https://example.com/sse", {
      method: "POST",
      body: JSON.stringify({ request_id: "123", action: "ping" })
    });
  });

  test("should initialize with a request", () => {
    const transport = new HttpSseTransport(request, env);
    expect(transport).toBeDefined();
  });
  
  test("should receive MCP requests", async () => {
    const mcpRequest = { request_id: "123", action: "ping" };
    const request = new Request("https://example.com/sse", {
      method: "POST",
      body: JSON.stringify(mcpRequest)
    });
    
    const transport = new HttpSseTransport(request, env);
    const receivedRequest = await transport.receive();
    
    expect(receivedRequest).toEqual(mcpRequest);
  });
  
  test("should format responses as server-sent events", async () => {
    const transport = new HttpSseTransport(request, env);
    const response = await transport.getResponse();
    
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
    expect(response.headers.get("Connection")).toBe("keep-alive");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
  
  test("should throw error when writer not initialized", async () => {
    const transport = new HttpSseTransport(request, env);
    
    // Replace the writer with null to simulate uninitialized state
    Object.defineProperty(transport, "writer", {
      value: null,
      writable: true
    });
    
    try {
      await transport.send({ response_id: "123", action: "pong" });
      expect.fail("Expected to throw an error");
    } catch (error) {
      expect(error.message).toBe("Writer not initialized");
    }
  });
  
  test("should throw error when requestPromise not initialized", async () => {
    const transport = new HttpSseTransport(request, env);
    
    // Replace the requestPromise with null to simulate uninitialized state
    Object.defineProperty(transport, "requestPromise", {
      value: null,
      writable: true
    });
    
    try {
      await transport.receive();
      expect.fail("Expected to throw an error");
    } catch (error) {
      expect(error.message).toBe("Request not initialized");
    }
  });

  test("should throw error when responseStream not initialized", async () => {
    const transport = new HttpSseTransport(request, env);
    
    // Replace the responseStream with null to simulate uninitialized state
    Object.defineProperty(transport, "responseStream", {
      value: null,
      writable: true
    });
    
    try {
      await transport.getResponse();
      expect.fail("Expected to throw an error");
    } catch (error) {
      expect(error.message).toBe("Response stream not initialized");
    }
  });
});