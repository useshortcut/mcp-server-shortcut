import { describe, expect, test } from "bun:test";
import type { MemberInfo } from "@shortcut/client";
import { type QueryParams, buildSearchQuery } from "./search";

describe("buildSearchQuery", () => {
	// Mock current user for testing
	const mockCurrentUser: MemberInfo = {
		id: "user1",
		mention_name: "johndoe",
		name: "John Doe",
	} as MemberInfo;

	test("should return empty string for empty params", async () => {
		const result = await buildSearchQuery({}, null);
		expect(result).toBe("");
	});

	test("should format boolean parameters correctly", async () => {
		const params: QueryParams = {
			isStarted: true,
			isDone: false,
		};
		const result = await buildSearchQuery(params, null);
		expect(result).toBe("is:started !is:done");
	});

	test("should format has parameters correctly", async () => {
		const params: QueryParams = {
			hasOwner: true,
			hasLabel: false,
		};
		const result = await buildSearchQuery(params, null);
		expect(result).toBe("has:owner !has:label");
	});

	test("should format number parameters correctly", async () => {
		const params: QueryParams = {
			id: 123,
			estimate: 5,
		};
		const result = await buildSearchQuery(params, null);
		expect(result).toBe("id:123 estimate:5");
	});

	test("should format string parameters correctly", async () => {
		const params: QueryParams = {
			name: "test",
			state: "started",
		};
		const result = await buildSearchQuery(params, null);
		expect(result).toBe("name:test state:started");
	});

	test("should quote string parameters with spaces", async () => {
		const params: QueryParams = {
			name: "test story",
			description: "some description",
		};
		const result = await buildSearchQuery(params, null);
		expect(result).toBe('name:"test story" description:"some description"');
	});

	test("should handle mixed parameter types correctly", async () => {
		const params: QueryParams = {
			id: 123,
			name: "test",
			isStarted: true,
			hasOwner: false,
		};
		const result = await buildSearchQuery(params, null);
		expect(result).toBe("id:123 name:test is:started !has:owner");
	});

	test('should replace "me" with current user mention name for owner parameter', async () => {
		const params: QueryParams = {
			owner: "me",
		};
		const result = await buildSearchQuery(params, mockCurrentUser);
		expect(result).toBe("owner:johndoe");
	});

	test('should replace "me" with current user mention name for requester parameter', async () => {
		const params: QueryParams = {
			requester: "me",
		};
		const result = await buildSearchQuery(params, mockCurrentUser);
		expect(result).toBe("requester:johndoe");
	});

	test('should keep "me" if current user is null', async () => {
		const params: QueryParams = {
			owner: "me",
		};
		const result = await buildSearchQuery(params, null);
		expect(result).toBe("owner:me");
	});

	test("should handle other user names for owner parameter", async () => {
		const params: QueryParams = {
			owner: "janedoe",
		};
		const result = await buildSearchQuery(params, mockCurrentUser);
		expect(result).toBe("owner:janedoe");
	});

	test("should resolve team name to team ID", async () => {
		const mockClient = {
			getTeams: async () => [
				{ id: "team1", name: "Engineering" },
				{ id: "team2", name: "Product Team" },
			],
		};
		const params: QueryParams = {
			team: "Engineering",
		};
		const result = await buildSearchQuery(params, mockCurrentUser, mockClient as any);
		expect(result).toBe("group:team1");
	});

	test("should resolve team name case insensitively", async () => {
		const mockClient = {
			getTeams: async () => [
				{ id: "team1", name: "Engineering" },
				{ id: "team2", name: "Product Team" },
			],
		};
		const params: QueryParams = {
			team: "engineering",
		};
		const result = await buildSearchQuery(params, mockCurrentUser, mockClient as any);
		expect(result).toBe("group:team1");
	});

	test("should handle team name with spaces", async () => {
		const mockClient = {
			getTeams: async () => [
				{ id: "team1", name: "Engineering" },
				{ id: "team2", name: "Product Team" },
			],
		};
		const params: QueryParams = {
			team: "Product Team",
		};
		const result = await buildSearchQuery(params, mockCurrentUser, mockClient as any);
		expect(result).toBe("group:team2");
	});

	test("should fallback to original team value if team not found", async () => {
		const mockClient = {
			getTeams: async () => [{ id: "team1", name: "Engineering" }],
		};
		const params: QueryParams = {
			team: "NonExistentTeam",
		};
		const result = await buildSearchQuery(params, mockCurrentUser, mockClient as any);
		expect(result).toBe("team:NonExistentTeam");
	});

	test("should handle API error gracefully when fetching teams", async () => {
		const mockClient = {
			getTeams: async () => {
				throw new Error("API Error");
			},
		};
		const params: QueryParams = {
			team: "Engineering",
		};
		const result = await buildSearchQuery(params, mockCurrentUser, mockClient as any);
		expect(result).toBe("team:Engineering");
	});

	test("should handle team parameter without client", async () => {
		const params: QueryParams = {
			team: "Engineering",
		};
		const result = await buildSearchQuery(params, mockCurrentUser);
		expect(result).toBe("team:Engineering");
	});
});
