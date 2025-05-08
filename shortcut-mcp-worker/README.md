# Shortcut MCP Worker

A Cloudflare Worker implementation of the Shortcut MCP (Model Context Protocol) Server, allowing AI assistants to interact with Shortcut's project management tools.

## Features

- Remote HTTP+SSE transport for MCP
- OAuth authentication with Shortcut
- Full support for all Shortcut MCP tools
- Easy deployment to Cloudflare's edge network

## Setup

### Prerequisites

1. Node.js and npm installed
2. A Cloudflare account
3. wrangler CLI installed (`npm install -g wrangler`)
4. A Shortcut OAuth application (created at https://app.shortcut.com/settings/api-applications)

### Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your environment variables:
   - Create or edit the `.dev.vars` file with your Shortcut OAuth credentials:
     ```
     SHORTCUT_CLIENT_ID="your_client_id"
     SHORTCUT_CLIENT_SECRET="your_client_secret"
     ```

### Development

Run the development server:

```bash
npm run dev
```

This will start a local server at http://localhost:8787 where you can test your MCP server.

### Deployment

Deploy to Cloudflare Workers:

```bash
npm run deploy
```

After deployment, configure your environment variables in the Cloudflare dashboard or using the wrangler CLI:

```bash
wrangler secret put SHORTCUT_CLIENT_ID
wrangler secret put SHORTCUT_CLIENT_SECRET
```

### Testing

The project includes a comprehensive test suite using Bun's built-in testing framework. Tests focus on:

1. **HTTP+SSE Transport**: Verifying the transport layer correctly handles MCP protocol requests and responses
2. **Token Extraction**: Ensuring auth tokens are correctly extracted from various sources
3. **Worker Behavior**: Testing core worker functionality

Run the tests with:

```bash
# Run all tests
bun test

# Run tests and watch for changes
bun test --watch

# Run specific test files
bun test test/transport/http-sse.test.ts
```

## Client Configuration

### Claude Code

Add the following to your `~/.claude.json` file:

```json
{
  "projects": {
    "mcpServers": {
      "shortcut": {
        "mcpUrl": "https://your-worker-url.workers.dev/sse"
      }
    }
  }
}
```

### Cursor

Add the following to your `~/.cursor/mcp.json` or `<project-root>/.cursor/mcp.json` file:

```json
{
  "mcpServers": {
    "shortcut": {
      "mcpUrl": "https://your-worker-url.workers.dev/sse"
    }
  }
}
```

### Windsurf

Add the following to your Windsurf MCP configuration:

```json
{
  "mcpServers": {
    "shortcut": {
      "mcpUrl": "https://your-worker-url.workers.dev/sse"
    }
  }
}
```

## Troubleshooting

- If you encounter authentication issues, ensure your OAuth credentials are correct
- Check Cloudflare Worker logs for any errors during execution
- Verify that your client configuration points to the correct worker URL

## License

MIT