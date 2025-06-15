/**
 * Status and configuration-related event types
 */

/**
 * Event content for LLM configuration changes (kind 24101)
 * Ephemeral event sent by project owner to change agent's LLM model
 */
export interface LLMConfigChangeEventContent {
    action: "change_llm_config";
    timestamp: number;
}

/**
 * Tags structure for LLM config change event
 * - Must include a p-tag with the agent's pubkey to target
 * - Must include a model tag with the LLM configuration name
 */
export interface LLMConfigChangeEventTags {
    p: string[]; // ["p", "agent_pubkey_hex"]
    model: string[]; // ["model", "llm_config_name"]
    a?: string[]; // ["a", "31933:pubkey:d-tag"] - optional project reference
}
