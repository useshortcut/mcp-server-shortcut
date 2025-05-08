/**
 * Mock implementation of the OAuth provider
 */
export class OAuthProvider {
  constructor(config: any) {
    // Store config if needed
  }

  handleAuthorize(request: Request) {
    return new Response("Authorize mock response", { status: 200 });
  }

  handleCallback(request: Request) {
    return new Response("Callback mock response", { status: 200 });
  }
}