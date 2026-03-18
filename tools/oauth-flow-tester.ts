#!/usr/bin/env bun

import { spawn } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import * as oauth from "oauth4webapi";

type Mode = "local-callback" | "manual-paste" | "both";

interface CliOptions {
	resourceUrl: string;
	redirectUri: string;
	clientName: string;
	clientUri: string;
	scope?: string;
	mode: Mode;
	timeoutMs: number;
	openBrowser: boolean;
}

interface RegisteredClient {
	client_id: string;
	client_secret?: string;
	token_endpoint_auth_method?: string;
	redirect_uris?: string[];
	grant_types?: string[];
	response_types?: string[];
	scope?: string;
	client_name?: string;
	client_uri?: string;
	client_id_issued_at?: number;
	client_secret_expires_at?: number;
	[key: string]: unknown;
}

interface TokenResponse {
	access_token: string;
	token_type?: string;
	scope?: string;
	refresh_token?: string;
	id_token?: string;
	expires_in?: number;
	[key: string]: unknown;
}

const HELP_TEXT = `OAuth flow test tool

Usage:
  bun run tools/oauth-flow-tester.ts [options]

Options:
  --resource-url <url>    Protected resource URL. Default: http://localhost:9292/mcp
  --redirect-uri <url>    Redirect URI to register and listen on. Default: http://localhost:6274/oauth/callback/debug
  --client-name <name>    Dynamic registration client_name. Default: MCP OAuth Test Tool
  --client-uri <url>      Dynamic registration client_uri. Default: https://github.com/useshortcut/mcp-server-shortcut
  --scope <scope>         Requested OAuth scope. Default: first supported scope or openid
  --mode <mode>           local-callback | manual-paste | both. Default: both
  --timeout-ms <ms>       Local callback wait timeout. Default: 180000
  --no-open-browser       Do not try to open the browser automatically
  --help                  Show this help
`;

function parseArgs(argv: string[]): CliOptions {
	const options: CliOptions = {
		resourceUrl: "http://localhost:9292/mcp",
		redirectUri: "http://localhost:6274/oauth/callback/debug",
		clientName: "MCP OAuth Test Tool",
		clientUri: "https://github.com/useshortcut/mcp-server-shortcut",
		mode: "both",
		timeoutMs: 180_000,
		openBrowser: true,
	};

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (!arg?.startsWith("--")) continue;

		switch (arg) {
			case "--resource-url":
				options.resourceUrl = readArgValue(argv, ++i, arg);
				break;
			case "--redirect-uri":
				options.redirectUri = readArgValue(argv, ++i, arg);
				break;
			case "--client-name":
				options.clientName = readArgValue(argv, ++i, arg);
				break;
			case "--client-uri":
				options.clientUri = readArgValue(argv, ++i, arg);
				break;
			case "--scope":
				options.scope = readArgValue(argv, ++i, arg);
				break;
			case "--mode": {
				const mode = readArgValue(argv, ++i, arg) as Mode;
				if (!["local-callback", "manual-paste", "both"].includes(mode)) {
					throw new Error(`Invalid --mode value: ${mode}`);
				}
				options.mode = mode;
				break;
			}
			case "--timeout-ms":
				options.timeoutMs = Number.parseInt(readArgValue(argv, ++i, arg), 10);
				if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
					throw new Error(`Invalid --timeout-ms value: ${argv[i]}`);
				}
				break;
			case "--no-open-browser":
				options.openBrowser = false;
				break;
			case "--help":
				console.log(HELP_TEXT);
				process.exit(0);
			default:
				throw new Error(`Unknown argument: ${arg}`);
		}
	}

	return options;
}

function readArgValue(argv: string[], index: number, argName: string): string {
	const value = argv[index];
	if (!value || value.startsWith("--")) {
		throw new Error(`Missing value for ${argName}`);
	}
	return value;
}

function printSection(title: string): void {
	console.log(`\n## ${title}`);
}

function printJson(label: string, value: unknown): void {
	console.log(`\n${label}`);
	console.log(JSON.stringify(value, null, 2));
}

function buildAuthorizationUrl(params: {
	authorizationEndpoint: string;
	clientId: string;
	redirectUri: string;
	codeChallenge: string;
	state: string;
	scope: string;
	resource: string;
}): URL {
	const url = new URL(params.authorizationEndpoint);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("client_id", params.clientId);
	url.searchParams.set("code_challenge", params.codeChallenge);
	url.searchParams.set("code_challenge_method", "S256");
	url.searchParams.set("redirect_uri", params.redirectUri);
	url.searchParams.set("state", params.state);
	url.searchParams.set("scope", params.scope);
	url.searchParams.set("resource", params.resource);
	return url;
}

function createClientAuth(registeredClient: RegisteredClient): oauth.ClientAuth {
	const method = registeredClient.token_endpoint_auth_method ?? "client_secret_post";
	if (method === "client_secret_post") {
		if (!registeredClient.client_secret) {
			throw new Error("Registered client did not return a client_secret");
		}
		return oauth.ClientSecretPost(registeredClient.client_secret);
	}
	if (method === "client_secret_basic") {
		if (!registeredClient.client_secret) {
			throw new Error("Registered client did not return a client_secret");
		}
		return oauth.ClientSecretBasic(registeredClient.client_secret);
	}
	if (method === "none") {
		return oauth.None();
	}

	throw new Error(`Unsupported token_endpoint_auth_method: ${method}`);
}

function isLocalhostRedirect(redirectUrl: URL): boolean {
	return ["localhost", "127.0.0.1", "::1"].includes(redirectUrl.hostname);
}

async function tryOpenBrowser(url: string): Promise<void> {
	const command =
		process.platform === "darwin"
			? ["open", url]
			: process.platform === "win32"
				? ["cmd", "/c", "start", "", url]
				: ["xdg-open", url];

	try {
		const child = spawn(command[0], command.slice(1), {
			detached: true,
			stdio: "ignore",
		});
		child.unref();
		console.log("\nOpened authorization URL in your browser.");
	} catch (error) {
		console.warn(
			`\nCould not open the browser automatically: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	}
}

async function waitForLocalCallback(
	redirectUrl: URL,
	timeoutMs: number,
): Promise<URL | null> {
	if (!isLocalhostRedirect(redirectUrl)) {
		return null;
	}

	const callbackUrl = await new Promise<URL | null>((resolve, reject) => {
		let settled = false;
		const server = createServer((req: IncomingMessage, res: ServerResponse) => {
			try {
				const incomingUrl = new URL(
					req.url ?? "/",
					`${redirectUrl.protocol}//${redirectUrl.host}`,
				);
				if (incomingUrl.pathname !== redirectUrl.pathname) {
					res.statusCode = 404;
					res.end("Not found");
					return;
				}

				res.statusCode = 200;
				res.setHeader("Content-Type", "text/html; charset=utf-8");
				res.end(
					"<html><body><h1>Authorization received</h1><p>You can return to the terminal.</p></body></html>",
				);

				if (!settled) {
					settled = true;
					resolve(incomingUrl);
				}
				void server.close();
			} catch (error) {
				if (!settled) {
					settled = true;
					reject(error);
				}
				void server.close();
			}
		});

		server.on("error", (error) => {
			if (!settled) {
				settled = true;
				reject(error);
			}
		});

		server.listen(Number.parseInt(redirectUrl.port || "80", 10), redirectUrl.hostname, () => {
			const timer = setTimeout(() => {
				if (!settled) {
					settled = true;
					resolve(null);
				}
				void server.close();
			}, timeoutMs);

			server.on("close", () => {
				clearTimeout(timer);
			});
		});
	});

	return callbackUrl;
}

async function promptForRedirect(redirectUri: string): Promise<URL> {
	const rl = createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	try {
		const value = (
			await rl.question(
				"\nPaste the full redirect URL or just the authorization code, then press Enter:\n> ",
			)
		).trim();

		if (!value) {
			throw new Error("No authorization response was provided");
		}

		if (value.startsWith("http://") || value.startsWith("https://")) {
			return new URL(value);
		}

		const manualUrl = new URL(redirectUri);
		manualUrl.searchParams.set("code", value);
		return manualUrl;
	} finally {
		rl.close();
	}
}

async function getAuthorizationResponseUrl(
	options: CliOptions,
	authorizationUrl: URL,
): Promise<URL> {
	const redirectUrl = new URL(options.redirectUri);

	if (options.openBrowser) {
		await tryOpenBrowser(authorizationUrl.toString());
	}

	console.log("\nAuthorization URL:");
	console.log(authorizationUrl.toString());

	if (options.mode !== "manual-paste" && isLocalhostRedirect(redirectUrl)) {
		console.log(
			`\nWaiting up to ${Math.round(options.timeoutMs / 1000)}s for a callback on ${options.redirectUri} ...`,
		);
		const callbackUrl = await waitForLocalCallback(redirectUrl, options.timeoutMs);
		if (callbackUrl) {
			console.log("\nCaptured authorization callback automatically.");
			return callbackUrl;
		}
		console.log("\nAutomatic callback capture timed out.");
	}

	if (options.mode === "local-callback") {
		throw new Error("Did not receive a local callback before timing out");
	}

	return promptForRedirect(options.redirectUri);
}

async function main(): Promise<void> {
	const options = parseArgs(process.argv.slice(2));
	const resourceUrl = new URL(options.resourceUrl);
	const redirectUrl = new URL(options.redirectUri);

	printSection("Metadata Discovery");
	const resourceMetadataResponse = await oauth.resourceDiscoveryRequest(resourceUrl, {
		[oauth.allowInsecureRequests]: resourceUrl.protocol === "http:",
	});
	const resourceMetadata = await oauth.processResourceDiscoveryResponse(
		resourceUrl,
		resourceMetadataResponse,
	);
	printJson(`Resource Metadata (${resourceUrl.toString()})`, resourceMetadata);

	const authorizationServer = resourceMetadata.authorization_servers?.[0];
	if (!authorizationServer) {
		throw new Error("Resource metadata did not advertise an authorization server");
	}

	const issuer = new URL(authorizationServer);
	const authorizationServerResponse = await oauth.discoveryRequest(issuer, {
		algorithm: "oauth2",
	});
	const authorizationServerMetadata = await oauth.processDiscoveryResponse(
		issuer,
		authorizationServerResponse,
	);
	printJson(
		`Authorization Server Metadata (${issuer.toString()})`,
		authorizationServerMetadata,
	);

	printSection("Client Registration");
	const requestedScope = options.scope ?? resourceMetadata.scopes_supported?.[0] ?? "openid";
	const registrationResponse = await oauth.dynamicClientRegistrationRequest(
		authorizationServerMetadata,
		{
			redirect_uris: [redirectUrl.toString()],
			token_endpoint_auth_method:
				authorizationServerMetadata.token_endpoint_auth_methods_supported?.includes(
					"client_secret_post",
				)
					? "client_secret_post"
					: "none",
			grant_types: ["authorization_code", "refresh_token"],
			response_types: ["code"],
			client_name: options.clientName,
			client_uri: options.clientUri,
			scope: requestedScope,
		},
	);
	const registeredClient = (await oauth.processDynamicClientRegistrationResponse(
		registrationResponse,
	)) as RegisteredClient;
	printJson("Registered Client Information", registeredClient);

	printSection("Preparing Authorization");
	const codeVerifier = oauth.generateRandomCodeVerifier();
	const codeChallenge = await oauth.calculatePKCECodeChallenge(codeVerifier);
	const state = oauth.generateRandomState();
	const client: oauth.Client = { client_id: registeredClient.client_id };
	const clientAuth = createClientAuth(registeredClient);

	const authorizationUrl = buildAuthorizationUrl({
		authorizationEndpoint: authorizationServerMetadata.authorization_endpoint!,
		clientId: registeredClient.client_id,
		redirectUri: redirectUrl.toString(),
		codeChallenge,
		state,
		scope: requestedScope,
		resource: resourceMetadata.resource,
	});
	const currentUrl = await getAuthorizationResponseUrl(options, authorizationUrl);

	printSection("Token Request");
	const callbackParameters = oauth.validateAuthResponse(
		authorizationServerMetadata,
		client,
		currentUrl,
		state,
	);
	const tokenResponse = await oauth.authorizationCodeGrantRequest(
		authorizationServerMetadata,
		client,
		clientAuth,
		callbackParameters,
		redirectUrl.toString(),
		codeVerifier,
	);
	const tokenResult = (await oauth.processAuthorizationCodeResponse(
		authorizationServerMetadata,
		client,
		tokenResponse,
	)) as TokenResponse;
	printJson("Authentication Complete", tokenResult);

	printSection("Refresh Token");
	if (!tokenResult.refresh_token) {
		console.log("No refresh_token was returned, so the refresh grant cannot be tested.");
		return;
	}

	const refreshResponse = await oauth.refreshTokenGrantRequest(
		authorizationServerMetadata,
		client,
		clientAuth,
		tokenResult.refresh_token,
	);
	const refreshResult = (await oauth.processRefreshTokenResponse(
		authorizationServerMetadata,
		client,
		refreshResponse,
	)) as TokenResponse;
	printJson("Refresh Grant Result", refreshResult);
}

main().catch((error) => {
	console.error("\nOAuth flow test failed.");
	if (error instanceof Error) {
		console.error(error.message);
		if ("cause" in error && error.cause) {
			console.error(error.cause);
		}
	} else {
		console.error(error);
	}
	process.exit(1);
});
