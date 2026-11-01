export const agentNames = ["news", "blogs", "forums", "reviews"] as const;

export type AgentName = (typeof agentNames)[number];

export function agentSecret() {
  return process.env.RECOLHA_SEGREDO?.trim() ?? "";
}
