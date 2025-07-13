import { describe, expect, mock, spyOn, test } from "bun:test";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Group, Member, Workflow } from "@shortcut/client";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import { TeamTools } from "./teams";

describe("TeamTools", () => {
	const mockMembers: Member[] = [
		{
			id: "user1",
			profile: {
				mention_name: "john",
				name: "John Doe",
				email_address: "john@example.com",
			},
		} as Member,
		{
			id: "user2",
			profile: {
				mention_name: "jane",
				name: "Jane Smith",
				email_address: "jane@example.com",
			},
		} as Member,
	];

	const mockTeams: Group[] = [
		{
			entity_type: "group",
			id: "team1",
			name: "Team 1",
			mention_name: "team-one",
			description: "Description for Team 1",
			archived: false,
			app_url: "https://app.shortcut.com/test/team/team1",
			global_id: "team1",
			member_ids: ["user1", "user2"],
			workflow_ids: [1, 2],
		} as Group,
		{
			entity_type: "group",
			id: "team2",
			name: "Team 2",
			mention_name: "team-two",
			description: "Description for Team 2",
			archived: false,
			app_url: "https://app.shortcut.com/test/team/team2",
			global_id: "team2",
			member_ids: ["user1"],
			workflow_ids: [1],
		} as Group,
	];

	const mockWorkflows: Workflow[] = [
		{
			id: 1,
			name: "Workflow 1",
			description: "Description for Workflow 1",
			default_state_id: 101,
			states: [
				{ id: 101, name: "Unstarted", type: "unstarted" },
				{ id: 102, name: "Started", type: "started" },
			],
		} as Workflow,
		{
			id: 2,
			name: "Workflow 2",
			description: "Description for Workflow 2",
			default_state_id: 201,
			states: [
				{ id: 201, name: "Backlog", type: "unstarted" },
				{ id: 202, name: "In Progress", type: "started" },
			],
		} as Workflow,
	];

	describe("create method", () => {
		test("should register the correct tools with the server", () => {
			const mockClient = {} as ShortcutClientWrapper;
			const mockTool = mock();
			const mockServer = { tool: mockTool } as unknown as McpServer;

			TeamTools.create(mockClient, mockServer);

			expect(mockTool).toHaveBeenCalledTimes(2);

			expect(mockTool.mock.calls?.[0]?.[0]).toBe("get_team");
			expect(mockTool.mock.calls?.[1]?.[0]).toBe("list_teams");
		});

		test("should call correct function from tool", async () => {
			const mockClient = {} as ShortcutClientWrapper;
			const mockTool = mock();
			const mockServer = { tool: mockTool } as unknown as McpServer;

			const tools = TeamTools.create(mockClient, mockServer);

			spyOn(tools, "getTeam").mockImplementation(async () => ({
				content: [{ text: "", type: "text" }],
			}));
			await mockTool.mock.calls?.[0]?.[3]({ teamPublicId: "team1" });
			expect(tools.getTeam).toHaveBeenCalledWith("team1");

			spyOn(tools, "listTeams").mockImplementation(async () => ({
				content: [{ text: "", type: "text" }],
			}));
			await mockTool.mock.calls?.[1]?.[2]();
			expect(tools.listTeams).toHaveBeenCalled();
		});
	});

	describe("getTeam method", () => {
		const getTeamMock = mock(async (id: string) => mockTeams.find((team) => team.id === id));
		const getUserMapMock = mock(async (ids: string[]) => {
			const map = new Map<string, Member>();
			for (const id of ids) {
				const member = mockMembers.find((m) => m.id === id);
				if (member) map.set(id, member);
			}
			return map;
		});

		const mockClient = {
			getTeam: getTeamMock,
			getUserMap: getUserMapMock,
			getWorkflowMap: mock(async () => new Map()),
		} as unknown as ShortcutClientWrapper;

		test("should return formatted team details when team is found", async () => {
			const teamTools = new TeamTools(mockClient);
			const result = await teamTools.getTeam("team1");

			expect(result.content[0].type).toBe("text");
			const textContent = String(result.content[0].text);
			expect(textContent).toContain("Team: team1");
			expect(textContent).toContain('"id": "team1"');
			expect(textContent).toContain('"name": "Team 1"');
			expect(textContent).toContain('"mention_name": "team-one"');
			expect(textContent).toContain('"description": "Description for Team 1"');
			expect(textContent).toContain('"member_ids"');
		});

		test("should handle team not found", async () => {
			const teamTools = new TeamTools({
				getTeam: mock(async () => null),
			} as unknown as ShortcutClientWrapper);

			const result = await teamTools.getTeam("nonexistent");

			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toBe("Team with public ID: nonexistent not found.");
		});

		test("should handle team with no members", async () => {
			const teamTools = new TeamTools({
				getTeam: mock(async () => ({
					...mockTeams[0],
					member_ids: [],
				})),
				getUserMap: getUserMapMock,
				getWorkflowMap: mock(async () => new Map()),
				getTeamMap: mock(async () => new Map()),
				getIteration: mock(async () => null),
				getEpic: mock(async () => null),
				getMilestone: mock(async () => null),
			} as unknown as ShortcutClientWrapper);

			const result = await teamTools.getTeam("team1");

			expect(result.content[0].type).toBe("text");
			const textContent = String(result.content[0].text);
			expect(textContent).toContain("Team: team1");
			expect(textContent).toContain('"id": "team1"');
			expect(textContent).toContain('"name": "Team 1"');
			expect(textContent).toContain('"mention_name": "team-one"');
			expect(textContent).toContain('"description": "Description for Team 1"');
			expect(textContent).toContain('"member_ids": []');
		});
	});

	describe("getTeams method", () => {
		const getTeamsMock = mock(async () => mockTeams);
		const getWorkflowMapMock = mock(async (ids: number[]) => {
			const map = new Map<number, Workflow>();
			for (const id of ids) {
				const workflow = mockWorkflows.find((w) => w.id === id);
				if (workflow) map.set(id, workflow);
			}
			return map;
		});

		const mockClient = {
			getTeams: getTeamsMock,
			getWorkflowMap: getWorkflowMapMock,
			getUserMap: mock(async () => new Map()),
			getTeamMap: mock(async () => new Map()),
		} as unknown as ShortcutClientWrapper;

		test("should return formatted list of teams when teams are found", async () => {
			const teamTools = new TeamTools(mockClient);
			const result = await teamTools.getTeams();

			expect(result.content[0].type).toBe("text");
			const textContent = String(result.content[0].text);
			expect(textContent).toContain("Result (first 2 shown of 2 total teams found):");
			expect(textContent).toContain('"id": "team1"');
			expect(textContent).toContain('"name": "Team 1"');
			expect(textContent).toContain('"id": "team2"');
			expect(textContent).toContain('"name": "Team 2"');
		});

		test("should return no teams found message when no teams exist", async () => {
			const teamTools = new TeamTools({
				getTeams: mock(async () => []),
			} as unknown as ShortcutClientWrapper);

			const result = await teamTools.getTeams();

			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toBe("No teams found.");
		});

		test("should handle team with no workflows", async () => {
			const teamTools = new TeamTools({
				getTeams: mock(async () => [
					{
						...mockTeams[0],
						workflow_ids: [],
					},
				]),
				getWorkflowMap: getWorkflowMapMock,
				getUserMap: mock(async () => new Map()),
				getTeamMap: mock(async () => new Map()),
			} as unknown as ShortcutClientWrapper);

			const result = await teamTools.getTeams();

			expect(result.content[0].type).toBe("text");
			const textContent = String(result.content[0].text);
			expect(textContent).toContain("Result (first 1 shown of 1 total teams found):");
			expect(textContent).toContain('"id": "team1"');
			expect(textContent).toContain('"name": "Team 1"');
			expect(textContent).toContain('"workflow_ids": []');
		});
	});
});
