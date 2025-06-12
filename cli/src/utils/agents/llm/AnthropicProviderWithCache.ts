import { logger } from "../../logger";
import type { LLMConfig } from "../types";
import type { LLMMessage, LLMProvider, LLMResponse } from "./types";

export class AnthropicProviderWithCache implements LLMProvider {
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

		// Build request with cache control
		const requestBody: any = {
			model,
			messages: [],
			max_tokens: config.maxTokens || 4096,
			temperature: config.temperature ?? 0.7,
		};

		// Add system message with cache control if present and long enough
		if (systemMessage && systemMessage.content.length > 256) {
			requestBody.system = [
				{
					type: "text",
					text: systemMessage.content,
					cache_control: { type: "ephemeral" },
				},
			];
		} else if (systemMessage) {
			requestBody.system = systemMessage.content;
		}

		// Add conversation messages with cache control for all but the last
		const cacheBreakpoint = Math.max(0, conversationMessages.length - 1);
		conversationMessages.forEach((msg, index) => {
			if (index < cacheBreakpoint && msg.content.length > 256) {
				requestBody.messages.push({
					role: msg.role,
					content: [
						{
							type: "text",
							text: msg.content,
							cache_control: { type: "ephemeral" },
						},
					],
				});
			} else {
				requestBody.messages.push({
					role: msg.role,
					content: msg.content,
				});
			}
		});

		// Debug logging
		logger.debug("\n=== ANTHROPIC API REQUEST (WITH CACHING) ===");
		logger.debug(`URL: ${baseURL}/messages`);
		logger.debug(`Model: ${requestBody.model}`);
		logger.debug(`Temperature: ${requestBody.temperature}`);
		logger.debug(`Max Tokens: ${requestBody.max_tokens}`);
		logger.debug(`Caching enabled: true`);

		// Count cached messages
		let cachedMessages = 0;
		if (Array.isArray(requestBody.system)) {
			requestBody.system.forEach((s: any) => {
				if (s.cache_control) cachedMessages++;
			});
		}
		requestBody.messages.forEach((msg: any) => {
			if (Array.isArray(msg.content)) {
				msg.content.forEach((c: any) => {
					if (c.cache_control) cachedMessages++;
				});
			}
		});
		logger.debug(`Messages with cache control: ${cachedMessages}`);
		logger.debug("=== END API REQUEST ===\n");

		try {
			const response = await fetch(`${baseURL}/messages`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": config.apiKey,
					"anthropic-version": "2023-06-01",
					"anthropic-beta": "prompt-caching-2024-07-31",
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

			// Log cache usage if available
			if (data.usage?.cache_creation_input_tokens) {
				logger.info(
					`Anthropic cache created! Cache creation tokens: ${data.usage.cache_creation_input_tokens}`,
				);
			}
			if (data.usage?.cache_read_input_tokens) {
				logger.info(
					`Anthropic cache hit! Cache read tokens: ${data.usage.cache_read_input_tokens}`,
				);
			}

			return {
				content: data.content[0].text,
				model: data.model,
				usage: data.usage
					? {
							prompt_tokens: data.usage.input_tokens,
							completion_tokens: data.usage.output_tokens,
							total_tokens: data.usage.input_tokens + data.usage.output_tokens,
							cache_creation_input_tokens:
								data.usage.cache_creation_input_tokens,
							cache_read_input_tokens: data.usage.cache_read_input_tokens,
						}
					: undefined,
			};
		} catch (error) {
			logger.error(`Anthropic provider error: ${error}`);
			throw error;
		}
	}
}
