# LLM Provider System Technical Specification

## Overview

The TENEX LLM Provider System is a sophisticated abstraction layer that provides a unified interface for interacting with multiple Large Language Model providers. It supports Anthropic (Claude), OpenAI (GPT), OpenRouter (multi-model), and Ollama (local models) while offering advanced features like prompt caching, typing indicators, tool integration, and comprehensive cost tracking.

## Architecture

```
┌─────────────────────────────────────────────────┐
│            Application Layer                     │
│         LLMProviderAdapter                      │
├─────────────────────────────────────────────────┤
│           Enhancement Layer                      │
│  TypingAwareLLMProvider, ToolEnabledProvider   │
├─────────────────────────────────────────────────┤
│            Provider Layer                        │
│  AnthropicProvider, OpenAIProvider,            │
│  OpenRouterProvider, OllamaProvider             │
├─────────────────────────────────────────────────┤
│          Infrastructure Layer                    │
│  CacheManager, MessageFormatter,               │
│  ProviderRegistry, CostCalculator              │
└─────────────────────────────────────────────────┘
```

## Core Components

### 1. LLMProvider Interface (`types.ts`)

The base interface all providers implement:

```typescript
interface LLMProvider {
    generateResponse(options: {
        messages: Message[];
        systemPrompt?: string;
        toolDefinitions?: ToolDefinition[];
        temperature?: number;
        maxTokens?: number;
    }): AsyncGenerator<LLMResponse>;
}
```

**Key Types:**
- `Message`: User/assistant message with role and content
- `LLMResponse`: Streamed response chunks with content, tool calls, and usage
- `ToolDefinition`: Tool schemas for function calling
- `TokenUsage`: Input/output token counts and costs

### 2. Provider Implementations

#### AnthropicProvider (`providers/AnthropicProvider.ts`)

Integrates with Anthropic's Claude models:

**Features:**
- **Prompt Caching**: 90% cost reduction on cached prompts
- **Cache Breakpoints**: Strategic placement for optimal cache hits
- **Beta Headers**: Supports latest Anthropic features
- **Streaming**: Real-time response streaming

**Caching Strategy:**
```typescript
// Cache breakpoints are added after:
1. System prompts (immutable context)
2. Project specifications (rarely change)
3. Historical messages (fixed context)
4. Tool definitions (static schemas)
```

#### OpenAIProvider (`providers/OpenAIProvider.ts`)

Integrates with OpenAI's GPT models:

**Features:**
- **Function Calling**: Native OpenAI function calling
- **Streaming**: Server-sent events for real-time responses
- **Model Variants**: GPT-4, GPT-4-turbo, GPT-3.5-turbo support
- **Token Tracking**: Accurate usage statistics

#### OpenRouterProvider (`providers/OpenRouterProvider.ts`)

Multi-model provider with automatic routing:

**Features:**
- **Model Selection**: Access to 100+ models
- **Automatic Caching**: For supported models
- **Fallback Handling**: Automatic model switching on failures
- **Cost Optimization**: Routes to cheapest suitable model

#### OllamaProvider (`providers/OllamaProvider.ts`)

Local model execution via Ollama:

**Features:**
- **Local Inference**: No API costs
- **Custom Models**: Support for fine-tuned models
- **Streaming**: Real-time local generation
- **Resource Management**: Automatic model loading/unloading

### 3. Enhancement Wrappers

#### TypingAwareLLMProvider (`TypingAwareLLMProvider.ts`)

Adds typing indicator support to any provider:

**Functionality:**
- **Automatic Publishing**: Publishes typing start/stop events
- **Prompt Visibility**: Includes actual prompts in typing indicators
- **Privacy Protection**: Intelligent prompt truncation
- **Transparent Wrapping**: No impact on underlying provider

**Event Flow:**
```
1. User message received
2. Typing indicator published (kind 24111) with prompts
3. LLM generation begins
4. Response streamed
5. Typing stopped (kind 24112)
```

#### ToolEnabledProvider (`ToolEnabledProvider.ts`)

Adds tool calling to providers without native support:

**Features:**
- **Universal Tool Support**: Works with any provider
- **Structured Output**: Enforces tool call format
- **Execution Handling**: Manages tool execution flow
- **Error Recovery**: Graceful handling of tool failures

### 4. Infrastructure Components

#### CacheManager (`cache/CacheManager.ts`)

Manages prompt caching across providers:

**Capabilities:**
- **Cache Key Generation**: Deterministic key creation
- **TTL Management**: Time-based cache expiration  
- **Size Limits**: Prevents unbounded growth
- **Hit Rate Tracking**: Performance monitoring

**Cache Storage Structure:**
```typescript
interface CacheEntry {
    key: string;
    messages: Message[];
    systemPrompt: string;
    timestamp: number;
    hits: number;
    byteSize: number;
}
```

#### MessageFormatter (`formatters/MessageFormatter.ts`)

Converts between provider-specific message formats:

**Transformations:**
- **Role Mapping**: user/assistant/system across providers
- **Content Structure**: Text vs. multimodal content
- **Tool Call Format**: Provider-specific tool invocations
- **Special Tokens**: Provider-specific markers

#### ProviderRegistry (`registry/ProviderRegistry.ts`)

Manages provider instances and selection:

**Features:**
- **Dynamic Registration**: Add providers at runtime
- **Model Mapping**: Model name to provider resolution
- **Health Checks**: Provider availability monitoring
- **Fallback Chains**: Automatic failover logic

#### CostCalculator (`utils/costCalculator.ts`)

Tracks and calculates LLM usage costs:

**Pricing Data:**
```typescript
const pricing = {
    "claude-3-opus": { input: 15.0, output: 75.0 },    // per 1M tokens
    "gpt-4": { input: 30.0, output: 60.0 },
    "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
    // ... more models
};
```

**Cost Tracking:**
- Per-message cost calculation
- Conversation total tracking
- Provider comparison
- Budget monitoring

### 5. LLMProviderAdapter (`infrastructure/LLMProviderAdapter.ts`)

Bridge between agent system and providers:

**Key Functions:**
- `createLLMProvider()`: Factory for creating configured providers
- `enhanceWithTypingIndicators()`: Adds typing support
- `wrapWithTools()`: Adds tool support if needed

**Provider Creation Flow:**
```typescript
1. Select base provider based on config
2. Configure with API keys and settings
3. Wrap with tool support if tools provided
4. Enhance with typing indicators
5. Return configured provider
```

## Configuration

### LLM Configuration Schema

```typescript
interface LLMConfig {
    provider: "anthropic" | "openai" | "openrouter" | "ollama";
    model: string;
    apiKey?: string;
    baseURL?: string;
    temperature?: number;
    maxTokens?: number;
    enableCaching?: boolean;
    contextWindowSize?: number;
    headers?: Record<string, string>;
}
```

### Example Configurations

```json
// Anthropic with caching
{
    "provider": "anthropic",
    "model": "claude-3-opus-20240229",
    "enableCaching": true,
    "contextWindowSize": 200000,
    "temperature": 0.7
}

// OpenRouter with fallback
{
    "provider": "openrouter",
    "model": "anthropic/claude-3-opus",
    "headers": {
        "X-Title": "TENEX Agent"
    }
}

// Local Ollama
{
    "provider": "ollama",
    "model": "llama3:70b",
    "baseURL": "http://localhost:11434"
}
```

## Advanced Features

### 1. Prompt Caching

**How it works:**
- System prompts and static content are marked as cacheable
- Cache keys are generated from content hashes
- Subsequent requests reuse cached prefixes
- Billing only charges for cache read + new tokens

**Optimization Strategies:**
- Place static content first
- Use consistent system prompts
- Order messages for maximum cache hits
- Monitor cache performance metrics

### 2. Streaming Response Handling

**Stream Processing:**
```typescript
async function* streamResponse() {
    for await (const chunk of provider.generateResponse(options)) {
        // Process content chunks
        if (chunk.content) yield { type: 'content', data: chunk.content };
        
        // Handle tool calls
        if (chunk.toolCalls) yield { type: 'tools', data: chunk.toolCalls };
        
        // Track usage
        if (chunk.usage) yield { type: 'usage', data: chunk.usage };
    }
}
```

### 3. Tool Integration

**Tool Call Flow:**
1. Provider generates tool call request
2. System extracts tool name and parameters
3. Tool executor runs the tool
4. Results are formatted and returned
5. Provider continues with tool results

### 4. Error Handling

**Error Types:**
- **RateLimitError**: Provider rate limits exceeded
- **AuthenticationError**: Invalid API credentials
- **ModelNotFoundError**: Requested model unavailable
- **ContextLengthError**: Input exceeds model limits
- **NetworkError**: Connection failures

**Recovery Strategies:**
- Exponential backoff for rate limits
- Automatic provider failover
- Context truncation for length errors
- Request retry with jitter

## Performance Optimizations

### 1. Context Window Management

```typescript
class ContextOptimizer {
    optimize(messages: Message[], limit: number): Message[] {
        // 1. Calculate token counts
        // 2. Identify truncation points
        // 3. Preserve system messages
        // 4. Trim historical context
        // 5. Maintain conversation coherence
    }
}
```

### 2. Parallel Provider Initialization

Providers are initialized lazily and cached:
```typescript
const providerCache = new Map<string, LLMProvider>();
```

### 3. Response Caching

Frequently requested completions are cached:
- Cache key includes messages, model, and parameters
- TTL based on content volatility
- Memory-efficient storage

## Testing Support

### Mock Providers

```typescript
class MockLLMProvider implements LLMProvider {
    constructor(private responses: string[]) {}
    
    async* generateResponse(): AsyncGenerator<LLMResponse> {
        for (const response of this.responses) {
            yield { content: response, usage: { input: 10, output: 20 } };
        }
    }
}
```

### Testing Utilities

- **Token counting**: Accurate token estimation
- **Cost simulation**: Predict costs before execution
- **Performance benchmarks**: Provider comparison
- **Error injection**: Test error handling

## Best Practices

### 1. Provider Selection
- Use Anthropic for complex reasoning tasks
- Use GPT-3.5-turbo for simple completions
- Use Ollama for sensitive data
- Use OpenRouter for model flexibility

### 2. Caching Strategy
- Enable caching for production
- Monitor cache hit rates
- Optimize prompt ordering
- Clear cache on schema changes

### 3. Error Handling
- Always implement retry logic
- Log all errors with context
- Monitor provider health
- Have fallback providers

### 4. Cost Management
- Set token limits appropriately
- Monitor usage patterns
- Use cheaper models when suitable
- Implement spending alerts

## Extension Guide

### Adding a New Provider

1. Implement the `LLMProvider` interface
2. Handle provider-specific authentication
3. Implement streaming response generation
4. Add to provider registry
5. Update cost calculator with pricing
6. Add provider tests

### Adding Enhancement Wrappers

1. Create wrapper implementing `LLMProvider`
2. Delegate to wrapped provider
3. Inject enhancement logic
4. Maintain streaming compatibility
5. Preserve error handling

This specification provides a comprehensive understanding of the TENEX LLM Provider System, enabling developers and AI agents to effectively integrate and extend LLM capabilities.