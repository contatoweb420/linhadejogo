export async function register() {
  if (process.env.E2E_TEST_MODE === "1") return;
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const holder = globalThis as typeof globalThis & { __blogAgentStarted?: boolean };
  if (holder.__blogAgentStarted) return;
  holder.__blogAgentStarted = true;
  const { startBlogAgent } = await import("@/server/blog-agent/schedule");
  startBlogAgent();
}
