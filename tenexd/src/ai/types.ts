import { z } from "zod";

export const AIProviderSchema = z.enum(["openai", "openrouter"]);
export type AIProvider = z.infer<typeof AIProviderSchema>;

export const AIModelConfigSchema = z.object({
	name: z.string().describe("Unique name for this configuration"),
	provider: AIProviderSchema,
	apiKey: z.string().describe("API key for the provider"),
	model: z.string().describe("Model name/ID to use"),
	baseURL: z
		.string()
		.optional()
		.describe("Custom base URL (for OpenRouter or custom endpoints)"),
	maxTokens: z.number().optional().default(4096),
	temperature: z.number().optional().default(0.7),
});

export type AIModelConfig = z.infer<typeof AIModelConfigSchema>;
export type AIConfiguration = AIModelConfig; // Alias for compatibility

export const AIConfigSchema = z.object({
	configurations: z.array(AIModelConfigSchema),
	defaultConfiguration: z
		.string()
		.optional()
		.describe("Name of the default configuration to use"),
});

export type AIConfig = z.infer<typeof AIConfigSchema>;

export interface AICompletionOptions {
	prompt: string;
	maxTokens?: number;
	temperature?: number;
	stream?: boolean;
}

export interface AICompletionResponse {
	content: string;
	usage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
}
