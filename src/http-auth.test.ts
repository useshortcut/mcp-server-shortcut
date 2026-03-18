import { describe, expect, test } from "bun:test";
import {
	BearerAuthError,
	buildBearerAuthHeader,
	parseBearerAuthError,
	toBearerAuthError,
} from "./http-auth";

describe("http-auth", () => {
	test("builds a bare bearer challenge when no details are provided", () => {
		expect(buildBearerAuthHeader()).toBe("Bearer");
	});

	test("builds a bearer challenge with invalid_token details", () => {
		expect(buildBearerAuthHeader("invalid_token", "The access token expired")).toBe(
			'Bearer error="invalid_token", error_description="The access token expired"',
		);
	});

	test("parses an upstream expired-token response body", () => {
		const authError = parseBearerAuthError({
			response: {
				status: 401,
				headers: {
					"www-authenticate": 'Bearer error="invalid_token"',
				},
				data: {
					error: "invalid_token",
					error_description: "The access token expired",
				},
			},
		});

		expect(authError).toEqual({
			error: "invalid_token",
			errorDescription: "The access token expired",
			headerValue: 'Bearer error="invalid_token", error_description="The access token expired"',
			tokenExpired: true,
		});
	});

	test("parses an upstream invalid token from challenge headers alone", () => {
		const authError = parseBearerAuthError({
			response: {
				status: 401,
				headers: {
					"WWW-Authenticate":
						'Bearer error="invalid_token", error_description="The access token is invalid"',
				},
			},
		});

		expect(authError).toEqual({
			error: "invalid_token",
			errorDescription: "The access token is invalid",
			headerValue:
				'Bearer error="invalid_token", error_description="The access token is invalid"',
			tokenExpired: false,
		});
	});

	test("parses Shortcut invalid_token tags without an error description", () => {
		const authError = parseBearerAuthError({
			response: {
				status: 401,
				data: {
					error: "invalid_token",
					tag: "invalid_token",
				},
			},
		});

		expect(authError).toEqual({
			error: "invalid_token",
			errorDescription: "The access token expired",
			headerValue: 'Bearer error="invalid_token", error_description="The access token expired"',
			tokenExpired: false,
		});
	});

	test("converts upstream invalid_token failures into a typed auth error", () => {
		const authError = toBearerAuthError({
			response: {
				status: 401,
				data: {
					error: "invalid_token",
					tag: "invalid_token",
				},
			},
		});

		expect(authError).toBeInstanceOf(BearerAuthError);
		expect(authError?.data).toEqual({
			httpStatus: 401,
			headers: {
				"Content-Type": "application/json",
				"WWW-Authenticate":
					'Bearer error="invalid_token", error_description="The access token expired"',
			},
			body: {
				error: "invalid_token",
				error_description: "The access token expired",
			},
			isAuthenticationError: true,
			tokenExpired: false,
		});
	});

	test("ignores unrelated 401 responses", () => {
		expect(
			parseBearerAuthError({
				response: {
					status: 401,
					data: {
						error: "access_denied",
						error_description: "You do not have access",
					},
				},
			}),
		).toBeNull();
	});
});
