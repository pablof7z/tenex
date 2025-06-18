# LLM Provider System Architecture

## Overview

The LLM Provider System is a comprehensive, type-safe, and modular architecture for interfacing with multiple Large Language Model providers. It supports Anthropic Claude, OpenAI GPT, OpenRouter, and Ollama models with unified interfaces, standardized error handling, and extensive testing capabilities.

## Core Architecture

### System Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
├─────────────────────────────────────────────────────────────┤
│                    Factory & Registry                       │
├─────────────────────────────────────────────────────────────┤
│                    Provider Interface                       │
├─────────────────────────────────────────────────────────────┤
│                    Utilities & Tools                        │
├─────────────────────────────────────────────────────────────┤
│                    Base Infrastructure                      │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. BaseLLMProvider (`BaseLLMProvider.ts`)

The foundation class that all providers extend. Implements the common lifecycle and error handling patterns.

**Key Responsibilities:**
- Request/response lifecycle management
- Standardized error handling with context preservation
- Configuration validation delegation
- Logging integration
- Tool call formatting

**Abstract Methods (Provider-specific):**
```typescript
protected abstract buildRequestBody(
    messages: LLMMessage[],
    config: LLMConfig,
    model: string,
    tools?: ProviderTool[]
): Record<string, unknown>;

protected abstract makeRequest(
    baseURL: string,
    requestBody: Record<string, unknown>,
    config: LLMConfig
): Promise<Response>;

protected abstract parseResponse(data: any): LLMResponse;

protected abstract extractUsage(data: any): Usage | null;

protected abstract extractToolCallData(toolCall: any): ToolData | null;
```

**Error Handling Flow:**
1. Network/HTTP errors → Provider-specific error creation
2. API errors → Status code-based error classification
3. Validation errors → Configuration validation errors
4. All errors include context (agent, project, conversation)

### 2. Provider Registry (`registry/ProviderRegistry.ts`)

Factory system with provider registration, discovery, and instantiation.

**Core Features:**
```typescript
// Provider Registration
ProviderRegistry.register(
    "anthropic",
    new SimpleProviderFactory(AnthropicProvider, undefined, 1),
    {
        description: "Anthropic Claude models",
        features: { tools: true, caching: true, streaming: true, multimodal: true }
    }
);

// Provider Creation
const provider = ProviderRegistry.create(config);

// Feature Discovery
const toolProviders = ProviderRegistry.getProvidersByFeature("tools");
const cachingProviders = ProviderRegistry.getProvidersByFeature("caching");
```

**Factory Pattern Implementation:**
- `SimpleProviderFactory`: Basic provider instantiation
- `ConditionalProviderFactory`: Conditional provider selection (e.g., caching)
- Custom factories can be implemented for complex provider logic

### 3. Configuration Validation (`utils/ConfigValidator.ts`)

Provider-specific validation with comprehensive error reporting.

**Validation Layers:**
1. **Required Fields**: API keys, models, provider-specific requirements
2. **Model Validation**: Provider-specific model lists with warnings
3. **Parameter Ranges**: Temperature (0-2), tokens, penalties (-2 to 2)
4. **Feature Support**: Caching, tools, streaming capabilities

**Provider Requirements Matrix:**
```typescript
{
    anthropic: {
        providerName: "Anthropic",
        requiresApiKey: true,
        requiresModel: true,
        validModels: ["claude-3-opus-20240229", "claude-3-5-sonnet-20241022", ...],
        supportedFeatures: { caching: true, tools: true, streaming: true, multimodal: true }
    },
    openai: {
        providerName: "OpenAI",
        requiresApiKey: true,
        validModels: ["gpt-4", "gpt-4-turbo", "gpt-4o", ...],
        supportedFeatures: { tools: true, streaming: true, multimodal: true }
    },
    // ... other providers
}
```

### 4. Type System (`types/` directory)

**Core Types:**
```typescript
// Base interfaces
interface LLMProvider {
    generateResponse(
        messages: LLMMessage[],
        config: LLMConfig,
        context?: LLMContext,
        tools?: ProviderTool[]
    ): Promise<LLMResponse>;
}

interface LLMMessage {
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    name?: string;
}

interface LLMResponse {
    content: string;
    model?: string;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
```

**Provider-Specific Response Types (`types/responses.ts`):**
```typescript
// Anthropic format
interface AnthropicResponse {
    id: string;
    type: "message";
    role: "assistant";
    content: AnthropicContent[];
    model: string;
    stop_reason: string;
    usage: AnthropicUsage;
}

// OpenAI format
interface OpenAIResponse {
    id: string;
    object: "chat.completion";
    created: number;
    model: string;
    choices: OpenAIChoice[];
    usage: OpenAIUsage;
}
```

**Type Guards:**
```typescript
function isAnthropicResponse(data: unknown): data is AnthropicResponse {
    return (
        typeof data === "object" &&
        data !== null &&
        "type" in data &&
        data.type === "message" &&
        "content" in data &&
        Array.isArray(data.content)
    );
}
```

## Utility Systems

### 1. Tool Call Parser (`utils/ToolCallParser.ts`)

Unified parsing across different provider formats.

**Supported Formats:**
- **Anthropic**: `{ type: "tool_use", id, name, input }`
- **OpenAI**: `{ function: { name, arguments: string } }`
- **OpenRouter**: OpenAI-compatible format
- **Ollama**: OpenAI-compatible format

**Parser Methods:**
```typescript
class ToolCallParser {
    static parseAnthropicToolCall(toolCall: any): ParsedToolCall | null;
    static parseOpenAIToolCall(toolCall: any): ParsedToolCall | null;
    static extractToolCallsByProvider(response: any, provider: string): ParsedToolCall[];
}
```

### 2. Message Formatting (`formatters/MessageFormatter.ts`)

Strategy pattern for provider-specific message formatting.

**Formatter Implementations:**
```typescript
// Anthropic: Separates system messages
class AnthropicMessageFormatter implements MessageFormatter {
    formatMessages(messages: LLMMessage[], config: LLMConfig): FormattedRequest {
        const systemMessage = messages.find(m => m.role === "system");
        const otherMessages = messages.filter(m => m.role !== "system");
        
        return {
            system: systemMessage?.content,
            messages: otherMessages
        };
    }
}

// OpenAI: Includes system messages in array
class OpenAIMessageFormatter implements MessageFormatter {
    formatMessages(messages: LLMMessage[], config: LLMConfig): FormattedRequest {
        return { messages };
    }
}
```

### 3. Logging System (`utils/LLMLogger.ts`)

Structured logging with configurable verbosity extracted from the base provider class.

**Logging Features:**
- **Request Logging**: Full prompts with color-coded output
- **Response Logging**: Token usage, costs, cache hits
- **Error Logging**: Structured error details with context
- **Telemetry**: Performance metrics and efficiency calculations

**Log Output Example:**
```
🤖 Anthropic LLM Configuration:
   Agent: code
   Model: claude-3-5-sonnet-20241022
   Max Tokens: 4000
   Temperature: 0.7

🚀 LLM REQUEST TO ANTHROPIC:
═══════════════════════════════════════
[Full system and user prompts displayed]
═══════════════════════════════════════

📨 LLM RESPONSE FROM ANTHROPIC:
═══════════════════════════════════════
[Response content displayed]
═══════════════════════════════════════

📊 Response Telemetry:
   Model: claude-3-5-sonnet-20241022
   Prompt tokens: 1,234
   Completion tokens: 567
   Total tokens: 1,801
   Efficiency: 2.45 chars/token
   Cost: $0.0234
```

### 4. Response Caching (`cache/ResponseCache.ts`)

Configurable caching system with TTL and size limits.

**Cache Configuration:**
```typescript
interface CacheConfig {
    enabled: boolean;
    ttl: number;        // Time to live in milliseconds
    maxSize: number;    // Maximum number of cached responses
}
```

**Cache Key Generation:**
```typescript
private generateCacheKey(messages: LLMMessage[], config: LLMConfig): string {
    const relevantConfig = {
        provider: config.provider,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens
    };
    
    return createHash("sha256")
        .update(JSON.stringify({ messages, config: relevantConfig }))
        .digest("hex");
}
```

**Cache Statistics:**
```typescript
interface CacheStats {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
    maxSize: number;
}
```

## Provider Implementations

### Anthropic Provider (`AnthropicProvider.ts`)

**Unique Features:**
- System message separation
- Cache control headers for prompt caching
- Tool use format: `{ type: "tool_use", id, name, input }`

**Request Format:**
```typescript
{
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 4000,
    system: "System prompt here",
    messages: [
        { role: "user", content: "User message" }
    ],
    tools: [...] // If tools provided
}
```

**Caching Implementation:**
`AnthropicProviderWithCache` extends `AnthropicProvider` and adds cache control headers:
```typescript
class AnthropicProviderWithCache extends AnthropicProvider {
    protected override buildRequestBody(...args): Record<string, unknown> {
        const body = super.buildRequestBody(...args);
        return this.addCacheControl(body, messages);
    }
    
    private addCacheControl(body: Record<string, unknown>, messages: LLMMessage[]): Record<string, unknown> {
        // Add cache_control to system message and last 2 user messages
    }
}
```

### OpenAI Provider (`OpenAIProvider.ts`)

**Features:**
- Standard OpenAI chat completions format
- Function calling support
- Streaming capabilities (future enhancement)

**Request Format:**
```typescript
{
    model: "gpt-4",
    messages: [
        { role: "system", content: "System prompt" },
        { role: "user", content: "User message" }
    ],
    tools: [...], // Function calling format
    tool_choice: "auto",
    temperature: 0.7,
    max_tokens: 4000
}
```

### OpenRouter Provider (`OpenRouterProvider.ts`)

**Features:**
- OpenAI-compatible API
- Support for multiple model providers
- Custom model routing

**Special Configuration:**
- API key validation (expects `sk-or-` prefix)
- Custom base URL handling
- Model-specific routing

## Tool Integration

### Tool Orchestrator (`tools/ToolOrchestrator.ts`)

Manages tool execution flow separate from response processing.

**Tool Processing Flow:**
1. **Parse Tool Calls**: Extract from provider response
2. **Validate Tools**: Check tool registry
3. **Execute Tools**: Run tool implementations
4. **Format Results**: Convert to provider-specific format
5. **Return Response**: Structured tool processing result

```typescript
interface ToolProcessingResult {
    success: boolean;
    results: ToolResult[];
    errors: ToolError[];
    formattedResponse?: string;
}
```

## Error Handling System

### Error Hierarchy (`utils/LLMProviderError.ts`)

```typescript
class LLMProviderError extends Error {
    constructor(
        message: string,
        public readonly provider: string,
        public readonly statusCode?: number,
        public readonly originalError?: unknown,
        public readonly context?: {
            agent?: string;
            project?: string;
            conversation?: string;
            model?: string;
        }
    )
}

class LLMValidationError extends LLMProviderError
class LLMRateLimitError extends LLMProviderError
class LLMAuthenticationError extends LLMProviderError
```

### Error Context Preservation

All errors include rich context for debugging:
```typescript
const errorContext = {
    agent: context.agentName,
    project: context.projectName,
    conversation: context.conversationId,
    model: this.defaultModel,
    timestamp: new Date().toISOString(),
    requestId: generateRequestId()
};
```

## Testing Infrastructure

### Mock Provider System (`testing/MockProvider.ts`)

Comprehensive mock system supporting all provider formats.

**Mock Response Configuration:**
```typescript
interface MockResponse {
    content: string;
    model?: string;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number; };
    toolCalls?: Array<{ name: string; arguments: any; id?: string; }>;
    delay?: number;        // Simulate network delay
    shouldFail?: boolean;  // Simulate failures
    failureReason?: string;
}
```

**Mock Factory Methods:**
```typescript
class MockProviderFactory {
    static createSimpleProvider(responses: string[]): MockLLMProvider;
    static createProviderWithToolCalls(scenarios: ToolCallScenario[]): MockLLMProvider;
    static createFailingProvider(failureReason?: string): MockLLMProvider;
    static createSlowProvider(delay: number): MockLLMProvider;
}
```

**Multi-Format Response Generation:**
The mock provider automatically generates responses in the correct format based on the provider configuration:
- Anthropic format: `{ type: "message", content: [...], usage: {...} }`
- OpenAI format: `{ object: "chat.completion", choices: [...], usage: {...} }`
- Ollama format: `{ message: {...}, done: true, eval_count: ... }`

### Test Coverage

**Comprehensive Test Suite:**
1. **Unit Tests**: Individual component testing
2. **Integration Tests**: Cross-component functionality
3. **Performance Tests**: Concurrent requests and caching
4. **Error Handling Tests**: All error scenarios
5. **Provider Compatibility Tests**: Format validation

**Test Categories:**
- Provider instantiation and configuration
- Request/response cycles
- Tool call parsing and formatting
- Caching behavior and TTL
- Error handling and recovery
- Mock provider simulation
- Feature discovery and validation

## Performance Optimizations

### 1. Provider Caching

**Factory-Level Caching:**
```typescript
// LLMFactory.ts
const providerCache = new Map<string, LLMProvider>();

export function createLLMProvider(config: LLMConfig): LLMProvider {
    const cacheKey = generateProviderCacheKey(config);
    
    if (providerCache.has(cacheKey)) {
        return providerCache.get(cacheKey)!;
    }
    
    const provider = ProviderRegistry.create(config, toolRegistry);
    providerCache.set(cacheKey, provider);
    return provider;
}
```

### 2. Response Caching

**Intelligent Cache Key Generation:**
- Includes only relevant configuration parameters
- Handles message ordering and content hashing
- Excludes non-deterministic parameters (timestamps, request IDs)

### 3. Concurrent Request Handling

**Optimized for High Throughput:**
- Thread-safe provider instances
- Efficient memory management
- Configurable connection pooling

## Configuration Management

### LLM Config Manager (`LLMConfigManager.ts`)

Centralized configuration management with environment variable support.

**Configuration Hierarchy:**
1. Explicit config parameters
2. Environment variables
3. Provider defaults
4. System defaults

**Environment Variable Support:**
```typescript
const config = LLMConfigManager.fromEnvironment({
    provider: process.env.LLM_PROVIDER || "anthropic",
    model: process.env.LLM_MODEL,
    apiKey: process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY,
    temperature: Number(process.env.LLM_TEMPERATURE) || 0.7,
    maxTokens: Number(process.env.LLM_MAX_TOKENS) || 4000
});
```

## Migration and Backward Compatibility

### Compatibility Layer

The refactored system maintains 100% backward compatibility with existing code:

**Old Usage (still works):**
```typescript
const provider = new AnthropicProvider();
const response = await provider.generateResponse(messages, config);
```

**New Usage (recommended):**
```typescript
const provider = createLLMProvider(config);
const response = await provider.generateResponse(messages, config);
```

### Migration Path

1. **Phase 1**: Use new factory for new code
2. **Phase 2**: Gradually migrate existing instantiations
3. **Phase 3**: Leverage new features (caching, validation, etc.)
4. **Phase 4**: Remove direct provider instantiation (optional)

## Future Enhancements

### Planned Features

1. **Streaming Support**: Real-time response streaming
2. **Retry Logic**: Configurable retry strategies with exponential backoff
3. **Rate Limiting**: Built-in rate limiting with provider-specific limits
4. **Metrics Collection**: Detailed usage analytics and performance metrics
5. **Plugin System**: Custom provider and tool plugins
6. **Configuration Validation**: Runtime schema validation
7. **Health Checks**: Provider availability monitoring

### Extension Points

The architecture provides clear extension points for:
- **New Providers**: Implement `BaseLLMProvider`
- **Custom Tools**: Extend `ToolOrchestrator`
- **Message Formatters**: Implement `MessageFormatter`
- **Cache Strategies**: Extend `ResponseCache`
- **Validation Rules**: Extend `ConfigValidator`

## Security Considerations

### API Key Management

- Never log API keys in plain text
- Support for environment variable injection
- Validation of key formats per provider
- Secure key rotation support

### Request/Response Security

- Input sanitization for all user content
- Output validation to prevent injection attacks
- Secure error messages (no sensitive data leakage)
- Request/response size limits

### Caching Security

- Cache key generation prevents cache poisoning
- TTL prevents stale data issues
- Size limits prevent memory exhaustion
- Secure cache invalidation

## Monitoring and Observability

### Logging Standards

All components follow structured logging:
```typescript
logger.info("LLM request initiated", {
    provider: "anthropic",
    model: "claude-3-5-sonnet-20241022",
    messageCount: 3,
    hasTools: true,
    requestId: "req_123"
});
```

### Metrics Collection

Key metrics tracked:
- Request/response latency
- Token usage and costs
- Cache hit rates
- Error rates by provider
- Tool execution times

### Error Tracking

Comprehensive error tracking:
- Error categorization by type and provider
- Context preservation for debugging
- Error rate monitoring and alerting
- Performance impact analysis

---

This architecture provides a robust, scalable, and maintainable foundation for LLM provider integration while maintaining simplicity in usage and extensive testing coverage.