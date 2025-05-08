# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Shortcut MCP Server Development Guide

## Commands
- **Build**: `bun run build` or `npm run build`
- **Lint/Format**: `bun run lint` / `bun run format` (uses Biome)
- **Type check**: `bun run ts`
- **Run all tests**: `bun test` or `bun run test`
- **Run single test**: `bun test -t "test name"` or `bun test path/to/specific.test.ts`

## Code Style Guidelines
- **Formatting**: 
  - Tab indentation, 100 character line width, double quotes
  - Organized imports (by type/path using Biome)
- **TypeScript**: 
  - Use strict typing with proper annotations
  - Leverage Zod for schema validation
  - Follow TypeScript best practices for null checking
- **Naming**:
  - PascalCase for classes
  - camelCase for variables, functions, and methods
  - Descriptive function names

## Error Handling
- Use explicit error throwing with descriptive messages
- Follow proper async/await patterns
- Perform null checking before operations

## Testing
- Test files co-located with implementation files (*.test.ts)
- Use descriptive test organization with `describe` and `test` blocks
- Implement mock functions and spies as needed