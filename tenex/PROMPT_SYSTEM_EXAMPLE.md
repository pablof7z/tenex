# Modular Prompt System Example

## How to Use the Prompt System

### 1. Simple Usage - Building a Routing Prompt
```typescript
import { RoutingPromptBuilder } from '@/prompts';

const prompt = RoutingPromptBuilder.newConversation({
  message: "I want to build a todo app",
  agents: [
    { name: "React Expert", pubkey: "npub1...", role: "Frontend Dev", expertise: "React, TypeScript" },
    { name: "Backend Pro", pubkey: "npub2...", role: "Backend Dev", expertise: "Node.js, PostgreSQL" }
  ]
});
```

### 2. Custom Prompt Composition
```typescript
import { PromptBuilder } from '@/prompts';

// Build a custom prompt using fragments
const customPrompt = new PromptBuilder()
  .add('base-context', { 
    content: 'You are helping design a database schema.' 
  })
  .add('requirements', { 
    content: 'User needs: multi-tenant SaaS with billing' 
  })
  .add('tool-list', { 
    tools: [
      { name: 'sql-designer', description: 'Design SQL schemas' },
      { name: 'erd-generator', description: 'Generate ERD diagrams' }
    ]
  })
  .add('json-response', {
    schema: '{ "tables": [], "relationships": [] }'
  })
  .build();
```

### 3. Creating New Fragments
```typescript
// src/prompts/fragments/custom.ts
import { PromptFragment } from '../core/types';
import { fragmentRegistry } from '../core/FragmentRegistry';

export const databaseSchemaFragment: PromptFragment<{ tables: string[] }> = {
  id: 'database-schema',
  priority: 30,
  template: ({ tables }) => `
Current database tables:
${tables.map(t => `- ${t}`).join('\n')}

Consider relationships, indexes, and constraints.`
};

// Register it
fragmentRegistry.register(databaseSchemaFragment);
```

### 4. Conditional Fragments
```typescript
const agentPrompt = new PromptBuilder()
  .add('agent-identity', { name: 'CodeBot', role: 'Developer', expertise: 'Full-stack' })
  .add('project-context', { content: 'E-commerce platform' })
  .add('tool-list', { tools }, 
    // Only add tools if they exist
    (args) => args.tools.length > 0
  )
  .add('custom-instructions', { content: agent.instructions },
    // Only add if agent has custom instructions
    (args) => !!args.content
  )
  .build();
```

### 5. Agent Response with Structured Output
```typescript
const feedbackPrompt = AgentPromptBuilder.buildExpertFeedbackPrompt(
  expertAgent,
  codeToReview,
  "Reviewing authentication implementation"
);

// The prompt automatically includes:
// - Agent identity
// - Review context
// - Work to review
// - Structured JSON response format
// - Specific feedback criteria
```

## Benefits

1. **No Repetition**: Agent lists, tool descriptions, JSON schemas defined once
2. **Consistent**: All prompts follow same structure and formatting
3. **Flexible**: Easy to create custom prompts for new use cases
4. **Maintainable**: Update fragment logic in one place
5. **Testable**: Each fragment can be unit tested independently

## Architecture Balance

This design hits the sweet spot between:
- **Flexibility**: Can compose any prompt from fragments
- **Simplicity**: No complex DSL or over-engineering
- **Reusability**: Common patterns extracted to fragments
- **YAGNI**: Only built what's needed, can extend as required