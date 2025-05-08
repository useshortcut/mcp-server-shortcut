# Shortcut MCP Project Structure

This document provides an overview of the project structure for the Shortcut MCP implementation.

## Project Components

The project is now organized into three main components:

1. **`shortcut-mcp-tools`**: A shared package containing all Shortcut-specific tools and client logic
2. **`mcp-server-shortcut`**: The original stdio-based MCP server (CLI tool)
3. **`shortcut-mcp-worker`**: A Cloudflare Worker implementation for remote MCP access

## Shared Tools Package

### Location
`/shortcut-mcp-tools/`

### Description
This package contains all the Shortcut-specific tools and client logic that is shared between both the stdio-based and Cloudflare Worker implementations. This eliminates code duplication and ensures consistent behavior across different transports.

### Key Files
- `src/client/shortcut.ts`: Wrapper around the Shortcut API client
- `src/client/cache.ts`: Simple caching implementation for API responses
- `src/tools/*.ts`: Various tools for interacting with Shortcut (stories, epics, etc.)
- `src/tools/utils/*.ts`: Utility functions for formatting, validation, etc.
- `src/index.ts`: Exports all tools and utilities

## Original MCP Server (stdio-based)

### Location
`/` (root directory)

### Description
The original implementation of the Shortcut MCP server that uses stdio for communication. This is designed to be run as a CLI tool and is compatible with Claude Code, Cursor, and Windsurf.

### Key Files
- `index.ts`: Entry point for the CLI tool
- `src/server.ts`: MCP server setup with stdio transport
- Other configuration files (biome.json, tsconfig.json, etc.)

### Dependencies
- Now depends on the shared tools package
- Uses stdio transport from the MCP SDK

## Cloudflare Worker Implementation

### Location
`/shortcut-mcp-worker/`

### Description
A new implementation of the Shortcut MCP server that runs on Cloudflare Workers. This allows for remote access to the MCP server without needing to run the CLI tool locally.

### Key Files
- `src/index.ts`: Main entry point for the Worker
- `src/transport/http-sse.ts`: HTTP+SSE transport implementation for MCP
- `src/auth.ts`: OAuth authentication implementation
- `wrangler.toml`: Cloudflare Worker configuration

### Dependencies
- Depends on the shared tools package
- Uses HTTP+SSE transport instead of stdio
- Adds OAuth authentication via Cloudflare Workers OAuth provider

## How to Use

### Local Development

1. **Install dependencies for all components**:
   ```bash
   # Install dependencies for the shared package
   cd shortcut-mcp-tools
   npm install

   # Install dependencies for the original server
   cd ..
   npm install

   # Install dependencies for the worker
   cd shortcut-mcp-worker
   npm install
   ```

2. **Build the shared package**:
   ```bash
   cd shortcut-mcp-tools
   npm run build
   ```

3. **Run the original server**:
   ```bash
   cd ..
   SHORTCUT_API_TOKEN=your-token npm run build
   node dist/index.js
   ```

4. **Run the worker locally**:
   ```bash
   cd shortcut-mcp-worker
   npm run dev
   ```

### Deployment

1. **Publish the shared package** (if needed):
   ```bash
   cd shortcut-mcp-tools
   npm publish
   ```

2. **Deploy the worker**:
   ```bash
   cd shortcut-mcp-worker
   npm run deploy
   ```

## Architecture Benefits

1. **Code Sharing**: All business logic is in one place
2. **Consistent Behavior**: Both implementations use the same tools
3. **Easier Maintenance**: Changes to tools only need to be made in one place
4. **Flexible Deployment**: Can be used locally or remotely
5. **Progressive Enhancement**: New tools can be added to the shared package and used by both implementations