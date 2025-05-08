import { beforeAll, afterAll, afterEach } from "bun:test";
import { makeCloudflareEnv } from "./helpers/cloudflare-env";

// Create a mock environment for tests
let env: ReturnType<typeof makeCloudflareEnv>;

beforeAll(() => {
  env = makeCloudflareEnv();
});

afterEach(() => {
  // Clean up any mocks or test data
});

afterAll(() => {
  // Cleanup any resources
});

export { env };