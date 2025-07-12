import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { MemberInfo } from "@shortcut/client";

const keyRenames = { name: "title" } as const;

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

export const buildSearchQuery = async (
	params: QueryParams,
	currentUser: MemberInfo | null,
	client?: ShortcutClientWrapper,
) => {
	const resolvedParams = { ...params };

	// Resolve project name to project ID if needed
	if (resolvedParams.project && typeof resolvedParams.project === "string" && client) {
		try {
			const projects = await client.listProjects();
			const project = projects.find(
				(p) => p.name.toLowerCase() === resolvedParams.project.toString().toLowerCase(),
			);
			if (project) {
				resolvedParams.project = project.id;
			}
		} catch (error) {
			// If project resolution fails, keep the original value
			console.warn(`Failed to resolve project name "${resolvedParams.project}":`, error);
		}
	}

	const query = Object.entries(resolvedParams)
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
