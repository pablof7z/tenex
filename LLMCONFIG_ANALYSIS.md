# LLMConfig Type Analysis

## Summary

There are **three different definitions** of `LLMConfig` in the codebase:

### 1. Main Definition: `packages/types/src/llm/config.ts`
This is the full, comprehensive LLMConfig type with all provider-specific configurations:
- Used by most of the codebase
- Includes provider-specific types (AnthropicConfig, OpenAIConfig, etc.)
- Has all fields: provider, model, apiKey, baseURL, temperature, maxTokens, etc.
- This is the "source of truth" for LLM configurations

### 2. Orchestration Definition: `tenex/src/core/orchestration/types.ts`
A minimal LLMConfig interface with only 3 optional fields:
```typescript
export interface LLMConfig {
    model?: string;
    temperature?: number;
    maxTokens?: number;
}
```
- Used specifically within the orchestration system
- Designed for config overrides, not complete configurations
- Works alongside the full LLMConfig from packages/types

### 3. Re-export: `tenex/src/utils/agents/types.ts`
Simply re-exports the main definition:
```typescript
export type { LLMConfig } from "@tenex/types/llm";
```

## Usage Patterns

### Most Files Use the Main Definition
- Import from `@tenex/types/llm` or `@/utils/agents/types`
- Examples: AgentManager, LLMConfigManager, LLMFactory, etc.

### Orchestration System Uses Both
- `LLMProviderAdapter` imports both:
  - `LLMConfig` from `@/core/orchestration/types` (minimal)
  - `LLMConfig as AgentLLMConfig` from `@/utils/agents/types` (full)
- The minimal config is used for runtime overrides
- The full config is used for base configuration

## The Conflict

The orchestration system's minimal `LLMConfig` creates type conflicts when:
1. Code expects the full LLMConfig but receives the minimal one
2. The adapter tries to merge configurations
3. Type assertions are needed to bridge between the two

## Recommendation

The orchestration system should:
1. Rename its minimal interface to something like `LLMConfigOverrides` or `LLMRuntimeConfig`
2. Always use the main LLMConfig type from `@tenex/types/llm` for full configurations
3. Use the override type only for partial configuration updates

This would eliminate the type conflicts while maintaining the intended functionality of having lightweight config overrides in the orchestration layer.