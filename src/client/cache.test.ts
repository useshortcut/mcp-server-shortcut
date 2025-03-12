import { expect, test, describe, beforeEach, jest } from "bun:test";
import { Cache } from "./cache";

describe("Cache", () => {
	let cache: Cache<string, number>;

	beforeEach(() => {
		cache = new Cache<string, number>();
	});

	test("should return null for non-existent keys", () => {
		expect(cache.get("nonexistent")).toBe(null);
	});

	test("should store and retrieve values", () => {
		const values: [string, number][] = [
			["key1", 100],
			["key2", 200],
		];

		cache.setMany(values);

		expect(cache.get("key1")).toBe(100);
		expect(cache.get("key2")).toBe(200);
	});

	test("should clear previous values when setting new ones", () => {
		// Set initial values
		cache.setMany([
			["key1", 100],
			["key2", 200],
		]);

		// Set new values
		cache.setMany([["key3", 300]]);

		// Previous values should be cleared
		expect(cache.get("key1")).toBe(null);
		expect(cache.get("key2")).toBe(null);
		expect(cache.get("key3")).toBe(300);
	});

	test("should clear all values", () => {
		cache.setMany([
			["key1", 100],
			["key2", 200],
		]);

		cache.clear();

		expect(cache.get("key1")).toBe(null);
		expect(cache.get("key2")).toBe(null);
	});

	test("should be stale when first created", () => {
		expect(cache.isStale).toBe(true);
	});

	test("should not be stale immediately after setting values", () => {
		cache.setMany([["key1", 100]]);
		expect(cache.isStale).toBe(false);
	});

	test("should be stale after 5 minutes", () => {
		// Mock Date.now to return a fixed timestamp
		const originalDateNow = Date.now;
		const currentTime = 1000000;

		try {
			// Set initial time
			global.Date.now = jest.fn(() => currentTime);

			// Set values (which will record the current time)
			cache.setMany([["key1", 100]]);

			// Advance time by 5 minutes + 1 millisecond
			global.Date.now = jest.fn(() => currentTime + 1000 * 60 * 5 + 1);

			// Cache should now be stale
			expect(cache.isStale).toBe(true);
		} finally {
			// Restore original Date.now
			global.Date.now = originalDateNow;
		}
	});

	test("should not be stale before 5 minutes", () => {
		// Mock Date.now to return a fixed timestamp
		const originalDateNow = Date.now;
		const currentTime = 1000000;

		try {
			// Set initial time
			global.Date.now = jest.fn(() => currentTime);

			// Set values (which will record the current time)
			cache.setMany([["key1", 100]]);

			// Advance time by 5 minutes - 1 millisecond
			global.Date.now = jest.fn(() => currentTime + 1000 * 60 * 5 - 1);

			// Cache should not be stale yet
			expect(cache.isStale).toBe(false);
		} finally {
			// Restore original Date.now
			global.Date.now = originalDateNow;
		}
	});

	test("should be stale after being cleared", () => {
		const originalDateNow = Date.now;
		const currentTime = 1000000;

		try {
			// Set initial time
			global.Date.now = jest.fn(() => currentTime);

			// Set values (which will record the current time)
			cache.setMany([["key1", 100]]);

			// Clear the cache
			cache.clear();

			// Advance time by more than 5 minutes
			global.Date.now = jest.fn(() => currentTime + 1000 * 60 * 10);

			// Cache should be stale because age was reset to 0
			expect(cache.isStale).toBe(true);
		} finally {
			// Restore original Date.now
			global.Date.now = originalDateNow;
		}
	});

	test("should work with different types", () => {
		const stringCache = new Cache<number, string>();
		stringCache.setMany([
			[1, "one"],
			[2, "two"],
		]);

		expect(stringCache.get(1)).toBe("one");
		expect(stringCache.get(2)).toBe("two");

		const objectCache = new Cache<string, object>();
		const obj1 = { name: "Object 1" };
		const obj2 = { name: "Object 2" };

		objectCache.setMany([
			["obj1", obj1],
			["obj2", obj2],
		]);

		expect(objectCache.get("obj1")).toBe(obj1);
		expect(objectCache.get("obj2")).toBe(obj2);
	});

	test("should return all values", () => {
		const cache = new Cache<string, number>();
		cache.setMany([
			["a", 1],
			["b", 2],
		]);

		expect(cache.values()).toEqual([1, 2]);
	});
});
