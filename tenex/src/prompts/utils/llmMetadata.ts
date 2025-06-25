import { openRouterPricing } from "@/llm/pricing";
import type { Message } from "multi-llm-ts";

export interface LLMMetadata {
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  cost: number;
  systemPrompt?: string;
  userPrompt?: string;
}

interface ResponseWithUsage {
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens?: number;
  };
  experimental_providerMetadata?: {
    openrouter?: { usage?: { total_cost?: number } };
  };
  model?: string;
}

export async function buildLLMMetadata(
  response: ResponseWithUsage,
  model: string,
  messages: Message[]
): Promise<LLMMetadata | undefined> {
  if (!response.usage) {
    return undefined;
  }

  const cost = await calculateCost(response, model);

  const systemPrompt = messages.find((m) => m.role === "system")?.content;
  const userPrompt = messages.find((m) => m.role === "user")?.content;

  return {
    model: response.model || model,
    usage: {
      prompt_tokens: response.usage.promptTokens,
      completion_tokens: response.usage.completionTokens,
      total_tokens:
        response.usage.totalTokens ||
        response.usage.promptTokens + response.usage.completionTokens,
    },
    cost,
    systemPrompt,
    userPrompt,
  };
}

export async function calculateCost(
  response: ResponseWithUsage,
  model: string
): Promise<number> {
  // Check if OpenRouter already calculated the cost
  const openRouterCost =
    response.experimental_providerMetadata?.openrouter?.usage?.total_cost;
  if (openRouterCost !== undefined) {
    return openRouterCost;
  }

  // Calculate cost based on model pricing
  const modelId = await openRouterPricing.findModelId(model);
  if (modelId && response.usage) {
    return await openRouterPricing.calculateCost(
      modelId,
      response.usage.promptTokens,
      response.usage.completionTokens
    );
  }

  // Fallback: rough estimate based on typical pricing
  if (response.usage) {
    const { promptTokens, completionTokens } = response.usage;
    return (promptTokens + completionTokens) / 1_000_000 * 1.0;
  }

  return 0;
}