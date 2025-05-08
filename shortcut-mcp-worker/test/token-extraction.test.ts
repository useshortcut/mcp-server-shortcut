import { describe, expect, test } from "bun:test";
import { env } from "./setup";

// Simplified version of the token extraction logic for testing
function parseCookies(cookieString: string): Record<string, string> {
  return cookieString
    .split(";")
    .map(pair => pair.trim().split("="))
    .reduce((cookies, [key, value]) => {
      if (key && value) cookies[key] = value;
      return cookies;
    }, {} as Record<string, string>);
}

async function getTokenFromRequest(request: Request): Promise<string | null> {
  // Try Authorization header first (Bearer token)
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  // Try cookies next
  const cookies = parseCookies(request.headers.get("Cookie") || "");
  if (cookies.shortcut_token) {
    return cookies.shortcut_token;
  }

  // Try query parameters last
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token");
  if (queryToken) {
    return queryToken;
  }

  // No token found
  return null;
}

describe("Token Extraction", () => {
  test("should extract Bearer token from Authorization header", async () => {
    const request = new Request("https://example.com/sse", {
      headers: {
        "Authorization": "Bearer test-token"
      }
    });
    
    const token = await getTokenFromRequest(request);
    expect(token).toBe("test-token");
  });
  
  test("should extract token from cookies", async () => {
    const request = new Request("https://example.com/sse", {
      headers: {
        "Cookie": "shortcut_token=cookie-token; other=value"
      }
    });
    
    const token = await getTokenFromRequest(request);
    expect(token).toBe("cookie-token");
  });
  
  test("should extract token from query parameters", async () => {
    const request = new Request("https://example.com/sse?token=query-token");
    
    const token = await getTokenFromRequest(request);
    expect(token).toBe("query-token");
  });
  
  test("should return null when no token is found", async () => {
    const request = new Request("https://example.com/sse");
    
    const token = await getTokenFromRequest(request);
    expect(token).toBeNull();
  });
});