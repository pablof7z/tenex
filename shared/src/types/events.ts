/**
 * Nostr event kinds used throughout TENEX
 */
export const EVENT_KINDS = {
	PROFILE: 0,
	STATUS_UPDATE: 1,
	CONTACT_LIST: 3,
	CHAT_MESSAGE: 11,
	CHAT_REPLY: 1111,
	TASK: 1934,
	AGENT_CONFIG: 4199,
	PROJECT_STATUS: 24010,
	TYPING_INDICATOR: 24111,
	TYPING_INDICATOR_STOP: 24112,
	TEMPLATE: 30717,
	PROJECT: 31933,
} as const;

export type EventKind = (typeof EVENT_KINDS)[keyof typeof EVENT_KINDS];

/**
 * Project status event content
 */
export interface ProjectStatusContent {
	status: "online" | "offline";
	timestamp: number;
	project: string;
}

/**
 * Chat event tags
 */
export interface ChatEventTags {
	a?: string; // project reference
	agent?: string; // agent name
	parentTaskId?: string; // parent task reference
}

/**
 * Typing indicator event content
 */
export interface TypingIndicatorContent {
	message: string; // e.g., "[agent-codename] is typing..."
}

/**
 * Typing indicator event tags
 * Kind: 24111 (typing) / 24112 (stop typing)
 */
export interface TypingIndicatorTags {
	e: string; // conversation/thread ID
	a?: string; // project reference (31933:pubkey:identifier)
	"system-prompt"?: string; // The system prompt being sent to the LLM
	prompt?: string; // The user prompt being sent to the LLM
}
