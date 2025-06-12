import type { ToolCall } from '../tools/types';

export interface LLMMessage {
	role: "system" | "user" | "assistant" | "tool";
	content: string;
	tool_calls?: ToolCall[];
	tool_call_id?: string;
}

export interface LLMResponse {
	content: string;
	model?: string;
	usage?: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
		cache_creation_input_tokens?: number; // Anthropic cache creation
		cache_read_input_tokens?: number; // Anthropic cache reads
		cost?: number; // Total cost in USD
	};
}

export interface LLMContext {
	agentName?: string;
	projectName?: string;
	conversationId?: string;
	typingIndicator?: (message: string) => Promise<void>;
}

export interface LLMProvider {
	generateResponse(
		messages: LLMMessage[], 
		config: any,
		context?: LLMContext,
		tools?: any[] // Provider-specific tool format
	): Promise<LLMResponse>;
}
