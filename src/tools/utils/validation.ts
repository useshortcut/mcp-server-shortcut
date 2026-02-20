import { z } from "zod";

const dateformat = "\\d{4}-\\d{2}-\\d{2}";
const range = ({
	f = "\\*",
	t = "\\*",
}: { f?: never; t?: string } | { f?: string; t?: never } | { f?: string; t?: string }) =>
	`${f}\\.\\.${t}`;

const variations = [
	"today",
	"tomorrow",
	"yesterday",
	dateformat,
	range({ f: "today" }),
	range({ t: "today" }),
	range({ f: "yesterday" }),
	range({ t: "yesterday" }),
	range({ f: "tomorrow" }),
	range({ t: "tomorrow" }),
	range({ f: dateformat }),
	range({ t: dateformat }),
	range({ f: dateformat, t: dateformat }),
];

const DATE_REGEXP = new RegExp(`^(${variations.join("|")})$`);

export const date = () =>
	z
		.string()
		.regex(DATE_REGEXP)
		.optional()
		.describe(
			'Date filter: "YYYY-MM-DD", "today", "yesterday", "tomorrow", or range "YYYY-MM-DD..YYYY-MM-DD" (use * for open bounds)',
		);

export const is = (field: string) => z.boolean().optional().describe(`Filter by ${field} status`);

export const has = (field: string) =>
	z.boolean().optional().describe(`Filter by presence of ${field}`);

export const user = (field: string) =>
	z.string().optional().describe(`Filter by ${field} (use mention name or "me")`);
