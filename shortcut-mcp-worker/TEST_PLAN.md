# Test Plan for Shortcut MCP Cloudflare Worker

This document outlines the testing strategy for the Shortcut MCP Cloudflare Worker implementation.

## Testing Goals

1. Ensure the HTTP+SSE transport layer correctly implements the MCP protocol
2. Verify authentication flows work as expected
3. Confirm tools are properly integrated and accessible via the remote server
4. Test error handling and edge cases

## Test Structure

Tests will be organized into three main categories:

1. **Unit Tests**: Testing individual components in isolation
2. **Integration Tests**: Testing interaction between components
3. **End-to-End Tests**: Testing the full workflow

## Test Environment Setup

```typescript
// test/setup.ts
import { beforeAll, afterAll, afterEach } from "bun:test";
import { makeCloudflareEnv } from "./helpers/cloudflare-env";

// Create a mock environment for tests
let env: ReturnType<typeof makeCloudflareEnv>;

beforeAll(() => {
  env = makeCloudflareEnv({
    SHORTCUT_CLIENT_ID: "test-client-id",
    SHORTCUT_CLIENT_SECRET: "test-client-secret"
  });
});

afterEach(() => {
  // Clean up any mocks or test data
});

afterAll(() => {
  // Cleanup any resources
});

export { env };
```

## Unit Tests

### HTTP+SSE Transport Tests

```typescript
// test/transport/http-sse.test.ts
import { describe, expect, test, mock, spyOn } from "bun:test";
import { HttpSseTransport } from "../../src/transport/http-sse";
import { env } from "../setup";

describe("HttpSseTransport", () => {
  test("should initialize with a request", () => {
    const request = new Request("https://example.com/sse", {
      method: "POST",
      body: JSON.stringify({ request_id: "123", action: "ping" })
    });
    
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
  
  test("should send MCP responses", async () => {
    const request = new Request("https://example.com/sse", {
      method: "POST",
      body: JSON.stringify({ request_id: "123", action: "ping" })
    });
    
    const transport = new HttpSseTransport(request, env);
    const writer = mock(() => ({
      write: mock(() => Promise.resolve()),
      close: mock(() => Promise.resolve())
    }));
    
    // @ts-ignore - Mocking private property
    transport.writer = writer();
    
    await transport.send({ response_id: "123", action: "pong" });
    
    expect(writer().write).toHaveBeenCalled();
  });
  
  test("should format responses as server-sent events", async () => {
    const request = new Request("https://example.com/sse", {
      method: "POST",
      body: JSON.stringify({ request_id: "123", action: "ping" })
    });
    
    const transport = new HttpSseTransport(request, env);
    const response = await transport.getResponse();
    
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
    expect(response.headers.get("Connection")).toBe("keep-alive");
  });
  
  test("should close cleanly", async () => {
    const request = new Request("https://example.com/sse", {
      method: "POST",
      body: JSON.stringify({ request_id: "123", action: "ping" })
    });
    
    const transport = new HttpSseTransport(request, env);
    const writer = mock(() => ({
      write: mock(() => Promise.resolve()),
      close: mock(() => Promise.resolve())
    }));
    
    // @ts-ignore - Mocking private property
    transport.writer = writer();
    
    transport.close();
    
    expect(writer().close).toHaveBeenCalled();
  });
});
```

### Authentication Tests

```typescript
// test/auth.test.ts
import { describe, expect, test, mock, spyOn } from "bun:test";
import { getTokenFromRequest, handleAuth } from "../src/auth";
import { env } from "./setup";

describe("Authentication", () => {
  test("should extract Bearer token from Authorization header", async () => {
    const request = new Request("https://example.com/sse", {
      headers: {
        "Authorization": "Bearer test-token"
      }
    });
    
    const token = await getTokenFromRequest(request, env);
    expect(token).toBe("test-token");
  });
  
  test("should extract token from cookies", async () => {
    const request = new Request("https://example.com/sse", {
      headers: {
        "Cookie": "shortcut_token=cookie-token; other=value"
      }
    });
    
    const token = await getTokenFromRequest(request, env);
    expect(token).toBe("cookie-token");
  });
  
  test("should handle OAuth authorization route", async () => {
    const request = new Request("https://example.com/oauth/authorize");
    
    // Mock the OAuthProvider
    const mockProvider = {
      handleAuthorize: mock(() => new Response())
    };
    
    // Mock the createOAuthProvider function
    const originalCreateProvider = require("../src/auth").createOAuthProvider;
    require("../src/auth").createOAuthProvider = mock(() => mockProvider);
    
    try {
      await handleAuth(request, env);
      expect(mockProvider.handleAuthorize).toHaveBeenCalledWith(request);
    } finally {
      require("../src/auth").createOAuthProvider = originalCreateProvider;
    }
  });
  
  test("should handle OAuth callback route", async () => {
    const request = new Request("https://example.com/oauth/callback");
    
    // Mock the OAuthProvider
    const mockProvider = {
      handleCallback: mock(() => new Response())
    };
    
    // Mock the createOAuthProvider function
    const originalCreateProvider = require("../src/auth").createOAuthProvider;
    require("../src/auth").createOAuthProvider = mock(() => mockProvider);
    
    try {
      await handleAuth(request, env);
      expect(mockProvider.handleCallback).toHaveBeenCalledWith(request);
    } finally {
      require("../src/auth").createOAuthProvider = originalCreateProvider;
    }
  });
});
```

## Integration Tests

### Worker Request Handler Tests

```typescript
// test/index.test.ts
import { describe, expect, test, mock, spyOn } from "bun:test";
import { default as worker } from "../src/index";
import { env } from "./setup";

describe("Worker Request Handler", () => {
  test("should handle OPTIONS requests with CORS headers", async () => {
    const request = new Request("https://example.com/", {
      method: "OPTIONS"
    });
    
    const response = await worker.fetch(request, env, {
      waitUntil: mock(() => {})
    });
    
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
  
  test("should delegate OAuth routes to auth handler", async () => {
    const request = new Request("https://example.com/oauth/authorize");
    
    // Mock the auth handler
    const originalHandleAuth = require("../src/auth").handleAuth;
    const mockHandleAuth = mock(() => new Response("Auth handled"));
    require("../src/auth").handleAuth = mockHandleAuth;
    
    try {
      const response = await worker.fetch(request, env, {
        waitUntil: mock(() => {})
      });
      
      expect(mockHandleAuth).toHaveBeenCalled();
    } finally {
      require("../src/auth").handleAuth = originalHandleAuth;
    }
  });
  
  test("should handle SSE routes with valid tokens", async () => {
    const request = new Request("https://example.com/sse", {
      method: "POST",
      headers: {
        "Authorization": "Bearer test-token"
      },
      body: JSON.stringify({ request_id: "123", action: "ping" })
    });
    
    // Mock token validation
    const originalGetToken = require("../src/auth").getTokenFromRequest;
    require("../src/auth").getTokenFromRequest = mock(() => "test-token");
    
    // Mock HttpSseTransport
    const originalTransport = require("../src/transport/http-sse").HttpSseTransport;
    const mockTransport = mock(() => ({
      getResponse: mock(() => new Response("SSE response")),
      // Other methods would be mocked as needed
    }));
    require("../src/transport/http-sse").HttpSseTransport = mockTransport;
    
    try {
      const response = await worker.fetch(request, env, {
        waitUntil: mock(() => {})
      });
      
      expect(mockTransport).toHaveBeenCalled();
      expect(mockTransport().getResponse).toHaveBeenCalled();
    } finally {
      require("../src/auth").getTokenFromRequest = originalGetToken;
      require("../src/transport/http-sse").HttpSseTransport = originalTransport;
    }
  });
  
  test("should return 401 for SSE routes without valid tokens", async () => {
    const request = new Request("https://example.com/sse", {
      method: "POST",
      body: JSON.stringify({ request_id: "123", action: "ping" })
    });
    
    // Mock token validation to return null
    const originalGetToken = require("../src/auth").getTokenFromRequest;
    require("../src/auth").getTokenFromRequest = mock(() => null);
    
    try {
      const response = await worker.fetch(request, env, {
        waitUntil: mock(() => {})
      });
      
      expect(response.status).toBe(401);
    } finally {
      require("../src/auth").getTokenFromRequest = originalGetToken;
    }
  });
  
  test("should return home page for root path", async () => {
    const request = new Request("https://example.com/");
    
    const response = await worker.fetch(request, env, {
      waitUntil: mock(() => {})
    });
    
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    
    const text = await response.text();
    expect(text).toContain("Shortcut MCP Server");
  });
  
  test("should return 404 for unknown routes", async () => {
    const request = new Request("https://example.com/unknown-path");
    
    const response = await worker.fetch(request, env, {
      waitUntil: mock(() => {})
    });
    
    expect(response.status).toBe(404);
  });
});
```

## End-to-End Tests

End-to-end tests would simulate a complete interaction with the MCP server, including:

1. Authentication
2. Tool registration
3. Making MCP requests
4. Receiving MCP responses

These tests could be implemented using a combination of:

1. A test MCP client
2. Mocked Shortcut API responses
3. A local worker runtime environment

## Mock Helpers

```typescript
// test/helpers/cloudflare-env.ts
export function makeCloudflareEnv(vars = {}) {
  return {
    ...vars,
    // Add any other environment bindings needed
  };
}

// test/helpers/shortcut-mock.ts
export function mockShortcutClient() {
  return {
    getCurrentMemberInfo: mock(() => ({
      data: {
        id: "user1",
        mention_name: "testuser",
        name: "Test User",
      }
    })),
    // Add other methods as needed
  };
}
```

## Test Configuration

Add the following to your package.json:

```json
{
  "scripts": {
    "test": "bun test",
    "test:watch": "bun test --watch"
  }
}
```

## Testing OAuth in Isolation

Since OAuth is challenging to test in automated tests, consider creating a separate manual test suite or a dedicated test mode that bypasses OAuth for automated testing.

## CI/CD Integration

For GitHub Actions, create a workflow file:

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: oven-sh/setup-bun@v1
      - name: Install dependencies
        run: bun install
      - name: Run tests
        run: bun test
```

## Test Coverage

Add coverage reporting to your tests:

```json
{
  "scripts": {
    "test": "bun test --coverage"
  }
}
```

This comprehensive test plan will help ensure that your Cloudflare Worker implementation is robust and reliable.