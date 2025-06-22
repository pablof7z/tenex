# Codebase Duplication Analysis

## 1. Type/Interface Duplications

### Message Types
- **`Message` interface** appears in:
  - `/src/core/llm/types.ts` - Clean LLM message type with role and content
  - `/src/utils/claude/ClaudeParser.ts` - Re-exports `ClaudeCodeMessage` from claude types

### Tool-Related Types
- **`Tool*` types** spread across multiple files:
  - `/src/types/tool.ts` - Main tool type definitions (ToolInvocation, ToolExecutionResult, etc.)
  - `/src/core/llm/types.ts` - ToolDefinition, ToolCall for LLM interactions
  - Multiple prompt fragment files reference tools

### Routing Types
- **Duplicate routing structures**:
  - `/src/types/routing.ts` - RoutingDecision, RoutingContext, AgentSummary
  - `/src/routing/types.ts` - Similar RoutingDecision, RoutingContext with slightly different fields
  - Both define routing decisions but with incompatible structures

### Conversation Types
- **Conversation definitions**:
  - `/src/types/conversation.ts` - Basic Conversation interface
  - `/src/conversations/types.ts` - ConversationState with similar structure but different metadata handling

### LLM Configuration Types
- **Multiple LLM config definitions**:
  - `/src/types/llm.ts` - LLMConfig, LLMProvider, ProviderCredentials
  - `/src/core/llm/types.ts` - LLMConfig with different structure
  - `/src/types/config.ts` - TenexLLMs configuration schema
  - Overlapping but incompatible definitions

### Agent Types
- **Agent-related types** spread across:
  - `/src/types/agent.ts` - Main Agent interface
  - `/src/agents/execution/types.ts` - AgentExecutionContext, AgentExecutionResult
  - `/src/core/types/agents.ts` - Potentially more agent types

## 2. Result/Response Pattern Duplications

### Execution Results
- **Similar result structures**:
  - `ToolExecutionResult` in `/src/types/tool.ts`
  - `AgentExecutionResult` in `/src/agents/execution/types.ts`
  - `CompletionResponse` in `/src/core/llm/types.ts`
  - `LLMResponse` in `/src/types/llm.ts`
  - All follow similar pattern: success/content/error/metadata

### Context Types
- **Multiple context definitions**:
  - `AgentContext` in `/src/types/agent.ts`
  - `AgentExecutionContext` in `/src/agents/execution/types.ts`
  - `RoutingContext` appears in both routing type files
  - `ToolExecutionContext` in `/src/types/tool.ts`

## 3. Common Patterns

### Phase Type
- `Phase` type is consistently defined as union type in `/src/types/conversation.ts`
- Referenced across many files, which is good centralization

### Metadata Patterns
- Multiple interfaces define metadata as `Record<string, unknown>` or similar
- Could be centralized into a common Metadata type

### Token Usage
- `TokenUsage` interface appears in:
  - `/src/types/llm.ts`
  - Referenced in `/src/core/llm/types.ts`

## 4. Recommendations

1. **Consolidate routing types** - Merge `/src/types/routing.ts` and `/src/routing/types.ts`
2. **Unify LLM configurations** - Single source of truth for LLM config types
3. **Standardize result types** - Create base Result interface that others extend
4. **Merge conversation types** - Consolidate Conversation and ConversationState
5. **Create shared context types** - Base context interface that specific contexts extend
6. **Centralize tool types** - Keep all tool-related types in `/src/types/tool.ts`

## 5. Naming Conflicts

- `Message` - Used for both generic messages and Claude-specific messages
- `LLMConfig` - Defined differently in multiple places
- `RoutingContext` and `RoutingDecision` - Incompatible definitions in different files
- Various `*Result` and `*Response` types with similar purposes