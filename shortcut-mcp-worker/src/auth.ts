import { OAuthProvider } from "@cloudflare/workers-oauth-provider";

// Define the OAuth configuration interface
export interface ShortcutOAuthConfig {
	clientId: string;
	clientSecret: string;
	authorizationUrl: string;
	tokenUrl: string;
	callbackUrl: string;
}

// Create an OAuth provider with the provided configuration
export function createOAuthProvider(config: ShortcutOAuthConfig) {
	return new OAuthProvider({
		clientId: config.clientId,
		clientSecret: config.clientSecret,
		authorizationUrl: config.authorizationUrl,
		tokenUrl: config.tokenUrl,
		callbackUrl: config.callbackUrl,
		scope: "api", // The scope required for Shortcut API access
	});
}

// Handle OAuth routes
export async function handleAuth(request: Request, env: Record<string, unknown>) {
	const url = new URL(request.url);
	const provider = createOAuthProvider({
		clientId: env.SHORTCUT_CLIENT_ID,
		clientSecret: env.SHORTCUT_CLIENT_SECRET,
		authorizationUrl: "https://app.shortcut.com/oauth/authorize",
		tokenUrl: "https://app.shortcut.com/oauth/token",
		callbackUrl: `${url.origin}/oauth/callback`,
	});

	// Handle authorization request
	if (url.pathname === "/oauth/authorize") {
		return provider.handleAuthorize(request);
	}

	// Handle callback from OAuth provider
	if (url.pathname === "/oauth/callback") {
		return provider.handleCallback(request);
	}

	// Return not found for other routes
	return new Response("Not found", { status: 404 });
}

// Extract token from various sources
export async function getTokenFromRequest(
	request: Request,
	env: Record<string, unknown>,
): Promise<string | null> {
	// Try Authorization header first (Bearer token)
	const authHeader = request.headers.get("Authorization");
	if (authHeader?.startsWith("Bearer ")) {
		return authHeader.substring(7);
	}

	// Try cookies next
	const cookies = parseCookies(request.headers.get("Cookie") || "");
	if (cookies.shortcut_token) {
		return cookies.shortcut_token;
	}

	// Try query parameters last
	const url = new URL(request.url);
	const queryToken = url.searchParams.get("token");
	if (queryToken) {
		return queryToken;
	}

	// No token found
	return null;
}

// Helper to parse cookies
function parseCookies(cookieString: string): Record<string, string> {
	return cookieString
		.split(";")
		.map((pair) => pair.trim().split("="))
		.reduce(
			(cookies, [key, value]) => {
				if (key && value) cookies[key] = value;
				return cookies;
			},
			{} as Record<string, string>,
		);
}
