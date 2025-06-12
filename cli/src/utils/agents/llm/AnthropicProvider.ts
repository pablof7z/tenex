import { logger } from "../../logger";
import type { LLMConfig } from "../types";
import type { LLMMessage, LLMProvider, LLMResponse } from "./types";

export class AnthropicProvider implements LLMProvider {
	async generateResponse(
		messages: LLMMessage[],
		config: LLMConfig,
	): Promise<LLMResponse> {
		if (!config.apiKey) {
			throw new Error("Anthropic API key is required");
		}

		const baseURL = config.baseURL || "https://api.anthropic.com/v1";
		const model = config.model || "claude-3-opus-20240229";

		// Separate system message from conversation messages
		const systemMessage = messages.find((msg) => msg.role === "system");
		const conversationMessages = messages.filter(
			(msg) => msg.role !== "system",
		);

		const requestBody: any = {
			model,
			messages: conversationMessages,
			max_tokens: config.maxTokens || 4096,
			temperature: config.temperature ?? 0.7,
		};

		// Add system message if present
		if (systemMessage) {
			requestBody.system = systemMessage.content;
		}

		// Debug logging
		logger.debug("\n=== ANTHROPIC API REQUEST ===");
		logger.debug(`URL: ${baseURL}/messages`);
		logger.debug(`Model: ${requestBody.model}`);
		logger.debug(`Temperature: ${requestBody.temperature}`);
		logger.debug(`Max Tokens: ${requestBody.max_tokens}`);
		if (systemMessage) {
			logger.debug(`\nSystem Message:\n${systemMessage.content}`);
		}
		logger.debug(`\nConversation Messages (${conversationMessages.length}):`);
		conversationMessages.forEach((msg, i) => {
			logger.debug(
				`[${i}] ${msg.role}: ${msg.content.slice(0, 200)}${msg.content.length > 200 ? "..." : ""}`,
			);
		});
		logger.debug("=== END API REQUEST ===\n");

		try {
			const response = await fetch(`${baseURL}/messages`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": config.apiKey,
					"anthropic-version": "2023-06-01",
				},
				body: JSON.stringify(requestBody),
			});

			if (!response.ok) {
				const error = await response.text();
				throw new Error(`Anthropic API error: ${response.status} - ${error}`);
			}

			const data = await response.json();

			// Log the raw API response
			logger.debug("\n=== ANTHROPIC RAW API RESPONSE ===");
			logger.debug(JSON.stringify(data, null, 2));
			logger.debug("=== END RAW API RESPONSE ===\n");

			return {
				content: data.content[0].text,
				model: data.model,
				usage: data.usage
					? {
							prompt_tokens: data.usage.input_tokens,
							completion_tokens: data.usage.output_tokens,
							total_tokens: data.usage.input_tokens + data.usage.output_tokens,
						}
					: undefined,
			};
		} catch (error) {
			logger.error(`Anthropic provider error: ${error}`);
			throw error;
		}
	}
}
