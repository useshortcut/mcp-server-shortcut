# Tool Registration

This directory contains the MCP tool modules registered by `CustomMcpServer`.

## Registration Helpers

Use `addToolWithReadAccess(...)` for tools that only read data.

Use `addToolWithWriteAccess(...)` for tools that create, update, delete, or otherwise modify data.

Both helpers normalize registrations into the SDK's config-object `registerTool(...)` path so tool metadata is consistently exposed through `tools/list`.

## Default Metadata

`CustomMcpServer` automatically adds a default top-level `title` for every tool based on its tool name.

Examples:

- `users-get-current` -> `Users: Get Current`
- `stories-search` -> `Stories: Search`
- `epics-delete` -> `Epics: Delete`

`CustomMcpServer` also applies default tool annotations.

Read tools default to:

- `readOnlyHint: true`
- `idempotentHint: true`
- `destructiveHint: false`
- `openWorldHint: false`

Write tools default to:

- `readOnlyHint: false`
- `idempotentHint: false`
- `destructiveHint: false`
- `openWorldHint: false`

Write tools whose names include `-delete`, `-remove`, `-archive`, or `-purge` are marked with `destructiveHint: true`.

## Overriding Annotations

You can override the defaults by passing an explicit `annotations` object in the registration call.

Example:

```ts
server.addToolWithWriteAccess(
  "stories-set-external-links",
  "Replace all external links on a story.",
  {
    storyPublicId: z.number().positive().describe("Story ID"),
    externalLinks: z.array(z.string().url().max(2048)).describe("URLs to set"),
  },
  {
    idempotentHint: true,
  },
  async ({ storyPublicId, externalLinks }) =>
    await tools.setStoryExternalLinks(storyPublicId, externalLinks),
);
```

Explicit annotations are merged over the defaults for that tool.

## Output Schemas

`title` and `annotations` are descriptor metadata only.

`outputSchema` is different: if a tool declares an output schema, its handler must return matching `structuredContent`.

Until more tools adopt `outputSchema`, continue treating `structuredContent` support as an opt-in change rather than something added automatically to every tool registration.
