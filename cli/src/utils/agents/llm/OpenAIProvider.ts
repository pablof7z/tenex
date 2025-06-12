import { logger } from "../../logger";
import type { LLMConfig } from "../types";
import type { LLMMessage, LLMProvider, LLMResponse } from "./types";

export class OpenAIProvider implements LLMProvider {
	async generateResponse(
		messages: LLMMessage[],
		config: LLMConfig,
	): Promise<LLMResponse> {
		if (!config.apiKey) {
			throw new Error("OpenAI API key is required");
		}

		const baseURL = config.baseURL || "https://api.openai.com/v1";
		const model = config.model || "gpt-4";

		const requestBody = {
			model,
			messages,
			temperature: config.temperature ?? 0.7,
			max_tokens: config.maxTokens,
		};

		// Debug logging
		logger.debug("\n=== OPENAI API REQUEST ===");
		logger.debug(`URL: ${baseURL}/chat/completions`);
		logger.debug(`Model: ${requestBody.model}`);
		logger.debug(`Temperature: ${requestBody.temperature}`);
		logger.debug(`Max Tokens: ${requestBody.max_tokens || "default"}`);
		logger.debug(`\nMessages (${messages.length}):`);
		messages.forEach((msg, i) => {
			logger.debug(`[${i}] ${msg.role}:`);
			if (msg.role === "system") {
				logger.debug(msg.content);
			} else {
				logger.debug(
					`${msg.content.slice(0, 200)}${msg.content.length > 200 ? "..." : ""}`,
				);
			}
		});
		logger.debug("=== END API REQUEST ===\n");

		try {
			const response = await fetch(`${baseURL}/chat/completions`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${config.apiKey}`,
				},
				body: JSON.stringify(requestBody),
			});

			if (!response.ok) {
				const error = await response.text();
				throw new Error(`OpenAI API error: ${response.status} - ${error}`);
			}

			const data = await response.json();

			// Log the raw API response
			logger.debug("\n=== OPENAI RAW API RESPONSE ===");
			logger.debug(JSON.stringify(data, null, 2));
			logger.debug("=== END RAW API RESPONSE ===\n");

			const choice = data.choices[0];

			return {
				content: choice.message.content,
				model: data.model,
				usage: data.usage
					? {
							prompt_tokens: data.usage.prompt_tokens,
							completion_tokens: data.usage.completion_tokens,
							total_tokens: data.usage.total_tokens,
						}
					: undefined,
			};
		} catch (error) {
			logger.error(`OpenAI provider error: ${error}`);
			throw error;
		}
	}
}
