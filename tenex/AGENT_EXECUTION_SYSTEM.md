# Agent Execution System

## Overview

The Agent Execution System enables AI agents to actively respond to conversations and perform work. When an agent is assigned to a conversation phase, they:

1. Generate contextual responses using LLMs
2. Execute assigned tools
3. Publish responses via Nostr
4. Hand off to other agents when needed

## Architecture

### Core Components

1. **AgentExecutor** (`src/agents/execution/AgentExecutor.ts`)
   - Orchestrates agent execution
   - Manages LLM interactions
   - Handles tool execution
   - Publishes responses

2. **AgentPromptBuilder** (`src/agents/execution/AgentPromptBuilder.ts`)
   - Builds phase-specific system prompts
   - Includes conversation context
   - Adds constraints and instructions

3. **Integration Points**
   - ConversationRouter triggers execution
   - LLMService generates responses
   - ConversationPublisher publishes to Nostr

## Agent Execution Flow

```
User Message → Routing Decision → Agent Assignment → Agent Execution
                                                           ↓
                                                    Build Prompt
                                                           ↓
                                                    LLM Response
                                                           ↓
                                                    Execute Tools
                                                           ↓
                                                    Publish Response
```

## System Prompts

Each agent receives a tailored system prompt based on:

- **Agent Identity**: Name, role, expertise, instructions
- **Current Phase**: Chat, Plan, Execute, or Review
- **Project Context**: Title, repository, available tools
- **Conversation History**: Recent messages and context

### Phase-Specific Behavior

#### Chat Phase
```typescript
// Agents focus on:
- Understanding requirements
- Asking clarifying questions  
- Identifying technical needs
- Being friendly and thorough
```

#### Plan Phase
```typescript
// Agents focus on:
- Creating detailed implementation plans
- Breaking down work into tasks
- Identifying dependencies
- Suggesting architecture patterns
```

#### Execute Phase
```typescript
// Agents focus on:
- Writing clean code
- Following best practices
- Implementing incrementally
- Testing as they go
```

#### Review Phase
```typescript
// Agents focus on:
- Code quality assessment
- Security vulnerabilities
- Performance considerations
- Documentation completeness
```

## LLM Integration

The system tracks detailed metadata for each LLM interaction:

```typescript
interface LLMMetadata {
  model: string;
  cost: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  systemPromptHash: string;
  userPromptHash: string;
}
```

This metadata is included in Nostr events for transparency and cost tracking.

## Next Responder Logic

The system intelligently determines who should respond next:

1. **Chat Phase**: Usually returns to the user for more input
2. **Other Phases**: Can hand off to other agents or continue working
3. **No Loops**: Prevents agents from tagging themselves

## Tool Execution

Agents can execute tools during their responses:

- Claude Code CLI for planning/coding
- Shell commands (coming soon)
- File operations (coming soon)
- Web search (coming soon)

## Testing

### Unit Test
```bash
# Test the agent execution system
tenex test agent-execution
```

### Integration Test
```bash
# Test full system with agent execution
tenex test integration
```

### Manual Testing
```typescript
// Create an agent
const agent = await agentRegistry.ensureAgent('test-agent', {
  name: 'Test Agent',
  role: 'Assistant',
  expertise: 'Testing',
  instructions: 'Be helpful',
  tools: [],
  llmConfig: 'default'
});

// Execute the agent
const result = await agentExecutor.execute({
  agent,
  conversation,
  phase: 'chat',
  lastUserMessage: 'Hello'
}, triggeringEvent);
```

## Configuration

### Agent Configuration
```json
{
  "name": "System Architect",
  "role": "Software Architect",
  "expertise": "System design and planning",
  "instructions": "Design scalable systems",
  "tools": ["claude_code"],
  "llmConfig": "default"
}
```

### LLM Configuration
Agents use the LLM configurations defined in `llms.json`:
```json
{
  "configurations": {
    "default": {
      "provider": "openrouter",
      "model": "gpt-4",
      "temperature": 0.7
    }
  }
}
```

## Monitoring

Agent execution is logged with:
- Execution start/end times
- LLM response metrics
- Tool execution results
- Published event IDs
- Error tracking

## Next Steps

1. **Tool Execution Enhancement**
   - Implement tool detection in responses
   - Add more tool types
   - Handle tool failures gracefully

2. **Agent Collaboration**
   - Multi-agent handoffs
   - Parallel agent execution
   - Consensus mechanisms

3. **Response Quality**
   - Response validation
   - Quality scoring
   - Feedback loops

4. **Performance Optimization**
   - Response caching
   - Prompt optimization
   - Token usage reduction