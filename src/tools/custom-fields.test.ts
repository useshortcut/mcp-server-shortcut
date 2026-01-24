import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { CustomField } from "@shortcut/client";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { CustomMcpServer } from "@/mcp/CustomMcpServer";
import { CustomFieldTools } from "./custom-fields";
import { getTextContent } from "./utils/test-helpers";

describe("CustomFieldTools", () => {
	const mockCustomFields: CustomField[] = [
		{
			entity_type: "custom-field",
			id: "field-1",
			name: "Priority",
			field_type: "enum",
			description: "Priority level",
			canonical_name: "priority",
			enabled: true,
			values: [
				{
					id: "val-1",
					value: "High",
					position: 1,
					color_key: "red",
					enabled: true,
				},
				{
					id: "val-2",
					value: "Medium",
					position: 2,
					color_key: "yellow",
					enabled: true,
				},
				{
					id: "val-3",
					value: "Low",
					position: 3,
					color_key: "green",
					enabled: false,
				},
			],
		} as unknown as CustomField,
		{
			entity_type: "custom-field",
			id: "field-2",
			name: "Category",
			field_type: "enum",
			description: "Story category",
			canonical_name: null,
			enabled: true,
			values: [
				{
					id: "val-4",
					value: "Frontend",
					position: 1,
					enabled: true,
				},
				{
					id: "val-5",
					value: "Backend",
					position: 2,
					enabled: true,
				},
			],
		} as unknown as CustomField,
		{
			entity_type: "custom-field",
			id: "field-3",
			name: "Disabled Field",
			field_type: "enum",
			description: "A disabled field",
			canonical_name: null,
			enabled: false,
			values: [
				{
					id: "val-6",
					value: "Option 1",
					position: 1,
					enabled: true,
				},
			],
		} as unknown as CustomField,
	];

	const createMockClient = (methods?: object) =>
		({
			...methods,
		}) as unknown as ShortcutClientWrapper;

	describe("create method", () => {
		test("should register the correct tools with the server", () => {
			const mockClient = createMockClient();
			const mockToolRead = mock();
			const mockToolWrite = mock();
			const mockServer = {
				addToolWithReadAccess: mockToolRead,
				addToolWithWriteAccess: mockToolWrite,
			} as unknown as CustomMcpServer;

			CustomFieldTools.create(mockClient, mockServer);

			expect(mockToolRead).toHaveBeenCalledTimes(1);
			expect(mockToolRead.mock.calls?.[0]?.[0]).toBe("custom-fields-list");

			expect(mockToolWrite).toHaveBeenCalledTimes(0);
		});
	});

	describe("listCustomFields method", () => {
		const getCustomFieldsMock = mock(async () => mockCustomFields);

		beforeEach(() => {
			getCustomFieldsMock.mockClear();
		});

		test("should return formatted list of custom fields when fields exist", async () => {
			const mockClient = createMockClient({ getCustomFields: getCustomFieldsMock });
			const customFieldTools = new CustomFieldTools(mockClient);
			const result = await customFieldTools.listCustomFields({ includeDisabled: false });

			expect(getCustomFieldsMock).toHaveBeenCalled();

			const textContent = getTextContent(result);
			expect(textContent).toContain("Result (2 custom fields found):");
			expect(textContent).toContain('"id": "field-1"');
			expect(textContent).toContain('"name": "Priority"');
			expect(textContent).toContain('"id": "field-2"');
			expect(textContent).toContain('"name": "Category"');
			// Should not contain disabled field when includeDisabled is false
			expect(textContent).not.toContain('"name": "Disabled Field"');
		});

		test("should return no custom fields found message when no fields exist", async () => {
			const emptyMock = mock(async () => []);
			const mockClient = createMockClient({ getCustomFields: emptyMock });
			const customFieldTools = new CustomFieldTools(mockClient);
			const result = await customFieldTools.listCustomFields({ includeDisabled: false });

			expect(getTextContent(result)).toBe("Result: No custom fields found.");
		});

		test("should include disabled fields when includeDisabled is true", async () => {
			const mockClient = createMockClient({ getCustomFields: getCustomFieldsMock });
			const customFieldTools = new CustomFieldTools(mockClient);
			const result = await customFieldTools.listCustomFields({ includeDisabled: true });

			expect(getCustomFieldsMock).toHaveBeenCalled();

			const textContent = getTextContent(result);
			expect(textContent).toContain("Result (3 custom fields found):");
			expect(textContent).toContain('"id": "field-1"');
			expect(textContent).toContain('"id": "field-2"');
			expect(textContent).toContain('"id": "field-3"');
			expect(textContent).toContain('"name": "Disabled Field"');
			expect(textContent).toContain('"enabled":');
		});

		test("should filter disabled values when includeDisabled is false", async () => {
			const mockClient = createMockClient({ getCustomFields: getCustomFieldsMock });
			const customFieldTools = new CustomFieldTools(mockClient);
			const result = await customFieldTools.listCustomFields({ includeDisabled: false });

			const textContent = getTextContent(result);
			// Should contain enabled values
			expect(textContent).toContain('"value": "High"');
			expect(textContent).toContain('"value": "Medium"');
			// Should not contain disabled value "Low"
			expect(textContent).not.toContain('"value": "Low"');
		});

		test("should include disabled values when includeDisabled is true", async () => {
			const mockClient = createMockClient({ getCustomFields: getCustomFieldsMock });
			const customFieldTools = new CustomFieldTools(mockClient);
			const result = await customFieldTools.listCustomFields({ includeDisabled: true });

			const textContent = getTextContent(result);
			// Should contain all values including disabled
			expect(textContent).toContain('"value": "High"');
			expect(textContent).toContain('"value": "Medium"');
			expect(textContent).toContain('"value": "Low"');
		});

		test("should include field type and canonical name", async () => {
			const mockClient = createMockClient({ getCustomFields: getCustomFieldsMock });
			const customFieldTools = new CustomFieldTools(mockClient);
			const result = await customFieldTools.listCustomFields({ includeDisabled: false });

			const textContent = getTextContent(result);
			expect(textContent).toContain('"field_type": "enum"');
			expect(textContent).toContain('"canonical_name": "priority"');
		});
	});
});
