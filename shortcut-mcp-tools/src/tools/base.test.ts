import { describe, expect, test } from "bun:test";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import { BaseTools } from "./base";

describe("BaseTools", () => {
	test("toResult", () => {
		class TestTools extends BaseTools {
			publicToResult(str: string) {
				return this.toResult(str);
			}
		}
		const tools = new TestTools({} as ShortcutClientWrapper);

		const result = tools.publicToResult("test");

		expect(result).toEqual({ content: [{ type: "text", text: "test" }] });
	});
});
