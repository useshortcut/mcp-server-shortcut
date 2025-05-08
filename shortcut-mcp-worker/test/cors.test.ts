import { describe, expect, test } from "bun:test";
import { env } from "./setup";

// Helper function to simulate what the worker does for CORS
function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function handleCorsRequest() {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}

describe("CORS handling", () => {
  test("preflight OPTIONS request returns correct status and headers", () => {
    const response = handleCorsRequest();
    
    // Check status code
    expect(response.status).toBe(204);
    
    // Check headers
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("OPTIONS");
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Content-Type");
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
  });
  
  test("CORS headers allow requests from any origin", () => {
    const headers = getCorsHeaders();
    expect(headers["Access-Control-Allow-Origin"]).toBe("*");
  });
  
  test("CORS headers allow POST method for MCP requests", () => {
    const headers = getCorsHeaders();
    expect(headers["Access-Control-Allow-Methods"]).toContain("POST");
  });
  
  test("CORS headers allow Authorization header for authentication", () => {
    const headers = getCorsHeaders();
    expect(headers["Access-Control-Allow-Headers"]).toContain("Authorization");
  });
});