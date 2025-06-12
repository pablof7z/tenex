export interface LLMMessage {
	role: "system" | "user" | "assistant";
	content: string;
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

export interface LLMProvider {
	generateResponse(messages: LLMMessage[], config: any): Promise<LLMResponse>;
}
