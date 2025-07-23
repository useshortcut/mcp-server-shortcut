import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { date, has, is, user } from "./validation";

describe("validation utilities", () => {
	describe("date validation", () => {
		test("should validate valid date formats", () => {
			const validDates = [
				"2023-01-01",
				"today",
				"yesterday",
				"tomorrow",
				"2023-01-01..*",
				"*..2023-01-01",
				"today..*",
				"*..today",
				"yesterday..*",
				"*..yesterday",
				"tomorrow..*",
				"*..tomorrow",
			];

			for (const dateStr of validDates) {
				const result = date().safeParse(dateStr);
				expect(result.success).toBe(true);
			}
		});

		test("should reject invalid date formats", () => {
			const invalidDates = [
				"01-01-2023", // wrong format
				"not-a-date",
				"today-1", // invalid relative date
				"tomorrow+1", // invalid relative date
				"2023-01-01..", // incomplete range
				"..2023-01-01", // incomplete range
				"today..tomorrow", // closed range with keywords is not allowed
			];

			for (const dateStr of invalidDates) {
				const result = date().safeParse(dateStr);
				expect(result.success).toBe(false);
			}
		});

		test("should allow undefined values", () => {
			const result = date().safeParse(undefined);
			expect(result.success).toBe(true);
		});
	});

	describe("is validation", () => {
		test("should create a boolean validator with description", () => {
			const isStarted = is("started");

			// Validate that it's a Zod schema
			expect(isStarted instanceof z.ZodType).toBe(true);

			// Validate boolean values
			expect(isStarted.safeParse(true).success).toBe(true);
			expect(isStarted.safeParse(false).success).toBe(true);

			// Validate undefined is allowed
			expect(isStarted.safeParse(undefined).success).toBe(true);

			// Validate non-boolean values are rejected
			expect(isStarted.safeParse("true").success).toBe(false);
			expect(isStarted.safeParse(1).success).toBe(false);
		});
	});

	describe("has validation", () => {
		test("should create a boolean validator with description", () => {
			const hasOwner = has("owner");

			// Validate that it's a Zod schema
			expect(hasOwner instanceof z.ZodType).toBe(true);

			// Validate boolean values
			expect(hasOwner.safeParse(true).success).toBe(true);
			expect(hasOwner.safeParse(false).success).toBe(true);

			// Validate undefined is allowed
			expect(hasOwner.safeParse(undefined).success).toBe(true);

			// Validate non-boolean values are rejected
			expect(hasOwner.safeParse("true").success).toBe(false);
			expect(hasOwner.safeParse(1).success).toBe(false);
		});
	});

	describe("user validation", () => {
		test("should create a string validator with description", () => {
			const ownerUser = user("owner");

			// Validate that it's a Zod schema
			expect(ownerUser instanceof z.ZodType).toBe(true);

			// Validate string values
			expect(ownerUser.safeParse("johndoe").success).toBe(true);
			expect(ownerUser.safeParse("me").success).toBe(true);

			// Validate undefined is allowed
			expect(ownerUser.safeParse(undefined).success).toBe(true);

			// Validate non-string values are rejected
			expect(ownerUser.safeParse(true).success).toBe(false);
			expect(ownerUser.safeParse(123).success).toBe(false);
		});
	});
});
