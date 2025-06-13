import { logger } from "../../logger";
import type { LLMConfig } from "../types";
import type {
	LLMContext,
	LLMMessage,
	LLMProvider,
	LLMResponse,
	ProviderTool,
} from "./types";

export class AnthropicProvider implements LLMProvider {
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

		interface AnthropicRequestBody {
			model: string;
			messages: LLMMessage[];
			max_tokens: number;
			temperature: number;
			system?: string;
			tools?: ProviderTool[];
		}

		const requestBody: AnthropicRequestBody = {
			model,
			messages: conversationMessages,
			max_tokens: config.maxTokens || 4096,
			temperature: config.temperature ?? 0.7,
		};

		// Add system message if present
		if (systemMessage) {
			requestBody.system = systemMessage.content;
		}

		// Add tools if provided
		if (tools && tools.length > 0) {
			requestBody.tools = tools;
			requestBody.tool_choice = { type: "auto" };
		}

		// Log user prompt only
		const userMessage = conversationMessages.find((msg) => msg.role === "user");
		if (userMessage && context) {
			logger.debug(
				`Anthropic request - Agent: ${context.agentName}, User: "${userMessage.content.substring(0, 100)}..."`,
			);
		}

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

			// Log response summary only
			logger.debug(
				`Anthropic response - tokens: ${data.usage?.input_tokens || 0}+${data.usage?.output_tokens || 0}`,
			);

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
						}
					: undefined,
			};
		} catch (error) {
			logger.error(`Anthropic provider error: ${error}`);
			throw error;
		}
	}
}
