import type { MemberInfo } from "@shortcut/client";

const keyRenames = { team: "group", name: "title" } as const;

const mapKeyName = (key: string) => {
	const lowercaseKey = key.toLowerCase();

	return keyRenames[lowercaseKey as keyof typeof keyRenames] || lowercaseKey;
};

const getKey = (prop: string) => {
	if (prop.startsWith("is")) return `is:${mapKeyName(prop.slice(2))}`;
	if (prop.startsWith("has")) return `has:${mapKeyName(prop.slice(3))}`;
	return mapKeyName(prop);
};

export type QueryParams = { [key: string]: boolean | string | number };

export const buildSearchQuery = async (params: QueryParams, currentUser: MemberInfo | null) => {
	const query = Object.entries(params)
		.map(([key, value]) => {
			const q = getKey(key);
			if (key === "owner" || key === "requester") {
				if (value === "me") return `${q}:${currentUser?.mention_name || value}`;
				return `${q}:${String(value || "").replace(/^@/, "")}`;
			}

			if (typeof value === "boolean") return value ? q : `!${q}`;
			if (typeof value === "number") return `${q}:${value}`;
			if (typeof value === "string" && value.includes(" ")) return `${q}:"${value}"`;
			return `${q}:${value}`;
		})
		.join(" ");

	return query;
};
