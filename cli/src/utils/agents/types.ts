import type { NDKEvent } from "@nostr-dev-kit/ndk";

export interface LLMConfig {
	provider: string;
	model: string;
	apiKey?: string;
	baseURL?: string;
	temperature?: number;
	maxTokens?: number;
	enableCaching?: boolean; // Enable provider-specific caching features
	contextWindowSize?: number; // Override default context window size
}

export interface AgentConfig {
	name: string;
	description?: string;
	role?: string;
	instructions?: string;
	systemPrompt?: string;
	version?: string;
}

export interface ConversationMessage {
	role: "system" | "user" | "assistant";
	content: string;
	event?: NDKEvent | any; // NDKEvent when in memory, raw event object when serialized
	timestamp: number;
}

export interface ConversationContext {
	id: string;
	agentName: string;
	messages: ConversationMessage[];
	createdAt: number;
	lastActivityAt: number;
	metadata?: Record<string, any>;
}

export interface AgentResponse {
	content: string;
	confidence?: number;
	metadata?: {
		model?: string;
		provider?: string;
		usage?: {
			prompt_tokens: number;
			completion_tokens: number;
			total_tokens: number;
			cache_creation_input_tokens?: number;
			cache_read_input_tokens?: number;
			cost?: number;
		};
		[key: string]: any;
	};
}
