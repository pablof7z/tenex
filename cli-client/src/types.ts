import { EVENT_KINDS } from "@tenex/types/events";

export { EVENT_KINDS };

export interface ProjectAgent {
    pubkey: string;
    name: string;
}

export interface TenexProject {
    naddr: string;
    pubkey: string;
    identifier: string;
    title?: string;
}

export interface ThreadEvent {
    id: string;
    pubkey: string;
    content: string;
    created_at: number;
    kind: number;
    tags: string[][];
    title?: string;
}

export interface TypingIndicator {
    id: string;
    pubkey: string;
    content: string;
    created_at: number;
    kind: number;
    tags: string[][];
    agentName?: string;
    systemPrompt?: string;
    userPrompt?: string;
}

export interface ChatSession {
    project: TenexProject;
    currentThread?: ThreadEvent;
    agents: ProjectAgent[];
    typingIndicators: Map<string, TypingIndicator>;
}
