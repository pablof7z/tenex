# @tenex/types

Centralized TypeScript type definitions for the TENEX ecosystem.

## Important Note

This package does **NOT** re-wrap NDK event classes (`NDKEvent`, `NDKArticle`, `NDKAgent`, etc.). Always use the `@nostr-dev-kit/ndk` library directly for those. This package focuses on:

- Content structure interfaces (e.g., message content, metadata)
- Configuration types (agents, LLM, projects)
- Tool and execution types
- Error handling utilities
- Common utility types

## Installation

```bash
bun add @tenex/types
```

## Usage

Import types from the main package:

```typescript
import { 
  AgentDefinition, 
  LLMConfig, 
  ProjectMetadata,
  ToolDefinition 
} from '@tenex/types';
```

Or import from specific modules:

```typescript
import { AgentProfile, AgentsJson } from '@tenex/types/agents';
import { LLMMessage, LLMResponse } from '@tenex/types/llm';
import { EVENT_KINDS, NostrEvent } from '@tenex/types/events';
```

## Available Type Modules

### `/agents`
- Agent configuration types
- Agent profile and metadata
- Agent-related Nostr events

### `/llm`
- LLM provider configurations
- Message formats
- Response types
- Provider-specific types

### `/tools`
- Tool definitions
- Execution context and results
- Tool metadata

### `/projects`
- Project metadata
- Project status
- Initialization options

### `/events`
- Nostr event kinds
- Base event types
- Project and chat events

### `/conversations`
- Conversation messages
- Conversation context
- Participant types

### `/utils`
- Error types and utilities
- Common utility types

## Type Safety

All types are strictly typed with no `any` usage. The package provides:

- Type guards for runtime type checking
- Error handling utilities
- Proper type inference
- Comprehensive JSDoc documentation

## Contributing

When adding new types:

1. Place them in the appropriate module
2. Export from the module's index.ts
3. Add to main index.ts if commonly used
4. Include JSDoc comments
5. Avoid using `any` - use `unknown` with type guards instead

## Migration from @tenex/shared

This package extracts and centralizes types previously scattered across components. To migrate:

1. Update imports from `@tenex/shared` to `@tenex/types`
2. Remove local type definitions that duplicate these
3. Use the centralized error utilities