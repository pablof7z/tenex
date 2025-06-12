import { logger } from "../../logger";
import type { LLMConfig } from "../types";
import type { LLMMessage, LLMProvider, LLMResponse, LLMContext } from "./types";

export class OpenRouterProvider implements LLMProvider {
	async generateResponse(
		messages: LLMMessage[],
		config: LLMConfig,
		context?: LLMContext,
		tools?: any[],
	): Promise<LLMResponse> {
		if (!config.apiKey) {
			throw new Error("OpenRouter API key is required");
		}

		const baseURL = config.baseURL || "https://openrouter.ai/api/v1";
		const model = config.model;
		if (!model) {
			throw new Error("Model is required for OpenRouter");
		}

		// Separate system message from conversation messages
		const systemMessage = messages.find((msg) => msg.role === "system");
		const conversationMessages = messages.filter(
			(msg) => msg.role !== "system",
		);

		// Convert messages to OpenRouter format with caching
		const formattedMessages: any[] = [];

		// Add system message with caching if enabled
		if (systemMessage) {
			if (
				config.enableCaching !== false &&
				systemMessage.content.length > 256
			) {
				// Use cache_control for system prompts and large contexts
				formattedMessages.push({
					role: "system",
					content: [
						{
							type: "text",
							text: systemMessage.content,
							cache_control: { type: "ephemeral" },
						},
					],
				});
			} else {
				formattedMessages.push({
					role: "system",
					content: systemMessage.content,
				});
			}
		}

		// Process conversation messages
		const cacheBreakpoint = Math.max(0, conversationMessages.length - 1);

		conversationMessages.forEach((msg, index) => {
			// For messages before the last one, use caching if enabled
			if (config.enableCaching !== false && index < cacheBreakpoint) {
				formattedMessages.push({
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
				// Last message or caching disabled
				formattedMessages.push({
					role: msg.role,
					content: msg.content,
				});
			}
		});

		const requestBody: any = {
			model,
			messages: formattedMessages,
			temperature: config.temperature ?? 0.7,
			max_tokens: config.maxTokens || 4096,
			// Include usage data to monitor cache usage
			usage: { include: true },
		};

		// Add tools if provided
		if (tools && tools.length > 0) {
			requestBody.tools = tools;
			// Some models may need tool_choice to be set
			requestBody.tool_choice = "auto";
		}

		// Add any additional OpenRouter-specific parameters
		if (config.additionalParams) {
			Object.assign(requestBody, config.additionalParams);
		}

		// Debug logging - log complete request
		logger.debug("\n=== OPENROUTER API REQUEST (WITH CACHING) ===");
		if (context) {
			logger.debug(`Agent: ${context.agentName || "unknown"}`);
			logger.debug(`Project: ${context.projectName || "unknown"}`);
			logger.debug(`Conversation: ${context.conversationId || "unknown"}`);
		}
		logger.debug(`URL: ${baseURL}/chat/completions`);
		logger.debug("Headers:", {
			"Content-Type": "application/json",
			"Authorization": `Bearer ${config.apiKey}`,
			"HTTP-Referer": config.appName || "tenex-cli",
			"X-Title": config.appTitle || "TENEX CLI Agent",
		});
		logger.debug(`Caching enabled: ${config.enableCaching !== false}`);

		// Count cached messages for summary
		let cachedMessages = 0;
		formattedMessages.forEach((msg) => {
			if (Array.isArray(msg.content)) {
				msg.content.forEach((c: any) => {
					if (c.cache_control) cachedMessages++;
				});
			}
		});
		logger.debug(`Messages with cache control: ${cachedMessages}`);
		
		logger.debug("Complete Request Body:");
		logger.debug(JSON.stringify(requestBody, null, 2));
		logger.debug("=== END API REQUEST ===\n");

		try {
			const response = await fetch(`${baseURL}/chat/completions`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${config.apiKey}`,
					"HTTP-Referer": config.appName || "tenex-cli",
					"X-Title": config.appTitle || "TENEX CLI Agent",
				},
				body: JSON.stringify(requestBody),
			});

			if (!response.ok) {
				const error = await response.text();
				throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
			}

			const data = await response.json();

			// Log the raw API response
			logger.debug("\n=== OPENROUTER RAW API RESPONSE ===");
			logger.debug(JSON.stringify(data, null, 2));
			logger.debug("=== END RAW API RESPONSE ===\n");

			// Log cache usage if available
			if (data.usage?.cached_tokens) {
				logger.info(
					`OpenRouter cache hit! Cached tokens: ${data.usage.cached_tokens}`,
				);
			}
			if (data.cache_discount) {
				logger.info(`Cache discount: ${data.cache_discount}`);
			}

			// Extract the response
			const choice = data.choices[0];

			// Check if the model returned tool calls in the native format
			let content = choice.message.content || "";
			const toolCalls = choice.message.tool_calls;

			// If we have native tool calls, format them in our expected format
			if (toolCalls && toolCalls.length > 0) {
				logger.debug("Model returned native tool calls:", toolCalls);
				// Convert native tool calls to our format in the content
				for (const toolCall of toolCalls) {
					content += `\n<tool_use>\n${JSON.stringify({
						tool: toolCall.function.name,
						arguments: JSON.parse(toolCall.function.arguments)
					}, null, 2)}\n</tool_use>`;
				}
			}

			return {
				content: content,
				model: data.model,
				usage: data.usage
					? {
							prompt_tokens: data.usage.prompt_tokens,
							completion_tokens: data.usage.completion_tokens,
							total_tokens: data.usage.total_tokens,
							cache_read_input_tokens: data.usage.cached_tokens,
							cost: data.usage.cost,
						}
					: undefined,
			};
		} catch (error) {
			logger.error(`OpenRouter provider error: ${error}`);
			throw error;
		}
	}
}
