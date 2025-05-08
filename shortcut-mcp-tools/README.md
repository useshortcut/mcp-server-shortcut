# Shortcut MCP Tools

Shared tools library for Shortcut MCP implementations. This package provides a consistent set of tools for interacting with the Shortcut API, regardless of the transport mechanism used.

## Installation

```bash
npm install @shortcut/mcp-tools
```

## Usage

### Initialize the client

```typescript
import { ShortcutClient } from '@shortcut/client';
import { ShortcutClientWrapper, StoryTools } from '@shortcut/mcp-tools';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Initialize the client with your API token
const client = new ShortcutClientWrapper(new ShortcutClient('your-api-token'));

// Initialize the MCP server
const server = new McpServer({ name: 'your-mcp-server', version: '1.0.0' });

// Register tools
StoryTools.create(client, server);
// Register other tools as needed...
```

## Available Tools

- `UserTools`: Get information about the current user.
- `StoryTools`: Work with Shortcut stories (search, create, update, comment).
- `EpicTools`: Work with Shortcut epics.
- `IterationTools`: Work with Shortcut iterations.
- `ObjectiveTools`: Work with Shortcut objectives.
- `TeamTools`: Work with Shortcut teams.
- `WorkflowTools`: Work with Shortcut workflows.

## Development

### Building

```bash
npm run build
```

### Publishing

```bash
npm publish
```

## License

MIT