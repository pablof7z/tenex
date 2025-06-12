import { logger } from "../../logger";

// Cost per 1M tokens in USD
const COST_TABLE: Record<string, { input: number; output: number }> = {
	// OpenAI models
	"gpt-4-turbo": { input: 10.0, output: 30.0 },
	"gpt-4-turbo-preview": { input: 10.0, output: 30.0 },
	"gpt-4": { input: 30.0, output: 60.0 },
	"gpt-3.5-turbo": { input: 0.5, output: 1.5 },

	// Anthropic models
	"claude-3-opus-20240229": { input: 15.0, output: 75.0 },
	"claude-3-sonnet-20240229": { input: 3.0, output: 15.0 },
	"claude-3-haiku-20240307": { input: 0.25, output: 1.25 },
	"claude-3.5-sonnet": { input: 3.0, output: 15.0 },

	// DeepSeek models
	"deepseek/deepseek-chat": { input: 0.14, output: 0.28 },
	"deepseek/deepseek-chat-v3": { input: 0.14, output: 0.28 },
	"deepseek/deepseek-chat-v3-0324": { input: 0.14, output: 0.28 },
	"deepseek/deepseek-coder": { input: 0.14, output: 0.28 },

	// Other models
	"meta-llama/llama-3.1-70b-instruct": { input: 0.88, output: 0.88 },
	"meta-llama/llama-3.1-8b-instruct": { input: 0.11, output: 0.11 },
};

export function calculateCost(
	model: string,
	promptTokens: number,
	completionTokens: number,
): number | undefined {
	// Find cost configuration for the model
	const costConfig = COST_TABLE[model];

	if (!costConfig) {
		// Try to find a partial match
		const modelKey = Object.keys(COST_TABLE).find(
			(key) => model.includes(key) || key.includes(model),
		);

		if (modelKey) {
			const config = COST_TABLE[modelKey];
			const cost =
				(promptTokens * config.input) / 1_000_000 +
				(completionTokens * config.output) / 1_000_000;
			logger.debug(
				`Calculated cost for ${model} using ${modelKey} rates: $${cost.toFixed(6)}`,
			);
			return cost;
		}

		logger.debug(`No cost information available for model: ${model}`);
		return undefined;
	}

	// Calculate cost: (tokens / 1M) * cost per 1M
	const cost =
		(promptTokens * costConfig.input) / 1_000_000 +
		(completionTokens * costConfig.output) / 1_000_000;

	return cost;
}

// Helper to format cost for display
export function formatCost(cost: number): string {
	if (cost < 0.01) {
		return `$${cost.toFixed(6)}`;
	}
	if (cost < 1) {
		return `$${cost.toFixed(4)}`;
	}
	return `$${cost.toFixed(2)}`;
}
