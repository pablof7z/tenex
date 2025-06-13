import { logger } from "../../logger";
import type { LLMConfig } from "../types";
import type {
	LLMContext,
	LLMMessage,
	LLMProvider,
	LLMResponse,
	ProviderTool,
} from "./types";

export class AnthropicProviderWithCache implements LLMProvider {
	async generateResponse(
		messages: LLMMessage[],
		config: LLMConfig,
		context?: LLMContext,
		tools?: ProviderTool[],
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
		interface AnthropicMessage {
			role: string;
			content:
				| string
				| Array<{
						type: string;
						text: string;
						cache_control?: { type: string };
				  }>;
		}

		interface AnthropicRequest {
			model: string;
			messages: AnthropicMessage[];
			max_tokens: number;
			temperature: number;
			system?:
				| string
				| Array<{
						type: string;
						text: string;
						cache_control?: { type: string };
				  }>;
			tools?: ProviderTool[];
			tool_choice?: { type: string };
		}

		const requestBody: AnthropicRequest = {
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

		// Add tools if provided
		if (tools && tools.length > 0) {
			requestBody.tools = tools;
			requestBody.tool_choice = { type: "auto" };
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

		// Debug logging - log complete request
		logger.debug("\n=== ANTHROPIC API REQUEST (WITH CACHING) ===");
		if (context) {
			logger.debug(`Agent: ${context.agentName || "unknown"}`);
			logger.debug(`Project: ${context.projectName || "unknown"}`);
			logger.debug(`Conversation: ${context.conversationId || "unknown"}`);
		}
		logger.debug(`URL: ${baseURL}/messages`);
		logger.debug("Headers:", {
			"Content-Type": "application/json",
			"x-api-key": config.apiKey,
			"anthropic-version": "2023-06-01",
			"anthropic-beta": "prompt-caching-2024-07-31",
		});

		// Count cached messages for summary
		let cachedMessages = 0;
		if (Array.isArray(requestBody.system)) {
			for (const s of requestBody.system) {
				if (s.cache_control) cachedMessages++;
			}
		}
		for (const msg of requestBody.messages) {
			if (Array.isArray(msg.content)) {
				for (const c of msg.content) {
					if (c.cache_control) cachedMessages++;
				}
			}
		}
		logger.debug(`Messages with cache control: ${cachedMessages}`);

		// Log user prompt only
		const userMessage = messages.find((msg) => msg.role === "user");
		if (userMessage) {
			logger.debug(
				`Anthropic request - User: "${userMessage.content.substring(0, 100)}..."`,
			);
		}

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

			// Log response summary only
			logger.debug(
				`Anthropic response - tokens: ${data.usage?.input_tokens || 0}+${data.usage?.output_tokens || 0}`,
			);

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

			// Extract content - Anthropic returns an array of content blocks
			let content = "";

			for (const block of data.content) {
				if (block.type === "text") {
					content += block.text;
				} else if (block.type === "tool_use") {
					// Convert native tool call to our format
					logger.debug("Model returned native tool call:", block);
					content += `\n<tool_use>\n${JSON.stringify(
						{
							tool: block.name,
							arguments: block.input,
						},
						null,
						2,
					)}\n</tool_use>`;
				}
			}

			return {
				content: content,
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
