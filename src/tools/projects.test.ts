import { describe, expect, test } from "bun:test";
import { ProjectTools } from "./projects";

describe("ProjectTools", () => {
	test("should be able to create instance", () => {
		const mockClient = {} as any;
		const mockServer = {} as any;
		
		expect(() => ProjectTools.create(mockClient, mockServer)).not.toThrow();
	});
});
