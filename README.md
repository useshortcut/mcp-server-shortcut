# @useshortcut/mcp

> [!IMPORTANT]
> To use the MCP server, you need to first install the dependencies and run the build step.

## Installation

```bash
npm install
```

## Build

```bash
npm run build
```

## Usage

> Note: `mcp-server-shortcut` in the paths below refer to the folder name where you cloned this repo. If you used a different folder name, you'll need to use that instead.

### Windsurf

See the [official Windsurf docs](https://codeium.com/docs/windsurf/mcp) for more information.

1. Open the `Windsurf MCP Configuration Panel`
2. Click `Add custom server`.
3. Add the following details and save the file:

```json
{
  "mcpServers": {
    "shortcut": {
      "command": "npx",
      "args": [
        "@shortcut/mcp"
      ],
      "env": {
        "SHORTCUT_API_TOKEN": "<YOUR_SHORTCUT_API_TOKEN>"
      }
    }
  }
}
```

### Cursor

See the [official Cursor docs](https://docs.cursor.com/context/model-context-protocol) for more information.

1. Open (or create) the `mcp.json` file (it should be in `~/.cursor/mcp.json` or `<project-root>/.cursor/mcp.json`, but see Cursor docs for more details).
2. Add the following details and save the file:

```json
{
  "mcpServers": {
    "shortcut": {
      "command": "npx",
      "args": [
        "@shortcut/mcp"
      ],
      "env": {
        "SHORTCUT_API_TOKEN": "<YOUR_SHORTCUT_API_TOKEN>"
      }
    }
  }
}
```