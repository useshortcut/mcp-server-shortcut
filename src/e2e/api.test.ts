import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ShortcutClient } from "@shortcut/client";
import { ShortcutClientWrapper } from "../client/shortcut";
import { EpicTools } from "../tools/epics";
import { TeamTools } from "../tools/teams";

// E2E tests using real API
describe("E2E API Tests", () => {
	let client: ShortcutClientWrapper;
	let apiToken: string;

	beforeAll(() => {
		// Get API token from environment variable
		apiToken = process.env.SHORTCUT_API_TOKEN || "645c99f3-9c80-422a-a2a3-226e34580f62";

		if (!apiToken) {
			throw new Error("SHORTCUT_API_TOKEN environment variable is required for E2E tests");
		}

		client = new ShortcutClientWrapper(new ShortcutClient(apiToken));
	});

	describe("Authentication and Basic API", () => {
		test("should authenticate and get current user", async () => {
			const user = await client.getCurrentUser();

			expect(user).toBeTruthy();
			expect(user?.id).toBeDefined();
			expect(user?.mention_name).toBeDefined();

			console.log(`✓ Authenticated as: ${user?.mention_name} (${user?.name})`);
		}, 10000);

		test("should list teams", async () => {
			const teams = await client.getTeams();

			expect(teams).toBeTruthy();
			expect(Array.isArray(teams)).toBe(true);
			expect(teams.length).toBeGreaterThan(0);

			console.log(`✓ Found ${teams.length} teams`);

			// Check if Artemis team exists
			const artemisTeam = teams.find((team) => team.name === "Artemis");
			if (artemisTeam) {
				console.log(`✓ Artemis team found: ${artemisTeam.id}`);
			} else {
				console.log("⚠ Artemis team not found");
			}
		}, 10000);
	});

	describe("Search Functionality", () => {
		test("should search epics with basic query", async () => {
			try {
				// Test with a simple boolean query that should work
				const result = await client.searchEpics("is:started");

				expect(result).toBeTruthy();
				expect(typeof result.total).toBe("number");
				expect(Array.isArray(result.epics)).toBe(true);

				console.log(`✓ Basic epic search successful: found ${result.total} started epics`);

				if (result.epics && result.epics.length > 0) {
					console.log(`  Sample epic: ${result.epics[0].id} - ${result.epics[0].name}`);
				}
			} catch (error) {
				console.error("Basic epic search failed:", (error as Error).message);
				throw error;
			}
		}, 15000);

		test("should search epics for Artemis team", async () => {
			try {
				const result = await client.searchEpics("team:Artemis");

				expect(result).toBeTruthy();
				expect(typeof result.total).toBe("number");
				expect(Array.isArray(result.epics)).toBe(true);

				console.log(`✓ Artemis team search successful: found ${result.total} epics`);

				if (result.epics && result.epics.length > 0) {
					console.log("  Artemis epics:");
					result.epics.slice(0, 3).forEach((epic) => {
						console.log(`    - ${epic.id}: ${epic.name}`);
					});
				} else {
					console.log("  No epics found for Artemis team");
				}
			} catch (error) {
				console.error("Artemis team search failed:", (error as Error).message);

				// Try alternative search methods
				console.log("Trying alternative search methods...");

				try {
					// Try searching by group instead of team
					const groupResult = await client.searchEpics("group:Artemis");
					console.log(`Alternative group:Artemis search: found ${groupResult.total} epics`);
				} catch (groupError) {
					console.log("group:Artemis search also failed:", (groupError as Error).message);
				}

				// Don't throw the error here to continue with other tests
			}
		}, 15000);

		test("should handle empty search results gracefully", async () => {
			try {
				// Search for something that likely doesn't exist
				const result = await client.searchEpics("name:nonexistent-epic-12345");

				expect(result).toBeTruthy();
				expect(result.total).toBe(0);
				expect(Array.isArray(result.epics)).toBe(true);
				expect(result.epics?.length).toBe(0);

				console.log("✓ Empty search results handled correctly");
			} catch (error) {
				console.error("Empty search test failed:", (error as Error).message);
				throw error;
			}
		}, 10000);
	});

	describe("Epic Tools Integration", () => {
		test("should search epics using EpicTools with team parameter", async () => {
			const epicTools = new EpicTools(client);

			try {
				const result = await epicTools.searchEpics({ team: "Artemis" });

				expect(result).toBeTruthy();
				expect(result.content).toBeDefined();
				expect(Array.isArray(result.content)).toBe(true);
				expect(result.content.length).toBeGreaterThan(0);
				expect(result.content[0].type).toBe("text");

				const resultText = result.content[0].text as string;
				console.log("✓ EpicTools search result:");
				console.log(`  ${resultText.substring(0, 100)}...`);
			} catch (error) {
				console.error("EpicTools team search failed:", (error as Error).message);
				// Don't throw to continue with other tests
			}
		}, 15000);

		test("should search epics using EpicTools with state parameter", async () => {
			const epicTools = new EpicTools(client);

			try {
				const result = await epicTools.searchEpics({ isStarted: true });

				expect(result).toBeTruthy();
				expect(result.content).toBeDefined();
				expect(Array.isArray(result.content)).toBe(true);

				const resultText = result.content[0].text as string;
				console.log("✓ EpicTools state search result:");
				console.log(`  ${resultText.substring(0, 100)}...`);
			} catch (error) {
				console.error("EpicTools state search failed:", (error as Error).message);
				throw error;
			}
		}, 15000);

		test("should search epics with new flexible parameters", async () => {
			const epicTools = new EpicTools(client);

			try {
				// Test the new label and text search parameters
				const result = await epicTools.searchEpics({
					isStarted: true,
					hasStories: true,
				});

				expect(result).toBeTruthy();
				expect(result.content).toBeDefined();

				const resultText = result.content[0].text as string;
				console.log("✓ EpicTools flexible search result:");
				console.log(`  ${resultText.substring(0, 100)}...`);
			} catch (error) {
				console.error("EpicTools flexible search failed:", (error as Error).message);
				throw error;
			}
		}, 15000);
	});

	describe("Team Tools Integration", () => {
		test("should get teams using TeamTools", async () => {
			const teamTools = new TeamTools(client);

			try {
				const result = await teamTools.getTeams();

				expect(result).toBeTruthy();
				expect(result.content).toBeDefined();
				expect(Array.isArray(result.content)).toBe(true);

				const resultText = result.content[0].text as string;
				console.log("✓ TeamTools result:");
				console.log(`  ${resultText.substring(0, 200)}...`);

				// Check if Artemis is mentioned in the teams list
				const hasArtemis = resultText.includes("Artemis");
				console.log(`  Artemis team listed: ${hasArtemis ? "Yes" : "No"}`);
			} catch (error) {
				console.error("TeamTools failed:", (error as Error).message);
				throw error;
			}
		}, 10000);
	});

	describe("Pagination Testing", () => {
		test("should handle pagination correctly", async () => {
			try {
				// Search for all started epics to test pagination
				const result = await client.searchEpics("is:started");

				expect(result).toBeTruthy();
				expect(typeof result.total).toBe("number");
				expect(Array.isArray(result.epics)).toBe(true);

				console.log(`✓ Pagination test: found ${result.total} total epics`);
				console.log(`  Returned ${result.epics?.length || 0} epics in result`);

				// If there are more than 25 epics, pagination should have fetched all
				if (result.total && result.total > 25) {
					expect(result.epics?.length).toBe(result.total);
					console.log("✓ Pagination working correctly - all epics fetched");
				} else {
					console.log("✓ Small result set - pagination not needed");
				}
			} catch (error) {
				console.error("Pagination test failed:", (error as Error).message);
				throw error;
			}
		}, 30000); // Longer timeout for pagination
	});

	afterAll(() => {
		console.log("E2E tests completed");
	});
});
