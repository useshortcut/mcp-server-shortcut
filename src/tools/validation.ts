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

export const date = z
	.string()
	.regex(DATE_REGEXP)
	.optional()
	.describe(
		'The date in "YYYY-MM-DD" format, or one of the keywords: "yesterday", "today", "tomorrow", or a date range in the format "YYYY-MM-DD..YYYY-MM-DD". The date range can also be open ended by using "*" for one of the bounds. The date range can also use the keywords, but the range has to be open ended when keywords are used. For relative dates. The keywords cannot be used to calculate relative dates (e.g. the following are not valid: "today-1" or "tomorrow+1").',
	);

export const is = (field: string) =>
	z
		.boolean()
		.optional()
		.describe(
			`Find only entities that are ${field} when true, or only entities that are not ${field} when false.`,
		);

export const has = (field: string) =>
	z
		.boolean()
		.optional()
		.describe(
			`Find only entities that have ${field} when true, or only entities that do not have ${field} when false.`,
		);

export const owner = z
	.string()
	.optional()
	.describe(
		'Find entities where the owners match the specified user. This should either be the user\'s mention name or the keyword "me" for the current user.',
	);

export const requester = z
	.string()
	.optional()
	.describe(
		'Find entities where requesters match the specified user. This should either be the user\'s mention name or the keyword "me" for the current user.',
	);
