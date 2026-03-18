import { describe, expect, mock, test } from "bun:test";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";

interface MockResponse {
	statusCode: number;
	headers: Record<string, string>;
	_data?: unknown;
	headersSent: boolean;
	status: (code: number) => MockResponse;
	json: (data: unknown) => MockResponse;
	header: (name: string, value: string) => MockResponse;
}

function createMockResponse(): MockResponse {
	const res: MockResponse = {
		statusCode: 200,
		headers: {},
		headersSent: false,
		status(code: number) {
			this.statusCode = code;
			return this;
		},
		json(data: unknown) {
			this._data = data;
			this.headersSent = true;
			return this;
		},
		header(name: string, value: string) {
			this.headers[name] = value;
			return this;
		},
	};

	return res;
}

const { preflightVerifyAccessToken } = await import("./server-http");

describe("server-http preflight auth", () => {
	test("allows requests with a valid bearer token", async () => {
		const verifyPresentedAccessToken = mock(async (_token: string) => undefined);
		verifyPresentedAccessToken.mockResolvedValueOnce(undefined);
		const res = createMockResponse();

		const allowed = await preflightVerifyAccessToken(
			"valid-token",
			res as never,
			verifyPresentedAccessToken,
		);

		expect(allowed).toBe(true);
		expect(res.headersSent).toBe(false);
		expect(verifyPresentedAccessToken).toHaveBeenCalledWith("valid-token");
	});

	test("returns a real 401 challenge for expired bearer tokens", async () => {
		const verifyPresentedAccessToken = mock(async (_token: string) => undefined);
		verifyPresentedAccessToken.mockRejectedValueOnce(new InvalidTokenError("Token has expired"));
		const res = createMockResponse();

		const allowed = await preflightVerifyAccessToken(
			"expired-token",
			res as never,
			verifyPresentedAccessToken,
		);

		expect(allowed).toBe(false);
		expect(res.statusCode).toBe(401);
		expect(res.headers["WWW-Authenticate"]).toBe(
			'Bearer error="invalid_token", error_description="The access token expired"',
		);
		expect(res._data).toEqual({
			error: "invalid_token",
			error_description: "The access token expired",
		});
	});
});
