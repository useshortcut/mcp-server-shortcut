# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Build**: `bun run build` - Compiles TypeScript to dist/index.js with executable permissions
- **Test**: `bun test` - Runs all test files using Bun's test runner
- **Lint**: `bun run lint` - Checks code quality with Biome linter
- **Format**: `bun run format` - Formats code and fixes linting issues with Biome
- **Type Check**: `bun run ts` - Type checks with TypeScript compiler

## Architecture Overview

This is an MCP (Model Context Protocol) server that provides AI assistants with tools to interact with the Shortcut project management API.

### Core Components

- **Entry Point**: `index.ts` - Simple CLI entry that imports the server
- **Server**: `src/server.ts` - MCP server setup with tool registration and client initialization
- **Client Layer**: `src/client/shortcut.ts` - Wrapper around the Shortcut API client with caching
- **Tools**: `src/tools/` - Individual tool modules for different Shortcut entities (stories, epics, iterations, etc.)

### Tool Architecture

Each tool module follows a consistent pattern:
- Extends `BaseTools` class for common functionality
- Uses the `ShortcutClientWrapper` for API calls
- Registers tools with the MCP server in their `create()` method
- Implements search, get, create, and update operations for their respective entities

### Client Wrapper Features

The `ShortcutClientWrapper` provides:
- Caching for users and workflows to reduce API calls
- Unified error handling
- Consistent data transformation
- Helper methods for common operations like getting user maps

### Configuration

- Uses Biome for linting/formatting with tab indentation
- TypeScript configured for ES2022 with strict mode
- Bun as the runtime and package manager
- Path aliases: `@/*` maps to `./src/*`

## Local Development Setup

To test locally instead of using the published package:
1. `bun run build`
2. Update your MCP configuration to use `node /path/to/dist/index.js`
3. Set `SHORTCUT_API_TOKEN` environment variable

## Git Commit Guidelines

Follow Conventional Commits specification (https://www.conventionalcommits.org/ja/v1.0.0/#%e6%a6%82%e8%a6%81):

### Important Principles:
- Create appropriately sized commits - avoid very large single commits for PRs
- Keep commits reviewable and focused
- Don't mix multiple types of changes in one commit
- Use conventional commit format: `type(scope): description`

### Common Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks