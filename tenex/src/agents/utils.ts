import type { Agent } from "./types";

export const isClaudeBackend = (agent: Agent): boolean => agent.backend === "claude";
