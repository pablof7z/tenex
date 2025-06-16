# Agent System Prompt Builder

This module provides a centralized, modular system for generating system prompts for TENEX agents.

## Overview

The `SystemPromptBuilder` uses a builder pattern with pluggable section builders to construct system prompts. Each section builder is responsible for a specific part of the prompt and can be enabled/disabled or prioritized as needed.

## Architecture

```
SystemPromptBuilder
├── Section Builders
│   ├── StaticInstructionsBuilder - Core TENEX instructions
│   ├── AgentIdentityBuilder - Agent role and configuration
│   ├── ProjectContextBuilder - Project information
│   ├── TeamInformationBuilder - Available agents
│   ├── ProjectRulesBuilder - Project-specific rules
│   └── AgentToAgentBuilder - Agent-to-agent communication
└── Constants
    ├── DEFAULT_SYSTEM_INSTRUCTIONS
    ├── AGENT_TO_AGENT_INSTRUCTIONS
    └── COLLABORATION_GUIDELINES
```

## Usage

### Basic Usage

```typescript
import { SystemPromptBuilder } from './SystemPromptBuilder';
import type { SystemPromptContext } from './types';

const builder = new SystemPromptBuilder();
const context: SystemPromptContext = {
    agentName: 'code-agent',
    agentConfig: { /* ... */ },
    projectInfo: { /* ... */ },
    otherAgents: [ /* ... */ ],
    projectRules: [ /* ... */ ],
};

const systemPrompt = builder.build(context);
```

### Custom Configuration

```typescript
// Exclude certain sections
const builder = new SystemPromptBuilder({
    includeStaticInstructions: false,
    includeTeamInformation: false,
});

// Or exclude by ID
const builder = new SystemPromptBuilder({
    excludeSections: ['project-rules', 'team-information'],
});
```

### Adding Custom Sections

```typescript
import type { PromptSectionBuilder } from './types';

const customBuilder: PromptSectionBuilder = {
    id: 'custom-section',
    name: 'Custom Section',
    defaultPriority: 75,
    build: (context) => ({
        id: 'custom-section',
        name: 'Custom Section',
        priority: 75,
        content: `## Custom Instructions\n${context.agentName} specific content`,
        enabled: true,
    }),
};

const builder = new SystemPromptBuilder({
    customBuilders: [customBuilder],
});
```

## Modifying Default Prompts

All default prompt content is stored in `constants.ts`:

- `DEFAULT_SYSTEM_INSTRUCTIONS` - Core TENEX system instructions
- `AGENT_TO_AGENT_INSTRUCTIONS` - Instructions for agent-to-agent communication
- `COLLABORATION_GUIDELINES` - Guidelines for multi-agent collaboration

To modify these, simply edit the constants in `constants.ts`.

## Section Priorities

Sections are ordered by priority (higher = earlier in prompt):

1. **100** - Static TENEX Instructions
2. **95** - Agent-to-Agent Communication (when applicable)
3. **90** - Agent Identity
4. **85** - Project Context
5. **70** - Team Information
6. **60** - Project Rules

## Testing

The module includes comprehensive tests:

```bash
bun test src/utils/agents/prompts
```

## Integration

The SystemPromptBuilder is integrated into the agent system through:

- `AgentCore.buildSystemPromptWithContext()` - Builds prompts with full context
- `AgentConversationManager.getOrCreateConversationWithContext()` - Creates conversations with context-aware prompts
- `AgentCommunicationHandler.buildSystemPromptContext()` - Prepares context for prompt generation