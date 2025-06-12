export const EVENT_KINDS = {
	PROFILE: 0,
	STATUS_UPDATE: 1,
	CONTACT_LIST: 3,
	CHAT_MESSAGE: 11,
	CHAT_REPLY: 1111,
	TASK: 1934,
	AGENT_REQUEST: 3199,
	AGENT_CONFIG: 4199,
	PROJECT_STATUS: 24010,
	TYPING_INDICATOR: 24111,
	TYPING_INDICATOR_STOP: 24112,
	PROJECT: 31933,
} as const;

export const STATUS_KIND = EVENT_KINDS.PROJECT_STATUS;
export const STATUS_INTERVAL_MS = 60000; // 60 seconds
export const STARTUP_FILTER_MINUTES = 5;

export function getEventKindName(kind: number): string {
	switch (kind) {
		case EVENT_KINDS.PROFILE:
			return "Profile";
		case EVENT_KINDS.STATUS_UPDATE:
			return "Status Update";
		case EVENT_KINDS.CONTACT_LIST:
			return "Contact List";
		case EVENT_KINDS.CHAT_MESSAGE:
			return "Chat Message";
		case EVENT_KINDS.CHAT_REPLY:
			return "Chat Reply";
		case EVENT_KINDS.TASK:
			return "Task";
		case EVENT_KINDS.AGENT_REQUEST:
			return "Agent Request";
		case EVENT_KINDS.AGENT_CONFIG:
			return "Agent Configuration";
		case EVENT_KINDS.PROJECT_STATUS:
			return "Project Status";
		case EVENT_KINDS.TYPING_INDICATOR:
			return "Typing Indicator";
		case EVENT_KINDS.TYPING_INDICATOR_STOP:
			return "Typing Stop";
		case EVENT_KINDS.PROJECT:
			return "Project";
		default:
			return `Kind ${kind}`;
	}
}
