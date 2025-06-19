import { BaseLLMProvider } from "@/llm/BaseLLMProvider";
import type { LLMContext, LLMMessage, LLMResponse, ProviderTool } from "@/llm/types";
import type { AnthropicResponse, OpenAIResponse } from "@/llm/types/responses";
import type { LLMConfig } from "@/utils/agents/types";

export interface MockResponse {
    content: string;
    model?: string;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    toolCalls?: Array<{
        name: string;
        arguments: Record<string, unknown>;
        id?: string;
    }>;
    delay?: number; // Simulate network delay
    shouldFail?: boolean;
    failureReason?: string;
}

export class MockLLMProvider extends BaseLLMProvider {
    protected readonly providerName = "Mock";
    protected readonly defaultModel = "mock-model";
    protected readonly defaultBaseURL = "http://mock.api";

    private responseQueue: MockResponse[] = [];
    private requestHistory: Array<{
        messages: LLMMessage[];
        config: LLMConfig;
        context?: LLMContext;
        tools?: ProviderTool[];
        timestamp: number;
    }> = [];

    constructor(responses: MockResponse[] = []) {
        super();
        this.responseQueue = [...responses];
    }

    // Add responses to the queue
    addResponse(response: MockResponse): void {
        this.responseQueue.push(response);
    }

    addResponses(responses: MockResponse[]): void {
        this.responseQueue.push(...responses);
    }

    // Get request history for testing
    getRequestHistory() {
        return [...this.requestHistory];
    }

    getLastRequest() {
        return this.requestHistory[this.requestHistory.length - 1];
    }

    clearHistory(): void {
        this.requestHistory = [];
    }

    clearResponses(): void {
        this.responseQueue = [];
    }

    protected buildRequestBody(
        messages: LLMMessage[],
        config: LLMConfig,
        model: string,
        tools?: ProviderTool[]
    ): Record<string, unknown> {
        return {
            model,
            messages,
            max_tokens: config.maxTokens,
            temperature: config.temperature,
            tools: tools?.map((tool) => {
                if ("function" in tool) {
                    // OpenAI format
                    return {
                        name: tool.function.name,
                        description: tool.function.description,
                        parameters: tool.function.parameters,
                    };
                }
                // Anthropic format
                return {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.input_schema,
                };
            }),
        };
    }

    protected async makeRequest(
        _baseURL: string,
        requestBody: Record<string, unknown>,
        config: LLMConfig
    ): Promise<Response> {
        // Record the request
        this.requestHistory.push({
            messages: requestBody.messages as LLMMessage[],
            config,
            timestamp: Date.now(),
        });

        // Get next response from queue
        const mockResponse = this.responseQueue.shift();
        if (!mockResponse) {
            throw new Error("No more mock responses available");
        }

        // Simulate network delay
        if (mockResponse.delay) {
            await new Promise((resolve) => setTimeout(resolve, mockResponse.delay));
        }

        // Simulate failure
        if (mockResponse.shouldFail) {
            return new Response(
                JSON.stringify({ error: mockResponse.failureReason || "Mock failure" }),
                {
                    status: 500,
                }
            );
        }

        // Create mock response based on format preference
        const responseData = this.createMockResponseData(mockResponse, config);

        return new Response(JSON.stringify(responseData), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }

    private createMockResponseData(mockResponse: MockResponse, config: LLMConfig): unknown {
        // Default to Anthropic format, but can be customized
        if (config.provider === "openai" || config.provider === "openrouter") {
            return this.createOpenAIFormat(mockResponse);
        }
        if (config.provider === "ollama") {
            return this.createOllamaFormat(mockResponse);
        }
        return this.createAnthropicFormat(mockResponse);
    }

    private createAnthropicFormat(mockResponse: MockResponse): AnthropicResponse {
        const content: Array<Record<string, unknown>> = [
            {
                type: "text",
                text: mockResponse.content,
            },
        ];

        // Add tool calls if present
        if (mockResponse.toolCalls) {
            for (const toolCall of mockResponse.toolCalls) {
                content.push({
                    type: "tool_use",
                    id: toolCall.id || `tool_${Math.random().toString(36).substr(2, 9)}`,
                    name: toolCall.name,
                    input: toolCall.arguments,
                });
            }
        }

        return {
            id: `msg_${Math.random().toString(36).substr(2, 9)}`,
            type: "message",
            role: "assistant",
            content,
            model: mockResponse.model || this.defaultModel,
            stop_reason: "end_turn",
            usage: {
                input_tokens: mockResponse.usage?.prompt_tokens || 10,
                output_tokens: mockResponse.usage?.completion_tokens || 20,
                cache_creation_input_tokens: 0,
                cache_read_input_tokens: 0,
            },
        };
    }

    private createOpenAIFormat(mockResponse: MockResponse): OpenAIResponse {
        const toolCalls = mockResponse.toolCalls?.map((toolCall) => ({
            id: toolCall.id || `call_${Math.random().toString(36).substr(2, 9)}`,
            type: "function" as const,
            function: {
                name: toolCall.name,
                arguments: JSON.stringify(toolCall.arguments),
            },
        }));

        return {
            id: `chatcmpl-${Math.random().toString(36).substr(2, 9)}`,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: mockResponse.model || this.defaultModel,
            choices: [
                {
                    index: 0,
                    message: {
                        role: "assistant",
                        content: mockResponse.content,
                        tool_calls: toolCalls,
                    },
                    finish_reason: toolCalls ? "tool_calls" : "stop",
                },
            ],
            usage: mockResponse.usage || {
                prompt_tokens: 10,
                completion_tokens: 20,
                total_tokens: 30,
            },
        };
    }

    private createOllamaFormat(mockResponse: MockResponse): Record<string, unknown> {
        const toolCalls = mockResponse.toolCalls?.map((toolCall) => ({
            id: toolCall.id || `call_${Math.random().toString(36).substr(2, 9)}`,
            type: "function" as const,
            function: {
                name: toolCall.name,
                arguments: JSON.stringify(toolCall.arguments),
            },
        }));

        return {
            model: mockResponse.model || this.defaultModel,
            created_at: new Date().toISOString(),
            message: {
                role: "assistant",
                content: mockResponse.content,
                tool_calls: toolCalls,
            },
            done: true,
            total_duration: 1000000,
            load_duration: 100000,
            prompt_eval_count: mockResponse.usage?.prompt_tokens || 10,
            prompt_eval_duration: 500000,
            eval_count: mockResponse.usage?.completion_tokens || 20,
            eval_duration: 400000,
        };
    }

    protected parseResponse(data: unknown): LLMResponse {
        // Use the appropriate parser based on the response format
        if (typeof data === "object" && data !== null) {
            const response = data as Record<string, unknown>;

            if (response.type === "message") {
                // Anthropic format
                return this.parseAnthropicResponse(response);
            }
            if (response.object === "chat.completion") {
                // OpenAI format
                return this.parseOpenAIResponse(response);
            }
            if (response.message && response.done !== undefined) {
                // Ollama format
                return this.parseOllamaResponse(response);
            }
        }

        throw new Error("Unknown response format");
    }

    private parseAnthropicResponse(data: Record<string, unknown>): LLMResponse {
        let content = "";
        const toolCalls: unknown[] = [];

        for (const block of data.content || []) {
            if (block.type === "text") {
                content += block.text;
            } else if (block.type === "tool_use") {
                toolCalls.push(block);
            }
        }

        // Add tool calls to content
        if (toolCalls.length > 0) {
            content += this.formatToolCallsAsText(toolCalls);
        }

        return {
            content,
            model: data.model,
            usage: data.usage
                ? {
                      prompt_tokens: data.usage.input_tokens,
                      completion_tokens: data.usage.output_tokens,
                      total_tokens: data.usage.input_tokens + data.usage.output_tokens,
                  }
                : undefined,
        };
    }

    private parseOpenAIResponse(data: Record<string, unknown>): LLMResponse {
        const choice = data.choices?.[0];
        return {
            content: choice?.message?.content || "",
            model: data.model,
            usage: data.usage,
        };
    }

    private parseOllamaResponse(data: Record<string, unknown>): LLMResponse {
        return {
            content: data.message?.content || "",
            model: data.model,
            usage: {
                prompt_tokens: data.prompt_eval_count || 0,
                completion_tokens: data.eval_count || 0,
                total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
            },
        };
    }

    protected extractToolCallData(
        toolCall: unknown
    ): { name: string; arguments: Record<string, unknown> } | null {
        if (typeof toolCall !== "object" || toolCall === null) {
            return null;
        }

        const tool = toolCall as Record<string, unknown>;

        if (tool.type === "tool_use") {
            return {
                name: (tool.name as string) || "",
                arguments: (tool.input as Record<string, unknown>) || {},
            };
        }

        if (tool.function && typeof tool.function === "object") {
            const func = tool.function as Record<string, unknown>;
            return {
                name: (func.name as string) || "",
                arguments:
                    typeof func.arguments === "string"
                        ? JSON.parse(func.arguments)
                        : (func.arguments as Record<string, unknown>) || {},
            };
        }

        return null;
    }

    protected extractUsage(
        data: unknown
    ): { prompt_tokens?: number; completion_tokens?: number } | null {
        if (data.usage) {
            if (data.usage.input_tokens !== undefined && data.usage.output_tokens !== undefined) {
                // Anthropic format
                return {
                    prompt_tokens: data.usage.input_tokens,
                    completion_tokens: data.usage.output_tokens,
                };
            }
            if (
                data.usage.prompt_tokens !== undefined &&
                data.usage.completion_tokens !== undefined
            ) {
                // OpenAI format
                return {
                    prompt_tokens: data.usage.prompt_tokens,
                    completion_tokens: data.usage.completion_tokens,
                };
            }
        }
        return null;
    }
}

// Factory for creating mock providers with predefined scenarios
export class MockProviderFactory {
    static createSimpleProvider(responses: string[]): MockLLMProvider {
        const mockResponses = responses.map((content) => ({ content }));
        return new MockLLMProvider(mockResponses);
    }

    static createProviderWithToolCalls(
        scenarios: Array<{
            content: string;
            toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>;
        }>
    ): MockLLMProvider {
        return new MockLLMProvider(scenarios);
    }

    static createFailingProvider(failureReason?: string): MockLLMProvider {
        return new MockLLMProvider([
            {
                content: "",
                shouldFail: true,
                failureReason,
            },
        ]);
    }

    static createSlowProvider(delay: number): MockLLMProvider {
        return new MockLLMProvider([
            {
                content: "Slow response",
                delay,
            },
        ]);
    }
}
