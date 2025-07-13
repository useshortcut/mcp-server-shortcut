import { describe, expect, test } from "bun:test";
import type { MemberInfo } from "@shortcut/client";
import { buildSearchQuery, type QueryParams } from "./search";

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
		expect(result).toBe("title:test state:started");
	});

	test("should quote string parameters with spaces", async () => {
		const params: QueryParams = {
			name: "test story",
			description: "some description",
		};
		const result = await buildSearchQuery(params, null);
		expect(result).toBe('title:"test story" description:"some description"');
	});

	test("should handle mixed parameter types correctly", async () => {
		const params: QueryParams = {
			id: 123,
			name: "test",
			isStarted: true,
			hasOwner: false,
		};
		const result = await buildSearchQuery(params, null);
		expect(result).toBe("id:123 title:test is:started !has:owner");
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

	test("should not include @ prefix for user names", async () => {
		const params: QueryParams = {
			owner: "@janedoe",
		};
		const result = await buildSearchQuery(params, mockCurrentUser);
		expect(result).toBe("owner:janedoe");
	});
});
