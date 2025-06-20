// Provider-specific response types for better type safety

export interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface AnthropicContent {
  type: "text" | "tool_use";
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
  id?: string;
}

export interface AnthropicResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: AnthropicContent[];
  model: string;
  stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use";
  stop_sequence?: string;
  usage: AnthropicUsage;
}

export interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface OpenAIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenAIMessage {
  role: "assistant";
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  refusal?: string;
}

export interface OpenAIChoice {
  index: number;
  message: OpenAIMessage;
  logprobs?: Record<string, unknown> | null;
  finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | "function_call";
}

export interface OpenAIResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage?: OpenAIUsage;
  system_fingerprint?: string;
}

export interface OpenRouterUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  total_cost?: number;
}

export interface OpenRouterResponse extends OpenAIResponse {
  usage?: OpenRouterUsage;
  provider?: string;
  model_used?: string;
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: "assistant";
    content: string;
    tool_calls?: OpenAIToolCall[];
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

// Union type for all provider responses
export type ProviderResponse =
  | AnthropicResponse
  | OpenAIResponse
  | OpenRouterResponse
  | OllamaResponse;

// Response validation functions
export function isAnthropicResponse(response: unknown): response is AnthropicResponse {
  if (typeof response !== "object" || response === null) {
    return false;
  }
  const r = response as Record<string, unknown>;
  return (
    r.type === "message" &&
    Array.isArray(r.content) &&
    typeof r.usage === "object" &&
    r.usage !== null &&
    typeof (r.usage as Record<string, unknown>).input_tokens === "number"
  );
}

export function isOpenAIResponse(response: unknown): response is OpenAIResponse {
  if (typeof response !== "object" || response === null) {
    return false;
  }
  const r = response as Record<string, unknown>;
  return (
    r.object === "chat.completion" &&
    Array.isArray(r.choices) &&
    r.choices.length > 0
  );
}

export function isOpenRouterResponse(response: unknown): response is OpenRouterResponse {
  return (
    isOpenAIResponse(response) &&
    ("provider" in response ||
      "model_used" in response ||
      response.id?.startsWith("openrouter-") === true)
  );
}

export function isOllamaResponse(response: unknown): response is OllamaResponse {
  if (typeof response !== "object" || response === null) {
    return false;
  }
  const r = response as Record<string, unknown>;
  return (
    typeof r.model === "string" &&
    typeof r.message === "object" &&
    r.message !== null &&
    typeof r.done === "boolean"
  );
}

// Type guards for content types
export function isAnthropicTextContent(
  content: AnthropicContent
): content is AnthropicContent & { text: string } {
  return content.type === "text" && typeof content.text === "string";
}

export function isAnthropicToolContent(
  content: AnthropicContent
): content is AnthropicContent & { name: string; input: Record<string, unknown>; id: string } {
  return (
    content.type === "tool_use" &&
    typeof content.name === "string" &&
    content.input !== undefined &&
    typeof content.id === "string"
  );
}

// Response normalization utilities
export interface NormalizedUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  cost?: number;
}

export function normalizeUsage(response: ProviderResponse): NormalizedUsage | undefined {
  if (isAnthropicResponse(response)) {
    return {
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      cacheCreationTokens: response.usage.cache_creation_input_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens,
    };
  }

  if (isOpenAIResponse(response) && response.usage) {
    return {
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
    };
  }

  if (isOpenRouterResponse(response) && response.usage) {
    return {
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
      cost: response.usage.total_cost,
    };
  }

  if (isOllamaResponse(response)) {
    // Ollama doesn't provide token counts in the same format
    return {
      promptTokens: response.prompt_eval_count || 0,
      completionTokens: response.eval_count || 0,
      totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0),
    };
  }

  return undefined;
}

export function extractResponseContent(response: ProviderResponse): string {
  if (isAnthropicResponse(response)) {
    return response.content
      .filter(isAnthropicTextContent)
      .map((c) => c.text)
      .join("\n");
  }

  if (isOpenAIResponse(response)) {
    return response.choices[0]?.message?.content || "";
  }

  if (isOllamaResponse(response)) {
    return response.message.content;
  }

  return "";
}

export function extractToolCalls(response: ProviderResponse): unknown[] {
  if (isAnthropicResponse(response)) {
    return response.content.filter(isAnthropicToolContent);
  }

  if (isOpenAIResponse(response)) {
    return response.choices[0]?.message?.tool_calls || [];
  }

  if (isOllamaResponse(response)) {
    return response.message.tool_calls || [];
  }

  return [];
}
