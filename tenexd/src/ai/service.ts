import chalk from "chalk";
import OpenAI from "openai";
import type {
	AICompletionOptions,
	AICompletionResponse,
	AIModelConfig,
} from "./types.js";

export class AIService {
	private client: OpenAI;
	private config: AIModelConfig;

	constructor(config: AIModelConfig) {
		this.config = config;

		const options: any = {
			apiKey: config.apiKey,
		};

		// For OpenRouter, we need to set a custom base URL
		if (config.provider === "openrouter") {
			options.baseURL = config.baseURL || "https://openrouter.ai/api/v1";
			options.defaultHeaders = {
				"HTTP-Referer": "https://tenex.dev",
				"X-Title": "TENEX Daemon",
			};
		} else if (config.baseURL) {
			options.baseURL = config.baseURL;
		}

		this.client = new OpenAI(options);
	}

	async complete(
		messagesOrOptions:
			| OpenAI.Chat.ChatCompletionMessageParam[]
			| AICompletionOptions,
	): Promise<AICompletionResponse> {
		try {
			let messages: OpenAI.Chat.ChatCompletionMessageParam[];
			let maxTokens: number | undefined;
			let temperature: number | undefined;
			let stream = false;

			// Handle both array of messages and options object
			if (Array.isArray(messagesOrOptions)) {
				messages = messagesOrOptions;
				maxTokens = this.config.maxTokens;
				temperature = this.config.temperature;
			} else {
				messages = [
					{
						role: "user",
						content: messagesOrOptions.prompt,
					},
				];
				maxTokens = messagesOrOptions.maxTokens || this.config.maxTokens;
				temperature = messagesOrOptions.temperature || this.config.temperature;
				stream = messagesOrOptions.stream || false;
			}

			const completion = await this.client.chat.completions.create({
				model: this.config.model,
				messages,
				max_tokens: maxTokens,
				temperature: temperature,
				stream: stream,
			});

			if (options.stream) {
				// Handle streaming responses if needed in the future
				throw new Error("Streaming not yet implemented");
			}

			const response = completion as OpenAI.Chat.ChatCompletion;
			const content = response.choices[0]?.message?.content || "";

			return {
				content,
				usage: response.usage
					? {
							promptTokens: response.usage.prompt_tokens,
							completionTokens: response.usage.completion_tokens,
							totalTokens: response.usage.total_tokens,
						}
					: undefined,
			};
		} catch (error: any) {
			if (error.status === 401) {
				throw new Error(
					`Authentication failed for ${this.config.name}: Invalid API key`,
				);
			} else if (error.status === 429) {
				throw new Error(`Rate limit exceeded for ${this.config.name}`);
			} else if (error.status === 404) {
				throw new Error(
					`Model ${this.config.model} not found for ${this.config.name}`,
				);
			}
			throw new Error(`AI completion failed: ${error.message}`);
		}
	}

	async testConnection(): Promise<boolean> {
		try {
			const response = await this.complete([
				{
					role: "user",
					content: "Say 'OK' if you can hear me.",
				},
			]);
			return response.content.toLowerCase().includes("ok");
		} catch (error) {
			console.error(
				chalk.red(`Failed to test connection for ${this.config.name}:`),
				error,
			);
			return false;
		}
	}

	getConfigName(): string {
		return this.config.name;
	}

	getProvider(): string {
		return this.config.provider;
	}

	getModel(): string {
		return this.config.model;
	}
}
