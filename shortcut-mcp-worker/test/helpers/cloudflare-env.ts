/**
 * Creates a mock Cloudflare environment for testing
 */
export function makeCloudflareEnv(vars = {}) {
  return {
    // Default environment variables
    SHORTCUT_CLIENT_ID: "test-client-id",
    SHORTCUT_CLIENT_SECRET: "test-client-secret",
    // Override with any provided vars
    ...vars,
    // Add other environment bindings as needed
  };
}