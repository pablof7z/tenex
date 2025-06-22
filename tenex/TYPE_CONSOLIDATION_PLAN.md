# Type Consolidation Plan

## 1. Routing Types Consolidation

### Current State:
- `/src/types/routing.ts` - Simple, basic types (used by EventHandler)
- `/src/routing/types.ts` - More detailed types (used by RoutingLLM and internal routing)

### Resolution:
Keep `/src/routing/types.ts` as the source of truth and extend it with missing fields from `/src/types/routing.ts`.

### Changes Required:
1. Merge `messageContent` field into `RoutingContext` in `/src/routing/types.ts`
2. Merge `availableAgents` field into `RoutingContext` 
3. Update all imports to use `/src/routing/types.ts`
4. Delete `/src/types/routing.ts`

## 2. Result Types Consolidation

### Current State:
Multiple similar result patterns:
- `ToolExecutionResult`
- `AgentExecutionResult` 
- `CompletionResponse`
- `LLMResponse`

### Resolution:
Create a base `Result<T>` interface:

```typescript
// In /src/types/base.ts
export interface Result<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, unknown>;
}
```

Then extend for specific use cases.

## 3. Conversation Types Consolidation

### Current State:
- `/src/types/conversation.ts` - Basic `Conversation` interface
- `/src/conversations/types.ts` - `ConversationState` with extra fields

### Resolution:
Merge into single `Conversation` type in `/src/types/conversation.ts` with all necessary fields.

## 4. LLM Configuration Consolidation

### Current State:
- `/src/types/llm.ts` - Main LLM types
- `/src/core/llm/types.ts` - Different LLM config structure
- `/src/types/config.ts` - Config schema

### Resolution:
Use `/src/core/llm/types.ts` as source of truth for LLM operation types, keep config schema separate.

## 5. Implementation Order

1. **Phase 1**: Routing types (highest impact, most conflicts)
2. **Phase 2**: Result types (standardize patterns)
3. **Phase 3**: Conversation types (simplify conversions)
4. **Phase 4**: LLM types (least urgent)