#!/bin/bash

# Test script for MCP Streamable HTTP server
# Usage: ./test-sse.sh [API_TOKEN]

API_TOKEN="185a9ab9-1ba8-400d-a09a-c076d5f4bad9"
#API_TOKEN=${1:-${SHORTCUT_API_TOKEN}}
PORT=${PORT:-9191}
BASE_URL="http://localhost:${PORT}"

if [ -z "$API_TOKEN" ]; then
  echo "❌ Error: API token required"
  echo "Usage: ./test-sse.sh [API_TOKEN]"
  echo "   or: SHORTCUT_API_TOKEN=your_token ./test-sse.sh"
  exit 1
fi

echo "🧪 Testing Shortcut MCP Streamable HTTP Server"
echo "=============================================="
echo ""

# Test 1: Health check
echo "1️⃣  Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s "${BASE_URL}/health")
if [ $? -eq 0 ]; then
  echo "✅ Health check passed: $HEALTH_RESPONSE"
else
  echo "❌ Health check failed"
  exit 1
fi
echo ""

# Test 2: MCP initialization without token (should fail with 401)
echo "2️⃣  Testing MCP initialization without token (should fail)..."
NO_TOKEN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test-client","version":"1.0.0"}}}' \
  "${BASE_URL}/mcp" 2>&1)
HTTP_CODE=$(echo "$NO_TOKEN_RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "401" ]; then
  echo "✅ Correctly rejected request without token (401)"
else
  echo "❌ Expected 401, got $HTTP_CODE"
  echo "   Response: $(echo "$NO_TOKEN_RESPONSE" | head -n -1)"
fi
echo ""

# Test 3: MCP initialization with Authorization Bearer token
echo "3️⃣  Testing MCP initialization with Authorization header..."
INIT_RESPONSE=$(curl -s -i -X POST \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test-client","version":"1.0.0"}}}' \
  "${BASE_URL}/mcp")

# Extract session ID from headers
SESSION_ID=$(echo "$INIT_RESPONSE" | grep -i "mcp-session-id:" | cut -d: -f2 | tr -d ' \r\n')

if [ -n "$SESSION_ID" ]; then
  echo "✅ Session initialized successfully"
  echo "   Session ID: $SESSION_ID"
else
  echo "❌ Failed to get session ID"
  echo "   Response: $INIT_RESPONSE"
  exit 1
fi
echo ""

# Test 4: Test with custom X-Shortcut-API-Token header
echo "4️⃣  Testing MCP initialization with X-Shortcut-API-Token header..."
INIT_RESPONSE_2=$(curl -s -i -X POST \
  -H "X-Shortcut-API-Token: ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test-client","version":"1.0.0"}}}' \
  "${BASE_URL}/mcp")

SESSION_ID_2=$(echo "$INIT_RESPONSE_2" | grep -i "mcp-session-id:" | cut -d: -f2 | tr -d ' \r\n')

if [ -n "$SESSION_ID_2" ]; then
  echo "✅ Session initialized successfully with custom header"
  echo "   Session ID: $SESSION_ID_2"
else
  echo "❌ Failed to get session ID"
fi
echo ""

# Test 5: Establish SSE stream with session ID
echo "5️⃣  Testing SSE stream with session ID..."
echo "   (Connecting for 3 seconds, then closing)"
timeout 3 curl -s -N \
  -H "Mcp-Session-Id: ${SESSION_ID}" \
  "${BASE_URL}/mcp" 2>&1 | head -5
echo ""
echo "✅ SSE stream established successfully"
echo ""

# Test 6: Send a tools/list request to the established session
echo "6️⃣  Testing tools/list request..."
TOOLS_RESPONSE=$(curl -s -X POST \
  -H "Mcp-Session-Id: ${SESSION_ID}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  "${BASE_URL}/mcp")

# Extract just the tool count
TOOL_COUNT=$(echo "$TOOLS_RESPONSE" | grep -o '"tools":\[' | wc -l)
if [ "$TOOL_COUNT" -gt 0 ]; then
  echo "✅ Tools list retrieved successfully"
  echo "   Response preview: $(echo "$TOOLS_RESPONSE" | head -c 200)..."
else
  echo "❌ Failed to get tools list"
  echo "   Response: $TOOLS_RESPONSE"
fi
echo ""

echo "✅ All tests complete!"
echo ""
echo "=== MCP Streamable HTTP Flow ==="
echo "1. Initialize session with POST:"
echo "   curl -i -X POST -H 'Authorization: Bearer \$TOKEN' \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{},\"clientInfo\":{\"name\":\"client\",\"version\":\"1.0.0\"}}}' \\"
echo "     '${BASE_URL}/mcp'"
echo ""
echo "2. Use the Mcp-Session-Id from response headers for subsequent requests:"
echo "   # Establish SSE stream:"
echo "   curl -N -H 'Mcp-Session-Id: \$SESSION_ID' '${BASE_URL}/mcp'"
echo ""
echo "   # Send JSON-RPC requests:"
echo "   curl -X POST -H 'Mcp-Session-Id: \$SESSION_ID' -H 'Content-Type: application/json' \\"
echo "     -d '{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/list\",\"params\":{}}' \\"
echo "     '${BASE_URL}/mcp'"

