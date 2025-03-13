# @useshortcut/mcp

## Installation

> First - install **bun** if needed: [Bun](https://bun.sh).

```bash
bun install
```

## Build

```bash
bun run build
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
      "command": "node",
      "args": [
        "/path/to/this/repo/mcp-server-shortcut"
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

1. Go to `Cursor Settings` > `Features` > `MCP`.
2. Click `Add New MCP Server`.
3. Add the following to the dialog:

- Name: `shortcut`
- Type: `command`
- Command: `node /path/to/this/repo/mcp-server-shortcut SHORTCUT_API_TOKEN=<YOUR_SHORTCUT_API_TOKEN>`

If you prefer, the SHORTCUT_API_TOKEN can instead be added to your environment:

```bash
export SHORTCUT_API_TOKEN=<YOUR_SHORTCUT_API_TOKEN>
```