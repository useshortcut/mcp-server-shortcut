import { type Mock, mock } from "bun:test";

const users = {
	"1": {
		id: "1",
		mention_name: "dyson",
		name: "Miles Dyson",
		email_address: "miles.dyson@cyberdyne.com",
	},
	"2": {
		id: "2",
		mention_name: "bw",
		name: "Blair Williams",
		email_address: "bwilliams@resistance.org",
	},
};

mock.module("@shortcut/client", () => {
	const client = {
		getCurrentMemberInfo: mock(async () => ({ data: users["1"] })),
		getMember: mock(async (id: string) => ({ data: users[id] || null })),
		listMembers: mock(async () => ({ data: Object.values(users) })),
		listWorkflows: mock(async () => ({
			data: new Array(2).fill(null).map((_, i) => ({ id: i + 1, name: `Workflow ${i + 1}` })),
		})),
		getWorkflow: mock(async (id: number) => ({ data: { id, name: `Workflow ${id}` } })),
		listGroups: mock(async () => ({
			data: new Array(2).fill(null).map((_, i) => ({ id: String(i + 1), name: `Team ${i + 1}` })),
		})),
		getGroup: mock(async (id: string) => ({ data: { id, name: `Team ${id}` } })),
		createStory: mock(async (props) => ({ data: { ...props, id: "1" } })),
		updateStory: mock(async (id, props) => ({ data: { ...props, id } })),
		getStory: mock(async (id) => ({ data: { id, name: `Story ${id}` } })),
		getEpic: mock(async (id) => ({ data: { id, name: `Epic ${id}` } })),
		getIteration: mock(async (id) => ({ data: { id, name: `Iteration ${id}` } })),
		getMilestone: mock(async (id) => ({ data: { id, name: `Milestone ${id}` } })),
		searchStories: mock(async () => ({
			data: { data: [{ id: 1, name: `Story ${1}` }], total: 1 },
		})),
		searchIterations: mock(async () => ({
			data: { data: [{ id: 1, name: `Iteration ${1}` }], total: 1 },
		})),
		searchEpics: mock(async () => ({ data: { data: [{ id: 1, name: `Epic ${1}` }], total: 1 } })),
		searchMilestones: mock(async () => ({
			data: { data: [{ id: 1, name: `Milestone ${1}` }], total: 1 },
		})),
		listIterationStories: mock(async () => ({ data: [{ id: 1, name: `Story ${1}` }], total: 1 })),
	};

	function ShortcutClient() {
		return client;
	}

	ShortcutClient.clearAll = () => {
		for (const mock of Object.values(client)) {
			(mock as Mock<() => Promise<unknown>>).mockClear();
		}
	};

	return { ShortcutClient };
});
