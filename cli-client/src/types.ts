export const EVENT_KINDS = {
    CHAT: 24001,
    THREAD_REPLY: 24002,
    AGENT_RESPONSE: 24003,
    PROJECT_STATUS: 24004,
    TYPING_INDICATOR: 24111,
    TYPING_INDICATOR_STOP: 24112,
} as const;

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
