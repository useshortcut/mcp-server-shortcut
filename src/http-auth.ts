interface OAuthErrorBody {
	error?: unknown;
	error_description?: unknown;
	tag?: unknown;
}

interface UpstreamHttpErrorShape {
	message?: unknown;
	response?: {
		status?: unknown;
		headers?: Record<string, unknown>;
		data?: unknown;
	};
}

export interface BearerAuthErrorDetails {
	error: string;
	errorDescription?: string;
	headerValue: string;
	tokenExpired: boolean;
}

/**
 * Structured auth error payload passed through MCP errors when a token failure
 * is discovered after a request has already entered tool execution.
 */
export interface BearerAuthErrorData {
	httpStatus: 401;
	headers: Record<string, string>;
	body: {
		error: string;
		error_description?: string;
	};
	isAuthenticationError: true;
	tokenExpired: boolean;
}

/**
 * Normalized bearer-token auth failure. This keeps the HTTP-style challenge and
 * JSON body together so callers can either return a real HTTP 401 or embed the
 * same details into an MCP error payload.
 */
export class BearerAuthError extends Error {
	readonly code = 401;
	readonly data: BearerAuthErrorData;

	constructor(public readonly details: BearerAuthErrorDetails) {
		super(details.errorDescription ?? details.error);
		this.name = "BearerAuthError";
		this.data = {
			httpStatus: 401,
			headers: {
				"Content-Type": "application/json",
				"WWW-Authenticate": details.headerValue,
			},
			body: {
				error: details.error,
				...(details.errorDescription ? { error_description: details.errorDescription } : {}),
			},
			isAuthenticationError: true,
			tokenExpired: details.tokenExpired,
		};
	}
}

function getHeaderValue(
	headers: Record<string, unknown> | undefined,
	headerName: string,
): string | undefined {
	if (!headers) return undefined;
	const match = Object.entries(headers).find(
		([name]) => name.toLowerCase() === headerName.toLowerCase(),
	)?.[1];
	if (typeof match === "string") return match;
	if (Array.isArray(match)) {
		const [first] = match;
		return typeof first === "string" ? first : undefined;
	}
	return undefined;
}

function parseHeaderParameters(headerValue: string | undefined): Record<string, string> {
	if (!headerValue) return {};
	return Array.from(headerValue.matchAll(/([a-z_]+)="([^"]*)"/gi)).reduce<Record<string, string>>(
		(acc, [, key, value]) => {
			acc[key.toLowerCase()] = value;
			return acc;
		},
		{},
	);
}

function parseOAuthErrorBody(data: unknown): OAuthErrorBody | undefined {
	if (!data) return undefined;
	if (typeof data === "object") {
		return data as OAuthErrorBody;
	}
	if (typeof data === "string") {
		try {
			return JSON.parse(data) as OAuthErrorBody;
		} catch {
			return undefined;
		}
	}
	return undefined;
}

function isGenericUnauthorizedMessage(message: string | undefined): boolean {
	if (!message) return false;
	return /^Request failed with status code 401$/i.test(message) || /^Unauthorized$/i.test(message);
}

/**
 * Formats a Bearer challenge suitable for the `WWW-Authenticate` header.
 */
export function buildBearerAuthHeader(error?: string, errorDescription?: string): string {
	const params: string[] = [];
	if (error) {
		params.push(`error="${error}"`);
	}
	if (errorDescription) {
		params.push(`error_description="${errorDescription.replaceAll('"', '\\"')}"`);
	}
	return params.length > 0 ? `Bearer ${params.join(", ")}` : "Bearer";
}

/**
 * Extracts an OAuth-style bearer auth error from upstream 401 responses. This
 * accepts either RFC-compliant `WWW-Authenticate` details or Shortcut's
 * lighter-weight JSON `invalid_token` shape and normalizes both.
 */
export function parseBearerAuthError(error: unknown): BearerAuthErrorDetails | null {
	if (error instanceof BearerAuthError) {
		return error.details;
	}

	const upstreamError = error as UpstreamHttpErrorShape;
	if (upstreamError?.response?.status !== 401) {
		return null;
	}

	const headerValue = getHeaderValue(upstreamError.response.headers, "www-authenticate");
	const headerParams = parseHeaderParameters(headerValue);
	const body = parseOAuthErrorBody(upstreamError.response.data);
	const errorCode =
		typeof body?.error === "string"
			? body.error
			: typeof body?.tag === "string"
				? body.tag
				: typeof headerParams.error === "string"
					? headerParams.error
					: undefined;
	const errorDescription =
		typeof body?.error_description === "string"
			? body.error_description
			: typeof headerParams.error_description === "string"
				? headerParams.error_description
				: typeof upstreamError.message === "string" &&
						!isGenericUnauthorizedMessage(upstreamError.message)
					? upstreamError.message
					: undefined;

	const tokenExpired = /expired/i.test(errorDescription ?? "");
	const invalidToken = errorCode === "invalid_token";

	if (!invalidToken && !tokenExpired) {
		return null;
	}

	const normalizedError = errorCode ?? "invalid_token";
	const normalizedDescription =
		errorDescription ??
		(tokenExpired || normalizedError === "invalid_token"
			? "The access token expired"
			: "The access token is invalid");

	return {
		error: normalizedError,
		errorDescription: normalizedDescription,
		headerValue: buildBearerAuthHeader(normalizedError, normalizedDescription),
		tokenExpired,
	};
}

/**
 * Converts an arbitrary upstream HTTP client error into a typed bearer auth
 * error when it represents an `invalid_token`-style 401 response.
 */
export function toBearerAuthError(error: unknown): BearerAuthError | null {
	const details = parseBearerAuthError(error);
	return details ? new BearerAuthError(details) : null;
}
