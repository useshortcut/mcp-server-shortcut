# @shortcut/mcp

<img height="125" src="https://github.com/user-attachments/assets/7c3d3b8e-6252-4790-81cd-6640cd46a2d6" alt="Shortcut's logo" align="right">

[![Version](https://badge.fury.io/js/@shortcut%2Fmcp.svg)](https://badge.fury.io/js/@shortcut%2Fmcp)
[![Monthly Downloads](https://img.shields.io/npm/dm/@shortcut%2Fmcp)](https://www.npmjs.org/package/@shortcut%2Fmcp)
[![GitHub License](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/useshortcut/mcp-server-shortcut/blob/main/LICENSE)
[![PRs welcome!](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)]()
[![X](https://img.shields.io/twitter/follow/shortcut.svg?label=Follow%20@shortcut)](https://twitter.com/intent/follow?screen_name=shortcut)

MCP Server for [Shortcut](https://shortcut.com) users.

Links: [Local Installations](docs/local-server.md) | [ Server Developers](docs/developer.md)

## Usage

### Cursor

The fastest way to get started is to connect to Shortcut's hosted MCP server. No API token or local setup required — authentication is handled via OAuth.

1. Open (or create) the `mcp.json` file (it should be in `~/.cursor/mcp.json` or `<project-root>/.cursor/mcp.json`, but see [Cursor docs](https://docs.cursor.com/context/model-context-protocol) for more details).
2. Add the following details and save the file:

```json
{
  "mcpServers": {
    "shortcut": {
      "url": "https://mcp.shortcut.com/mcp"
    }
  }
}
```

3. Restart Cursor. You will be prompted to authorize with your Shortcut account on first use.

### VS Code

If all you need need the configuration for the mcp.json file use this. You will be prompted to authorize with your Shortcut account on first use.


```json
{
  "servers": {
    "shortcut-mcp": {
      "type": "http",
      "url": "https://mcp.shortcut.com/mcp"
    }
  }
}
```

For more detail on installing MCP services in VSCode see the [official VS Code MCP docs](https://code.visualstudio.com/docs/copilot/chat/mcp-servers) for more information.

### Claude Desktop

Download the package [from this repo](https://github.com/useshortcut/mcp-server-shortcut/raw/refs/heads/main/mcp-server-shortcut.mcpb)

Then, either double-click the icon to install or drag the package onto the client window. It should trigger the installation.

### Other IDEs / Running Locally

If your IDE doesn't support HTTP-based MCP servers, or you'd prefer to run the server locally, see the [Local Server Setup](docs/local-server.md) guide. This covers setup for **Windsurf**, **Zed**, **Claude Code**, and any IDE that supports stdio-based MCP servers.

## Available Tools

### Stories

| Tool | Description |
|------|-------------|
| `stories-get-by-id` | Get a single Shortcut story by ID |
| `stories-get-history` | Get the change history for a story |
| `stories-search` | Find Shortcut stories with filtering and search options |
| `stories-get-branch-name` | Get the recommended branch name (based on workspace settings) for a specific story |
| `stories-create` | Create a new Shortcut story |
| `stories-update` | Update an existing Shortcut story |
| `stories-upload-file` | Upload a file and link it to a story |
| `stories-assign-current-user` | Assign the current user as the owner of a story |
| `stories-unassign-current-user` | Unassign the current user as the owner of a story |
| `stories-create-comment` | Create a comment on a story |
| `stories-create-subtask` | Add a new sub-task to a story |
| `stories-add-subtask` | Add an existing story as a sub-task |
| `stories-remove-subtask` | Remove a sub-task from a story |
| `stories-add-task` | Add a task to a story |
| `stories-update-task` | Update a task in a story |
| `stories-add-relation` | Add a story relationship (relates to, blocks, duplicates, etc.) |
| `stories-add-external-link` | Add an external link to a Shortcut story |
| `stories-remove-external-link` | Remove an external link from a Shortcut story |
| `stories-set-external-links` | Replace all external links on a story with a new set of links |
| `stories-get-by-external-link` | Find all stories that contain a specific external link |

### Labels

| Tool | Description |
|------|-------------|
| `labels-list` | List all labels in the Shortcut workspace |
| `labels-get-stories` | Get all stories with a specific label |
| `labels-create` | Create a new label in Shortcut |

### Custom Fields

| Tool | Description |
|------|-------------|
| `custom-fields-list` | List all custom fields in the workspace with their possible values |

### Epics

| Tool | Description |
|------|-------------|
| `epics-get-by-id` | Get a Shortcut epic by ID |
| `epics-search` | Find Shortcut epics with filtering and search options |
| `epics-create` | Create a new Shortcut epic |
| `epics-update` | Update an existing Shortcut epic |
| `epics-delete` | Delete a Shortcut epic |
| `epics-create-comment` | Create a comment on an epic |
  
### Iterations

| Tool | Description |
|------|-------------|
| `iterations-get-stories` | Get stories in a specific iteration by iteration ID |
| `iterations-get-by-id` | Get a Shortcut iteration by ID |
| `iterations-search` | Find Shortcut iterations with filtering and search options |
| `iterations-create` | Create a new Shortcut iteration with start/end dates |
| `iterations-update` | Update an existing Shortcut iteration |
| `iterations-delete` | Delete a Shortcut iteration |
| `iterations-get-active` | Get active iterations for the current user based on team memberships |
| `iterations-get-upcoming` | Get upcoming iterations for the current user based on team memberships |

### Objectives

| Tool | Description |
|------|-------------|
| `objectives-get-by-id` | Get a Shortcut objective by ID |
| `objectives-search` | Find Shortcut objectives with filtering and search options |

### Teams

| Tool | Description |
|------|-------------|
| `teams-get-by-id` | Get a Shortcut team by ID |
| `teams-list` | List all Shortcut teams |

### Projects

| Tool | Description |
|------|-------------|
| `projects-list` | List all projects in the Shortcut workspace |
| `projects-get-by-id` | Get a Shortcut project by public ID |
| `projects-get-stories` | Get all stories in a specific project |

### Workflows

| Tool | Description |
|------|-------------|
| `workflows-get-default` | Get the default workflow for a specific team or the workspace default |
| `workflows-get-by-id` | Get a Shortcut workflow by ID |
| `workflows-list` | List all Shortcut workflows |

### Users

| Tool | Description |
|------|-------------|
| `users-get-current` | Get the current user information |
| `users-get-current-teams` | Get a list of teams where the current user is a member |
| `users-list` | Get all workspace users |

### Documents

| Tool | Description |
|------|-------------|
| `documents-create` | Create a new document in Shortcut with Markdown content |
| `documents-update` | Update content of an existing document by its ID |
| `documents-list` | List all documents in Shortcut |
| `documents-search` | Search for documents |
| `documents-get-by-id` | Retrieve a specific document in markdown format by its ID |

## Limit tools

You can limit the tools available to the LLM by setting the `SHORTCUT_TOOLS` environment variable to a comma-separated list.

- Tools can be limited by entity type by just adding the entity, eg `stories` or `epics`.
- Individual tools can also be limitied by their full name, eg `stories-get-by-id` or `epics-search`.

By default, all tools are enabled.

Example (when running locally):

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
        "SHORTCUT_API_TOKEN": "<YOUR_SHORTCUT_API_TOKEN>",
        "SHORTCUT_TOOLS": "stories,epics,iterations-create"
      }
    }
  }
}
```

The following values are accepted in addition to the full tool names listed above under [Available Tools](#available-tools):

- `users`
- `stories`
- `epics`
- `iterations`
- `labels`
- `custom-fields`
- `objectives`
- `teams`
- `projects`
- `workflows`
- `documents`

## Read-only mode

You can run the MCP server in read-only mode by setting the `SHORTCUT_READONLY` environment variable to `true`. This will disable all tools that modify data in Shortcut.

Example (when running locally):

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
        "SHORTCUT_API_TOKEN": "<YOUR_SHORTCUT_API_TOKEN>",
        "SHORTCUT_READONLY": "true"
      }
    }
  }
}
```

## Issues and Troubleshooting

Before doing anything else, please make sure you are running the latest version!

If you run into problems using this MCP server, you have a couple of options:

| Option | Link |
|--------|------|
| Open an issue | [GitHub](https://github.com/useshortcut/mcp-server-shortcut/issues) |
| Ask for help | [Slack](https://shortcut.com/join-slack) |
