import { describe, expect, test } from "bun:test";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { Story } from "@shortcut/client";
import { BaseTools } from "./base";

describe("BaseTools", () => {
	class TestTools extends BaseTools {
		publicToCorrectedEntity(entity: unknown) {
			return this.entityWithRelatedEntities(entity as Story);
		}

		publicToResult(str: string) {
			return this.toResult(str);
		}
	}

	test("toResult", () => {
		const tools = new TestTools({} as ShortcutClientWrapper);

		const result = tools.publicToResult("test");

		expect(result).toEqual({ content: [{ type: "text", text: "test" }] });
	});
});
