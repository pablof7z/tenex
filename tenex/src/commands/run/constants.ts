import { EVENT_KINDS } from "@tenex/types/events";

export const STATUS_KIND = EVENT_KINDS.PROJECT_STATUS;
export const STATUS_INTERVAL_MS = 60000; // 60 seconds
export const STARTUP_FILTER_MINUTES = 5;

export function getEventKindName(kind: number): string {
    switch (kind) {
        case EVENT_KINDS.METADATA:
            return "Profile";
        case EVENT_KINDS.TEXT_NOTE:
            return "Status Update";
        case EVENT_KINDS.CONTACT_LIST:
            return "Contact List";
        case EVENT_KINDS.CHAT:
            return "Chat Message";
        case EVENT_KINDS.THREAD_REPLY:
            return "Chat Reply";
        case EVENT_KINDS.TASK:
            return "Task";
        case EVENT_KINDS.AGENT_REQUEST:
            return "Agent Request";
        case EVENT_KINDS.AGENT_CONFIG:
            return "Agent Configuration";
        case EVENT_KINDS.PROJECT_STATUS:
            return "Project Status";
        case EVENT_KINDS.LLM_CONFIG_CHANGE:
            return "LLM Config Change";
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
