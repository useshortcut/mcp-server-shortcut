# Development

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