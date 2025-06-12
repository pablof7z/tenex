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
