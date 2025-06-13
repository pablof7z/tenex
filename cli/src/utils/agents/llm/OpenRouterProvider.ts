import { logger } from "../../logger";
import type { LLMConfig } from "../types";
import type {
	LLMContext,
	LLMMessage,
	LLMProvider,
	LLMResponse,
	ProviderTool,
} from "./types";

export class OpenRouterProvider implements LLMProvider {
	async generateResponse(
		messages: LLMMessage[],
		config: LLMConfig,
		context?: LLMContext,
		tools?: ProviderTool[],
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
		interface OpenRouterMessage {
			role: string;
			content:
				| string
				| Array<{
						type: string;
						text: string;
						cache_control?: { type: string };
				  }>;
		}

		const formattedMessages: OpenRouterMessage[] = [];

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
			// Handle tool messages specially
			if (msg.role === "tool") {
				formattedMessages.push({
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: msg.tool_call_id,
							content: msg.content,
						},
					],
				});
			} else if (
				msg.role === "assistant" &&
				msg.tool_calls &&
				msg.tool_calls.length > 0
			) {
				// Handle assistant messages with tool calls
				const toolUses = msg.tool_calls.map((tc) => ({
					type: "tool_use",
					id: tc.id,
					name: tc.name,
					input: tc.arguments,
				}));

				// Ensure there's always text content for non-empty messages
				const textContent = msg.content || "I'll use the following tools:";

				formattedMessages.push({
					role: msg.role,
					content: [{ type: "text", text: textContent }, ...toolUses],
				});
			} else {
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
			}
		});

		const requestBody: Record<string, unknown> = {
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

		// Log user prompt only
		const userMessage = conversationMessages.find((msg) => msg.role === "user");
		if (userMessage && context) {
			logger.debug(
				`OpenRouter request - Agent: ${context.agentName}, User: "${userMessage.content.substring(0, 100)}..."`,
			);
		}

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

			// Log response summary only
			logger.debug(
				`OpenRouter response - tokens: ${data.usage?.prompt_tokens || 0}+${data.usage?.completion_tokens || 0}`,
			);

			// Log cache usage if available
			if (data.usage?.cached_tokens) {
				logger.info(
					`OpenRouter cache hit! Cached tokens: ${data.usage.cached_tokens}`,
				);
			}
			if (data.cache_discount) {
				logger.info(`Cache discount: ${data.cache_discount}`);
			}

			// Validate response structure
			if (
				!data.choices ||
				!Array.isArray(data.choices) ||
				data.choices.length === 0
			) {
				logger.error(
					"Invalid OpenRouter response structure:",
					JSON.stringify(data, null, 2),
				);
				throw new Error(
					"Invalid response from OpenRouter: missing or empty choices array",
				);
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
					// Parse the arguments if they're a JSON string
					let parsedArgs = {};
					if (toolCall.function.arguments) {
						try {
							parsedArgs =
								typeof toolCall.function.arguments === "string"
									? JSON.parse(toolCall.function.arguments)
									: toolCall.function.arguments;
						} catch (e) {
							logger.error("Failed to parse tool call arguments:", e);
							parsedArgs = { raw: toolCall.function.arguments };
						}
					}

					content += `\n<tool_use>\n${JSON.stringify(
						{
							tool: toolCall.function.name,
							arguments: parsedArgs,
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
