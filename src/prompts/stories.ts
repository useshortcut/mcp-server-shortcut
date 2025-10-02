import { z } from "zod";
import type { CustomMcpServer } from "@/mcp/CustomMcpServer";

export class StoryPrompts {
	static create(server: CustomMcpServer) {
		// Bug Triage Report - Link Related Bug Stories
		server.prompt(
			"bug-triage-link-duplicates",
			"Workflow guide for linking duplicate bug stories while preventing duplicate relations",
			{
				dry_run: z
					.enum(["yes", "no"])
					.describe(
						"If 'yes', only report what would happen without creating relations. If 'no', actually create the relations.",
					),
			},
			async ({ dry_run }) => {
				const isDryRun = dry_run === "yes";
				return {
					messages: [
						{
							role: "user",
							content: {
								type: "text",
								text: `# Workflow: Bug Triage Report - Link Related Bug Stories

## Goal
Connect duplicate bugs by adding story relationships while avoiding duplicate relations.

## Required Tools, all from the Shortcut MCP - if any of these tools are unavailable, stop and notify the user
1. **stories-search** - Find bugs to triage
2. **stories-get-by-id** - Check existing relations before creating new ones
${!isDryRun ? "3. **stories-add-relation** - Add new relations" : ""}

${isDryRun ? "You are in DRY RUN mode. Report what relations would be created, but DO NOT call stories-add-relation." : "You are in LIVE mode. Actually create relations using stories-add-relation."}

## Important: Preventing Duplicate Relations
Before creating any relation, you MUST check if the stories are already related.

## Workflow Steps

### Step 1: Search for Bugs
\`\`\`
Use: stories-search
Parameters: {
  type: "bug"
}
\`\`\`

This returns a list of stories with basic info (id, name, app_url, etc.).
**Note**: The search result does NOT include related_stories field.

**Pagination**: Results may be paginated. If the response includes a \`next_page_token\`, you must call stories-search again with that token to get the next page:
\`\`\`
Use: stories-search
Parameters: {
  type: "bug",
  nextPageToken: "<token_from_previous_response>"
}
\`\`\`
Continue until no \`next_page_token\` is returned to ensure you have all bugs.

### Step 2: Identify Duplicate Candidates
Analyze the bug list to identify potential duplicates based on:
- Similar names
- Similar descriptions
- Same error messages
- Related functionality

### Step 3: Check Existing Relations (CRITICAL)
For each potential duplicate pair, check if a relation already exists:

\`\`\`
Use: stories-get-by-id
Parameters: {
  storyPublicId: <storyA_id>
}
\`\`\`

${
	!isDryRun
		? `### Step 4: Add Relation (Only if Not Already Related)
\`\`\`
IF storyB_id NOT IN storyA.related_stories:

  Use: stories-add-relation
  Parameters: {
    storyPublicId: <storyA_id>,
    relatedStoryPublicId: <storyB_id>,
    relationshipType: "duplicates"
  }

ELSE:
  Skip this pair, stories already related
\`\`\`

`
		: ""
}### Step ${isDryRun ? "4" : "5"}: Report Results
Provide a summary:
- Total bug pairs identified
- New relationships created
- Pairs skipped (already related)
- Any errors encountered

## Key Implementation Notes

### 1. Error Handling
- If stories-get-by-id fails for a story, note the error and skip that pair
- Don't let one failure block processing other pairs
- Report all errors in the final summary

### 2. Performance Considerations
- Use stories-search once to get the initial list
- Use stories-get-by-id once per pair to check for existing relationships
- Only call stories-add-relation if no existing relationship found

## Remember
- ALWAYS check related_stories before creating relationships
- Report skipped pairs in your summary
- Handle errors gracefully`,
							},
						},
					],
				};
			},
		);
	}
}
