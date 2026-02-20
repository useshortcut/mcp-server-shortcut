# Local Server Setup

This guide covers running the Shortcut MCP server locally using `npx`. This is the recommended approach for IDEs that don't yet support HTTP-based MCP servers, or if you prefer to self-host.

All local configurations require a **Shortcut API token**. You can generate one at [https://app.shortcut.com/settings/account/api-tokens](https://app.shortcut.com/settings/account/api-tokens).

> **Tip:** If your IDE supports HTTP-based MCP servers (like Cursor or VS Code), you can connect directly to `https://mcp.shortcut.com/mcp` instead — no API token or local setup required. See the [main README](../README.md) for details.

## Windsurf

See the [official Windsurf docs](https://docs.windsurf.com/windsurf/cascade/mcp) for more information.

1. Open the `Windsurf MCP Configuration Panel`
2. Click `Add custom server`.
3. Add the following details and save the file:

```json
{
  "mcpServers": {
    "shortcut": {
      "command": "npx",
      "args": [
        "-y",
        "@shortcut/mcp@latest"
      ],
      "env": {
        "SHORTCUT_API_TOKEN": "<YOUR_SHORTCUT_API_TOKEN>"
      }
    }
  }
}
```

## Cursor

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en-US/install-mcp?name=shortcut&config=eyJlbnYiOnsiU0hPUlRDVVRfQVBJX1RPS0VOIjoiWU9VUl9UT0tFTiJ9LCJjb21tYW5kIjoibnB4IC15IEBzaG9ydGN1dC9tY3AifQ%3D%3D)

See the [official Cursor docs](https://docs.cursor.com/context/model-context-protocol) for more information.

1. Open (or create) the `mcp.json` file (it should be in `~/.cursor/mcp.json` or `<project-root>/.cursor/mcp.json`, but see Cursor docs for more details).
2. Add the following details and save the file:

```json
{
  "mcpServers": {
    "shortcut": {
      "command": "npx",
      "args": [
        "-y",
        "@shortcut/mcp@latest"
      ],
      "env": {
        "SHORTCUT_API_TOKEN": "<YOUR_SHORTCUT_API_TOKEN>"
      }
    }
  }
}
```

## Claude Code

See the [official Claude Code docs](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/tutorials#set-up-model-context-protocol-mcp) for more information.

_You can add a new MCP server from the Claude Code CLI. But modifying the json file directly is simpler!_

You can either add a new MCP server from the command line:

```shell
# Grab your Shortcut token here: https://app.shortcut.com/settings/account/api-tokens
claude mcp add shortcut --transport=stdio -e SHORTCUT_API_TOKEN=$SHORTCUT_API_TOKEN -- npx -y @shortcut/mcp@latest
```

Or you can edit the local JSON file directly:

1. Open the Claude Code configuration file (it should be in `~/.claude.json`).
2. Find the `projects` > `mcpServers` section and add the following details and save the file:

```json
{
  "projects": {
    "mcpServers": {
      "shortcut": {
        "command": "npx",
        "args": [
          "-y",
          "@shortcut/mcp@latest"
        ],
        "env": {
          "SHORTCUT_API_TOKEN": "<YOUR_SHORTCUT_API_TOKEN>"
        }
      }
    }
  }
}
```

## Zed

[Zed MCP Documentation](https://zed.dev/docs/ai/mcp)
1. Open your `settings.json` file. Instructions [here](https://zed.dev/docs/configuring-zed#settings-files)
2. Add the following details and save the file:

```json
  "context_servers": {
    "shortcut": {
      "settings":{},
      "command": {
        "path": "<PATH/TO/NPX>",
        "args": [
          "-y",
          "@shortcut/mcp@latest"
        ],
        "env": {
          "SHORTCUT_API_TOKEN": "<YOUR_SHORTCUT_API_TOKEN>"
        }
      }
    }
  }
```

## Common Issues

### NPX command not working when using MISE for version management

If you are using MISE for managing Node and NPM versions, you may encounter a "Client closed" error when trying to run the MCP server. Installing this extension into your IDE might help: https://github.com/hverlin/mise-vscode/.
