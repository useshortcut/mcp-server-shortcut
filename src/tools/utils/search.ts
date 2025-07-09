import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { MemberInfo } from "@shortcut/client";

const getKey = (prop: string) => {
	if (prop.startsWith("is")) return `is:${prop.slice(2).toLowerCase()}`;
	if (prop.startsWith("has")) return `has:${prop.slice(3).toLowerCase()}`;
	return prop;
};

export type QueryParams = { [key: string]: boolean | string | number };

const processUserParam = (key: string, value: string, currentUser: MemberInfo | null): string => {
	const q = getKey(key);
	return value === "me" ? `${q}:${currentUser?.mention_name || value}` : `${q}:${value}`;
};

const processTeamParam = async (value: string, client?: ShortcutClientWrapper): Promise<string> => {
	if (!client) return `team:${value}`;

	try {
		const teams = await client.getTeams();
		const team = teams.find((t) => t.name.toLowerCase() === value.toLowerCase());
		return team ? `group:${team.id}` : `team:${value}`;
	} catch (error) {
		return `team:${value}`;
	}
};

const formatValue = (key: string, value: boolean | string | number): string => {
	const q = getKey(key);

	if (typeof value === "boolean") return value ? q : `!${q}`;
	if (typeof value === "number") return `${q}:${value}`;
	if (typeof value === "string" && value.includes(" ")) return `${q}:"${value}"`;
	return `${q}:${value}`;
};

export const buildSearchQuery = async (
	params: QueryParams,
	currentUser: MemberInfo | null,
	client?: ShortcutClientWrapper,
) => {
	const processedParams = await Promise.all(
		Object.entries(params).map(async ([key, value]) => {
			if ((key === "owner" || key === "requester") && typeof value === "string") {
				return processUserParam(key, value, currentUser);
			}

			if (key === "team" && typeof value === "string") {
				return await processTeamParam(value, client);
			}

			return formatValue(key, value);
		}),
	);

	return processedParams.join(" ");
};
