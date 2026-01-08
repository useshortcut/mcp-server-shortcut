import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { CreateLabelParams, Label } from "@shortcut/client";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { CustomMcpServer } from "@/mcp/CustomMcpServer";
import { LabelTools } from "./labels";
import { getTextContent } from "./utils/test-helpers";

describe("LabelTools", () => {
	const mockLabels: Label[] = [
		{
			entity_type: "label",
			id: 1,
			name: "bug",
			color: "#ff0000",
			description: "Bug label",
			archived: false,
			app_url: "https://app.shortcut.com/test/label/1",
			global_id: "global-1",
			created_at: "2024-01-01T00:00:00Z",
			updated_at: "2024-01-01T00:00:00Z",
			external_id: null,
			stats: {
				num_stories_started: 5,
				num_epics_started: 2,
				num_stories_unestimated: 4,
				num_stories_total: 5,
				num_stories_completed: 0,
			},
		} as unknown as Label,
		{
			entity_type: "label",
			id: 2,
			name: "feature",
			color: "#00ff00",
			description: "Feature label",
			archived: false,
			app_url: "https://app.shortcut.com/test/label/2",
			global_id: "global-2",
			created_at: "2024-01-02T00:00:00Z",
			updated_at: "2024-01-02T00:00:00Z",
			external_id: null,
			stats: {
				num_stories_started: 10,
				num_epics_started: 3,
				num_stories_unestimated: 4,
				num_stories_total: 5,
				num_stories_completed: 0,
			},
		} as unknown as Label,
		{
			entity_type: "label",
			id: 3,
			name: "archived-label",
			color: "#0000ff",
			description: "Archived label",
			archived: true,
			app_url: "https://app.shortcut.com/test/label/3",
			global_id: "global-3",
			created_at: "2024-01-03T00:00:00Z",
			updated_at: "2024-01-03T00:00:00Z",
			external_id: null,
			stats: {
				num_stories_started: 0,
				num_epics_started: 0,
				num_stories_unestimated: 4,
				num_stories_total: 5,
				num_stories_completed: 0,
			},
		} as unknown as Label,
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

			LabelTools.create(mockClient, mockServer);

			expect(mockToolRead).toHaveBeenCalledTimes(1);
			expect(mockToolRead.mock.calls?.[0]?.[0]).toBe("labels-list");

			expect(mockToolWrite).toHaveBeenCalledTimes(1);
			expect(mockToolWrite.mock.calls?.[0]?.[0]).toBe("labels-create");
		});
	});

	describe("listLabels method", () => {
		const listLabelsMock = mock(async () => mockLabels);

		beforeEach(() => {
			listLabelsMock.mockClear();
		});

		test("should return formatted list of labels when labels exist", async () => {
			const mockClient = createMockClient({ listLabels: listLabelsMock });
			const labelTools = new LabelTools(mockClient);
			const result = await labelTools.listLabels({ includeArchived: true });

			expect(listLabelsMock).toHaveBeenCalled();

			const textContent = getTextContent(result);
			expect(textContent).toContain("Result (3 labels found):");
			expect(textContent).toContain('"id": 1');
			expect(textContent).toContain('"name": "bug"');
			expect(textContent).toContain('"id": 2');
			expect(textContent).toContain('"name": "feature"');
			expect(textContent).toContain('"id": 3');
			expect(textContent).toContain('"name": "archived-label"');
			expect(textContent).toContain('"archived": true');
		});

		test("should not return empty stats", async () => {
			const mockClient = createMockClient({ listLabels: listLabelsMock });
			const labelTools = new LabelTools(mockClient);
			const result = await labelTools.listLabels({ includeArchived: true });

			expect(listLabelsMock).toHaveBeenCalled();

			const textContent = getTextContent(result);
			expect(textContent).toContain("Result (3 labels found):");
			expect(textContent).toContain('"id": 1');
			expect(textContent).toContain('"id": 2');
			expect(textContent).toContain('"id": 3');
			expect(textContent).not.toContain("num_stories_unestimated");
			expect(textContent).not.toContain("num_stories_total");
			expect(textContent).not.toContain("num_stories_completed");
		});

		test("should not return archived state if set to false", async () => {
			const mockClient = createMockClient({ listLabels: listLabelsMock });
			const labelTools = new LabelTools(mockClient);
			const result = await labelTools.listLabels({ includeArchived: false });

			expect(listLabelsMock).toHaveBeenCalled();

			const textContent = getTextContent(result);
			expect(textContent).toContain("Result (3 labels found):");
			expect(textContent).toContain('"id": 1');
			expect(textContent).toContain('"id": 2');
			expect(textContent).toContain('"id": 3');
			expect(textContent).not.toContain('"archived":');
		});

		test("should return no labels found message when no labels exist", async () => {
			const emptyListMock = mock(async () => []);
			const mockClient = createMockClient({ listLabels: emptyListMock });
			const labelTools = new LabelTools(mockClient);
			const result = await labelTools.listLabels({ includeArchived: true });

			expect(getTextContent(result)).toBe("Result: No labels found.");
		});

		test("should return simplified label fields", async () => {
			const mockClient = createMockClient({ listLabels: listLabelsMock });
			const labelTools = new LabelTools(mockClient);
			const result = await labelTools.listLabels({ includeArchived: true });

			const textContent = getTextContent(result);

			// Should contain simplified fields
			expect(textContent).toContain('"id"');
			expect(textContent).toContain('"name"');
			expect(textContent).toContain('"app_url"');
			expect(textContent).toContain('"archived"');

			// Should NOT contain raw API fields that are excluded
			expect(textContent).not.toContain('"entity_type"');
			expect(textContent).not.toContain('"global_id"');
			expect(textContent).not.toContain('"created_at"');
		});

		test("should handle labels with null color and description", async () => {
			const labelsWithNulls: Label[] = [
				{
					entity_type: "label",
					id: 4,
					name: "minimal-label",
					color: null,
					description: null,
					archived: false,
					app_url: "https://app.shortcut.com/test/label/4",
					global_id: "global-4",
					created_at: "2024-01-04T00:00:00Z",
					updated_at: "2024-01-04T00:00:00Z",
					external_id: null,
					stats: {
						num_stories: 0,
						num_epics: 0,
					},
				} as unknown as Label,
			];

			const nullLabelsMock = mock(async () => labelsWithNulls);
			const mockClient = createMockClient({ listLabels: nullLabelsMock });
			const labelTools = new LabelTools(mockClient);
			const result = await labelTools.listLabels({ includeArchived: true });

			const textContent = getTextContent(result);
			expect(textContent).toContain('"name": "minimal-label"');
		});
	});

	describe("createLabel method", () => {
		const createLabelMock = mock(async (_: CreateLabelParams) => ({
			entity_type: "label",
			id: 10,
			name: "new-label",
			color: "#ff5500",
			description: "A new label",
			archived: false,
			app_url: "https://app.shortcut.com/test/label/10",
			global_id: "global-10",
			created_at: "2024-01-10T00:00:00Z",
			updated_at: "2024-01-10T00:00:00Z",
			external_id: null,
			stats: {
				num_stories: 0,
				num_epics: 0,
			},
		}));

		beforeEach(() => {
			createLabelMock.mockClear();
		});

		test("should create label with all parameters", async () => {
			const mockClient = createMockClient({ createLabel: createLabelMock });
			const labelTools = new LabelTools(mockClient);
			const result = await labelTools.createLabel({
				name: "new-label",
				color: "#ff5500",
				description: "A new label",
			});

			expect(createLabelMock).toHaveBeenCalledWith({
				name: "new-label",
				color: "#ff5500",
				description: "A new label",
			});

			const textContent = getTextContent(result);
			expect(textContent).toContain("Label created with ID: 10.");
			expect(textContent).toContain('"id": 10');
			expect(textContent).toContain('"name": "new-label"');
			expect(textContent).toContain('"description": "A new label"');
		});

		test("should create label with only required name parameter", async () => {
			const mockClient = createMockClient({ createLabel: createLabelMock });
			const labelTools = new LabelTools(mockClient);
			await labelTools.createLabel({
				name: "minimal-label",
			});

			expect(createLabelMock).toHaveBeenCalledWith({
				name: "minimal-label",
				color: undefined,
				description: undefined,
			});
		});

		test("should create label with name and color only", async () => {
			const mockClient = createMockClient({ createLabel: createLabelMock });
			const labelTools = new LabelTools(mockClient);
			await labelTools.createLabel({
				name: "colored-label",
				color: "#00ff00",
			});

			expect(createLabelMock).toHaveBeenCalledWith({
				name: "colored-label",
				color: "#00ff00",
				description: undefined,
			});
		});

		test("should create label with name and description only", async () => {
			const mockClient = createMockClient({ createLabel: createLabelMock });
			const labelTools = new LabelTools(mockClient);
			await labelTools.createLabel({
				name: "described-label",
				description: "A label with description",
			});

			expect(createLabelMock).toHaveBeenCalledWith({
				name: "described-label",
				color: undefined,
				description: "A label with description",
			});
		});

		test("should throw error when label creation fails", async () => {
			const failingMock = mock(async () => {
				throw new Error("Failed to create the label: 400");
			});
			const mockClient = createMockClient({ createLabel: failingMock });
			const labelTools = new LabelTools(mockClient);

			await expect(() => labelTools.createLabel({ name: "failing-label" })).toThrow(
				"Failed to create the label: 400",
			);
		});
	});
});
