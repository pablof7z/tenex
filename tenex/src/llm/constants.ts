/**
 * LLM Configuration Constants
 */

// Default configuration keys used in llms.json
export const LLM_DEFAULTS = {
    AGENTS: "agents",
    ANALYZE: "analyze",
} as const;

// Default fallback key for agents when no llmConfig is specified
export const DEFAULT_AGENT_LLM_CONFIG = LLM_DEFAULTS.AGENTS;
