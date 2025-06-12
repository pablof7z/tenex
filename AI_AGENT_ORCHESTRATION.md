# TENEX AI Agent Orchestration System

## Overview

TENEX implements a sophisticated multi-agent AI system built on the philosophy of "orchestrate the orchestrators." Rather than having a single AI assistant, TENEX enables multiple specialized AI agents to collaborate on software development through shared context and structured communication via the Nostr protocol.

## Agent Architecture

### 1. Agent Identity System

Each agent in TENEX has:
- **Unique Identity**: A dedicated Nostr keypair (nsec/npub) for cryptographic identity
- **Profile**: Published as kind:0 events with format "{role} @ {ProjectName}"
- **Configuration**: Stored as NDKAgent events (kind 4199) on Nostr
- **Local Storage**: Agent definitions cached in `.tenex/agents/` directory

### 2. Agent Configuration Structure

Agents are defined with the following properties:

```typescript
interface NDKAgent {
  title: string;          // Agent name/identifier
  description: string;    // One-line purpose description
  role: string;          // Agent's expertise and personality
  instructions: string;   // Detailed operational guidelines
  version: string;       // Configuration version
  projectRef: string;    // Associated project (naddr)
}
```

Example agent configuration:
```json
{
  "title": "code",
  "description": "Expert software developer focused on implementation",
  "role": "You are an expert software developer...",
  "instructions": "Focus on clean, maintainable code...",
  "version": "1.0.0"
}
```

### 3. Agent Types and Specializations

TENEX supports various agent roles:

- **Default Agent**: General-purpose orchestrator
- **Code Agent**: Implementation specialist
- **Planner Agent**: Architecture and design
- **Debug Agent**: Error diagnosis and fixes
- **Reviewer Agent**: Code review and quality
- **Custom Agents**: Project-specific roles

## Multi-Agent Collaboration

### 1. Agent Selection System

The CLI implements intelligent agent selection:

```typescript
// From AgentEventHandler.ts
private selectAgentForEvent(event: NDKEvent): string | null {
  // Priority order:
  // 1. Explicit agent tags in the event
  // 2. Agent mentioned in content
  // 3. Agent referenced in conversation
  // 4. Default agent
}
```

### 2. Conversation Management

Each agent maintains separate conversation threads:

```
.tenex/conversations/
├── {agent-name}/
│   ├── {task-id}.json
│   └── {chat-id}.json
└── processed-events.json
```

Conversations include:
- Full message history
- Token usage tracking
- Context window management
- Automatic truncation when approaching limits

### 3. Event-Driven Coordination

Agents communicate through Nostr events:

```
Task Created → Agent Selected → Conversation Started → Status Updates
     ↓              ↓                    ↓                    ↓
  (kind 1934)   (tag parsing)    (context loading)    (kind 24011)
```

## LLM Integration

### 1. Multi-Provider Support

TENEX supports multiple LLM providers:

```json
{
  "code": {
    "provider": "anthropic",
    "model": "claude-3-opus-20240229",
    "apiKey": "sk-ant-...",
    "enableCaching": true,
    "contextWindowSize": 200000
  },
  "planner": {
    "provider": "openrouter",
    "model": "openai/gpt-4-turbo",
    "apiKey": "sk-or-...",
    "contextWindowSize": 128000
  }
}
```

### 2. Context Window Optimization

The system implements sophisticated context management:

```typescript
// Token estimation and truncation
const estimatedTokens = this.estimateTokens(messages);
if (estimatedTokens > contextWindow * 0.9) {
  messages = this.truncateMessages(messages, contextWindow);
}
```

Features:
- Automatic message truncation
- Token usage tracking
- Model-specific limits
- Graceful degradation

### 3. Prompt Caching

Cost optimization through caching:

- **Anthropic**: 90% cost reduction for cached prompts
- **OpenRouter**: Automatic caching for supported models
- **Cache Strategy**: System prompts and context cached

## Context Management

### 1. Project Context Loading

Each agent receives:
- Project metadata and description
- Repository structure
- Active rules from `.tenex/rules/`
- Recent task history
- Relevant conversation threads

### 2. Dynamic Context Assembly

```typescript
const context = await this.assembleContext({
  project: projectMetadata,
  rules: await this.loadRules(),
  recentTasks: await this.getRecentTasks(),
  currentTask: taskEvent,
  conversationHistory: previousMessages
});
```

### 3. Context Persistence

- Conversations stored for 30 days
- Automatic cleanup on startup
- Event deduplication prevents reprocessing
- Seamless resume after restart

## Agent Orchestration Patterns

### 1. Task Delegation Pattern

```
Orchestrator Agent receives complex task
        ↓
Analyzes and breaks down into subtasks
        ↓
Delegates to specialized agents:
- Code Agent: Implementation
- Test Agent: Test creation
- Doc Agent: Documentation
        ↓
Monitors progress and coordinates
```

### 2. Review and Iteration Pattern

```
Code Agent implements feature
        ↓
Reviewer Agent checks code
        ↓
Feedback published as event
        ↓
Code Agent iterates based on feedback
        ↓
Orchestrator marks task complete
```

### 3. Debugging Collaboration Pattern

```
Error detected in production
        ↓
Debug Agent analyzes logs
        ↓
Identifies root cause
        ↓
Code Agent implements fix
        ↓
Test Agent verifies solution
```

## Practical Examples

### Example 1: Feature Implementation

1. **Task Creation**: User creates task "Add user authentication"
2. **Orchestrator Analysis**: Default agent breaks down requirements
3. **Agent Assignment**: 
   - Code agent: Implements auth endpoints
   - Frontend agent: Creates login UI
   - Test agent: Writes integration tests
4. **Coordination**: Orchestrator monitors progress via status events
5. **Completion**: All subtasks complete, main task marked done

### Example 2: Bug Fix Workflow

1. **Bug Report**: "Login fails with 500 error"
2. **Debug Agent**: 
   - Analyzes error logs
   - Identifies database connection issue
   - Proposes fix
3. **Code Agent**: 
   - Implements connection retry logic
   - Updates error handling
4. **Test Agent**: 
   - Creates regression test
   - Verifies fix

### Example 3: Architecture Planning

1. **Request**: "Design microservices architecture"
2. **Planner Agent**:
   - Creates service boundaries
   - Defines APIs
   - Documents decisions
3. **Code Agents** (multiple):
   - Each implements a service
   - Follow planner's design
4. **Orchestrator**:
   - Ensures consistency
   - Manages dependencies

## Configuration Best Practices

### 1. Agent Specialization

```json
{
  "frontend": {
    "role": "React and TypeScript expert focused on user experience",
    "instructions": "Always use Tailwind CSS, follow shadcn patterns..."
  },
  "backend": {
    "role": "API and database specialist",
    "instructions": "Focus on performance, use proper error handling..."
  }
}
```

### 2. LLM Selection

- **Complex Tasks**: Claude 3 Opus or GPT-4
- **Simple Tasks**: Claude 3 Haiku or GPT-3.5
- **Code Generation**: Specialized models like Code Llama
- **Cost Optimization**: Enable caching, use appropriate models

### 3. Context Window Management

```json
{
  "model": "claude-3-opus-20240229",
  "contextWindowSize": 200000,
  "maxConversationTokens": 180000,  // Leave room for response
  "enableCaching": true
}
```

## Advanced Features

### 1. Agent Learning

- Agents reference previous successful solutions
- Conversation history provides context
- Rules evolve based on outcomes

### 2. Parallel Execution

- Multiple agents work simultaneously
- Event-driven coordination prevents conflicts
- Git integration manages code merges

### 3. Human-AI Collaboration

- Humans and AI agents share same protocol
- Transparent action history
- Clear attribution of changes

## Integration with TENEX Components

### 1. CLI Integration

```bash
# Agent management commands
tenex agent publish         # Publish agent to Nostr
tenex agent list           # List project agents
tenex agent add <name>     # Add new agent
```

### 2. MCP Server Integration

MCP tools available to agents:
- `publish_task_status_update`: Real-time progress
- Git operations: Commit with context
- File operations: Read/write project files

### 3. Web UI Integration

- Live agent status display
- Conversation viewing
- Agent configuration UI
- Task assignment interface

## Future Directions

1. **Agent Marketplace**: Share and discover agent configurations
2. **Learning Agents**: Agents that improve from project history
3. **Cross-Project Agents**: Specialists that work across projects
4. **Agent Chains**: Complex workflows with conditional logic
5. **Performance Metrics**: Track agent effectiveness

## Summary

TENEX's agent orchestration system represents a paradigm shift in AI-assisted development. By enabling multiple specialized agents to collaborate through a decentralized protocol, it creates a development environment where:

- **Specialization** leads to better results
- **Transparency** builds trust
- **Persistence** enables learning
- **Decentralization** ensures resilience
- **Context** drives understanding

The system truly embodies "orchestrate the orchestrators" - not just using AI to write code, but creating an intelligent environment where multiple AI agents collaborate effectively on complex software projects.