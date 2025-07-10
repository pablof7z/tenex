# OpenRouter SDK Summary

## Installation
```bash
npm install @openrouter/ai-sdk-provider ai
```

## Key Findings

### 1. **Streaming Responses** ✅
- Works perfectly with the Vercel AI SDK
- Use `streamText()` and iterate over `textStream`
- Can track chunks for progress monitoring

### 2. **Cost & Token Metadata** ✅
- Token usage is available via `result.usage`
- Cost calculation requires fetching model pricing from `/api/v1/models`
- OpenRouter provides: `promptTokens`, `completionTokens`, `totalTokens`
- Headers are available but not through the standard Headers API

### 3. **Native Tool Calling** ✅
- Fully supported through Vercel AI SDK's `tool()` function
- Works with models that support function calling
- Can track tool calls through `result.steps`

### 4. **Prompt Caching** ❌
- Not directly supported by OpenRouter
- Even with Anthropic models, cache benefits aren't visible
- OpenRouter may not pass through provider-specific caching features

### 5. **Model Selection**
- 316+ models available
- Use `/api/v1/models` endpoint to get full catalog
- Models have different pricing, context lengths, and capabilities

## Code Examples

### Basic Usage
```typescript
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';

const openrouter = createOpenRouter({ apiKey: 'your-api-key' });

const result = await generateText({
  model: openrouter('openai/gpt-4-turbo-preview'),
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

### Streaming
```typescript
const result = await streamText({
  model: openrouter('openai/gpt-4-turbo-preview'),
  messages: [{ role: 'user', content: 'Tell me a story' }],
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```

### Cost Tracking
```typescript
// Fetch model pricing
const response = await fetch('https://openrouter.ai/api/v1/models', {
  headers: { 'Authorization': `Bearer ${apiKey}` },
});
const models = await response.json();

// Calculate cost
const pricing = models.data.find(m => m.id === modelId).pricing;
const cost = (usage.promptTokens / 1000) * pricing.prompt + 
             (usage.completionTokens / 1000) * pricing.completion;
```

## Advantages over multi-llm-ts
1. Native TypeScript support with proper types
2. Built on Vercel AI SDK - better ecosystem
3. Streaming works out of the box
4. Tool calling is well-integrated
5. Access to 300+ models through one API

## Migration Path
To replace multi-llm-ts:
1. Install the OpenRouter SDK
2. Create a wrapper class for cost tracking (see `openrouter-enhanced.ts`)
3. Use model selection logic based on requirements
4. Implement retry logic for production use
5. Track costs per request for billing

## Notes
- The "openrouter/auto" model shows unusual negative pricing
- Some models may fail with "Not Found" or "Bad Request" errors
- Rate limiting info should be available but wasn't in the headers during testing
- For production, implement proper error handling and retries