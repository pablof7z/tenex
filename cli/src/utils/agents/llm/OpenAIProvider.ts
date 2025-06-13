import { logger } from "../../logger";
import type { LLMConfig } from "../types";
import type {
	LLMContext,
	LLMMessage,
	LLMProvider,
	LLMResponse,
	ProviderTool,
} from "./types";

export class OpenAIProvider implements LLMProvider {
	async generateResponse(
		messages: LLMMessage[],
		config: LLMConfig,
		context?: LLMContext,
		tools?: ProviderTool[],
	): Promise<LLMResponse> {
		if (!config.apiKey) {
			throw new Error("OpenAI API key is required");
		}

		const baseURL = config.baseURL || "https://api.openai.com/v1";
		const model = config.model || "gpt-4";

		const requestBody: Record<string, unknown> = {
			model,
			messages,
			temperature: config.temperature ?? 0.7,
			max_tokens: config.maxTokens,
		};

		// Add tools if provided
		if (tools && tools.length > 0) {
			requestBody.tools = tools;
			requestBody.tool_choice = "auto";
		}

		// Debug logging - log complete request
		logger.debug("\n=== OPENAI API REQUEST ===");
		if (context) {
			logger.debug(`Agent: ${context.agentName || "unknown"}`);
			logger.debug(`Project: ${context.projectName || "unknown"}`);
			logger.debug(`Conversation: ${context.conversationId || "unknown"}`);
		}
		logger.debug(`URL: ${baseURL}/chat/completions`);
		logger.debug("Headers:", {
			"Content-Type": "application/json",
			Authorization: `Bearer ${config.apiKey}`,
		});
		// Log user prompt only
		const userMessage = messages.find((msg) => msg.role === "user");
		if (userMessage) {
			logger.debug(
				`OpenAI request - User: "${userMessage.content.substring(0, 100)}..."`,
			);
		}

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

			// Log response summary only
			logger.debug(
				`OpenAI response - tokens: ${data.usage?.prompt_tokens || 0}+${data.usage?.completion_tokens || 0}`,
			);

			const choice = data.choices[0];

			// Check if the model returned tool calls in the native format
			let content = choice.message.content || "";
			const toolCalls = choice.message.tool_calls;

			// If we have native tool calls, format them in our expected format
			if (toolCalls && toolCalls.length > 0) {
				logger.debug("Model returned native tool calls:", toolCalls);
				// Convert native tool calls to our format in the content
				for (const toolCall of toolCalls) {
					content += `\n<tool_use>\n${JSON.stringify(
						{
							tool: toolCall.function.name,
							arguments: JSON.parse(toolCall.function.arguments),
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
						}
					: undefined,
			};
		} catch (error) {
			logger.error(`OpenAI provider error: ${error}`);
			throw error;
		}
	}
}
