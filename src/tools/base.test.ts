import { describe, expect, mock, test } from "bun:test";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { Story } from "@shortcut/client";
import { BaseTools } from "./base";

describe("BaseTools", () => {
	class TestTools extends BaseTools {
		publicToCorrectedEntity(entity: unknown) {
			return this.toCorrectedEntity(entity as Story);
		}

		publicToResult(str: string) {
			return this.toResult(str);
		}
	}

	test("toCorrectedEntity", async () => {
		const workflow = { id: 1, name: "Test Workflow" };
		const user = {
			id: "2",
			name: "Test User",
			email_address: "test@example.com",
			mention_name: "test",
			role: "member",
			disabled: false,
		};
		const team = {
			id: "1",
			name: "Test Team",
			mention_name: "test",
			disabled: false,
			members: [user],
			workflows: [workflow],
		};

		const tools = new TestTools({
			getUserMap: mock(
				async () =>
					new Map([
						[
							"2",
							{
								id: user.id,
								disabled: user.disabled,
								role: user.role,
								profile: {
									name: user.name,
									email_address: user.email_address,
									mention_name: user.mention_name,
								},
							},
						],
					]),
			),
			getTeamMap: mock(
				async () =>
					new Map([
						[
							"1",
							{
								id: team.id,
								name: team.name,
								mention_name: team.mention_name,
								disabled: team.disabled,
								member_ids: team.members.map((member) => member.id),
								workflow_ids: team.workflows.map((workflow) => workflow.id),
							},
						],
					]),
			),
			getWorkflowMap: mock(async () => new Map([[1, workflow]])),
		} as unknown as ShortcutClientWrapper);

		const result = (await tools.publicToCorrectedEntity({
			entity_type: "story",
			group_id: "1",
			owner_ids: ["2", "3"],
			workflow_id: 1,
			requested_by_id: "2",
			follower_ids: ["2", "3"],
		} as unknown as Story)) as unknown as Story & {
			team: unknown;
			owners: unknown[];
			requested_by: unknown | null;
			followers: unknown[];
		};

		expect(result.group_id).toBeUndefined();
		expect(result.owner_ids).toBeUndefined();
		expect(result.follower_ids).toBeUndefined();
		expect(result.requested_by_id).toBeUndefined();
		expect(result.workflow_id).toBeUndefined();

		expect(result.team).toMatchObject(team);
		expect(result.owners).toMatchObject([user]);
		expect(result.requested_by).toMatchObject(user);
		expect(result.followers).toMatchObject([user]);
	});

	test("toResult", () => {
		const tools = new TestTools({} as ShortcutClientWrapper);

		const result = tools.publicToResult("test");

		expect(result).toEqual({ content: [{ type: "text", text: "test" }] });
	});
});
