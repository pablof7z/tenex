# Migration Guide: Moving to @tenex/types

This guide helps you migrate from scattered type definitions to the centralized `@tenex/types` package.

## Quick Start

1. Install the package:
```bash
bun add @tenex/types
```

2. Update your imports:

### Before
```typescript
// From shared
import { EVENT_KINDS, LLMConfig } from '@tenex/shared';
import type { ProjectMetadata } from '@tenex/shared/types/projects';

// Local definitions
import { ToolDefinition } from '../types';
import { AgentConfig } from './types';
```

### After
```typescript
// From @tenex/types
import { 
  EVENT_KINDS, 
  LLMConfig, 
  ProjectMetadata,
  ToolDefinition,
  AgentConfigEntry 
} from '@tenex/types';

// Or use specific imports
import { EVENT_KINDS } from '@tenex/types/events';
import { LLMConfig } from '@tenex/types/llm';
```

## Component-Specific Migration

### Web Client

1. Remove local type definitions in:
   - `src/utils/nostrEntityParser.ts` - Use types from `@tenex/types/events`
   - `src/events/agent.ts` - Use NDK directly, metadata from `@tenex/types/agents`

2. Update imports:
```typescript
// Before
import { EVENT_KINDS } from '@tenex/shared';

// After
import { EVENT_KINDS } from '@tenex/types/events';
```

### CLI

1. Replace local types in:
   - `src/utils/agents/llm/types.ts` → Use `@tenex/types/llm`
   - `src/utils/agents/tools/types.ts` → Use `@tenex/types/tools`
   - `src/types.ts` → Use appropriate modules from `@tenex/types`

2. Update error handling:
```typescript
// Before
catch (err: any) {
  console.error(err.message);
}

// After
import { getErrorMessage } from '@tenex/types/utils';

catch (err: unknown) {
  console.error(getErrorMessage(err));
}
```

### MCP Server

The MCP server is already clean! Just update any imports from shared:

```typescript
// Update shared imports
import { ProjectMetadata } from '@tenex/types/projects';
import { AgentConfigEntry } from '@tenex/types/agents';
```

### tenexd

1. Replace AI types:
```typescript
// Before
import { AIProvider } from './ai/types';

// After
import { LLMProvider } from '@tenex/types/llm';
```

## Important Changes

### 1. No NDK Event Wrappers

We do NOT wrap NDK events. Use NDK directly:

```typescript
// ❌ Don't do this
import { ProjectEvent } from '@tenex/types';

// ✅ Do this
import { NDKArticle } from '@nostr-dev-kit/ndk';
import { ProjectEventMetadata } from '@tenex/types/events';
```

### 2. Error Handling

Always use the error utilities:

```typescript
import { 
  TenexError, 
  getErrorMessage, 
  normalizeError 
} from '@tenex/types/utils';

// Create typed errors
throw new TenexError('Failed to load', 'CONFIG_NOT_FOUND');

// Handle unknown errors
catch (err: unknown) {
  const message = getErrorMessage(err);
  const error = normalizeError(err);
}
```

### 3. Type-Safe Event Kinds

Use the EVENT_KINDS constant:

```typescript
import { EVENT_KINDS } from '@tenex/types/events';

if (event.kind === EVENT_KINDS.TASK) {
  // Type-safe!
}
```

## Removing Duplicate Types

After migrating, remove these files:

### Web Client
- Local type definitions that duplicate @tenex/types

### CLI
- `src/utils/agents/llm/types.ts` (most types)
- `src/utils/agents/tools/types.ts` (most types)
- Duplicate type definitions in `src/types.ts`

### Shared
- Consider deprecating types that are now in @tenex/types

## Benefits

1. **Single Source of Truth**: All types in one place
2. **Better IDE Support**: Consistent autocomplete across projects
3. **Type Safety**: No more `any` types
4. **Maintainability**: Update types in one place
5. **Tree Shaking**: Import only what you need

## Troubleshooting

### Circular Dependencies

If you encounter circular dependencies, use type imports:

```typescript
import type { SomeType } from '@tenex/types';
```

### Missing Types

If a type is missing from @tenex/types, either:
1. Add it to the appropriate module
2. Keep it local if it's component-specific

### Build Errors

Ensure all components have `@tenex/types` in their dependencies:

```json
{
  "dependencies": {
    "@tenex/types": "workspace:*"
  }
}
```