# @shortcut/mcp

## Usage

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

### Cursor

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/install-mcp?name=shortcut&config=eyJjb21tYW5kIjoibnB4IC15IEBzaG9ydGN1dC9tY3BAbGF0ZXN0IiwiZW52Ijp7IlNIT1JUQ1VUX0FQSV9UT0tFTiI6IjxZT1VSX1NIT1JUQ1VUX0FQSV9UT0tFTj4ifX0%3D)

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

### Claude Code

See the [official Claude Code docs](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/tutorials#set-up-model-context-protocol-mcp) for more information.

_You can add a new MCP server from the Claude Code CLI. But modifying the json file directly is simpler!_

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

### Zed
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

## Issues and Troubleshooting

Before doing anything else, please make sure you are running the latest version!

If you run into problems using this MCP server, you have a couple of options:

- Open an issue on [GitHub](https://github.com/useshortcut/mcp-server-shortcut/issues)
- Ask for help in the community [Slack](https://shortcut.com/join-slack)

You can also check the list of [common issues](#common-issues) below to see if there is a known solution already.

### Common Issues and Solutions

#### NPX command not working when using MISE for version management

If you are using MISE for managing Node and NPM versions, you may encounter a "Client closed" error when trying to run the MCP server. Installing this extension into your IDE might help: https://github.com/hverlin/mise-vscode/.

## Development

### Installation

```bash
npm install
```

### Build

```bash
npm run build
```

### Running the Development Server Locally

To test your local development version of the MCP server rather than using the published package, follow these steps:

1. Build the project:
   ```bash
   npm run build
   ```

2. Create or modify your `mcp.json` file to reference your local build:
   ```json
   {
     "mcpServers": {
       "shortcut": {
         "command": "node",
         "args": [
           "/path/to/your/local/mcp-server-shortcut/dist/index.js"
         ],
         "env": {
           "SHORTCUT_API_TOKEN": "<YOUR_SHORTCUT_API_TOKEN>"
         }
       }
     }
   }
   ```

3. Place this `mcp.json` file in one of the following locations:
   - For Cursor: In your home directory (`~/.cursor/mcp.json`) or in your project directory (`.cursor/mcp.json`)
   - For Windsurf: Use the MCP Configuration Panel to add the custom server

4. Restart your AI assistant (Cursor or Windsurf) to load the new configuration.

This allows you to instantly test changes to the MCP server without having to publish a new version.
