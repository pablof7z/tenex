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

export const EVENT_KINDS = {
    CHAT: 11,
    THREAD_REPLY: 1111,
    PROJECT_STATUS: 24010,
    TYPING_INDICATOR: 24111,
    TYPING_INDICATOR_STOP: 24112,
} as const;

export interface ChatSession {
    project: TenexProject;
    currentThread?: ThreadEvent;
    agents: ProjectAgent[];
    typingIndicators: Map<string, TypingIndicator>;
}
