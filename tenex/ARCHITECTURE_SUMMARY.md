# TENEX Architecture Summary

## Recent Updates

### Based on Feedback:
1. **Global Project Context**: Project loaded once at startup, available throughout runtime
2. **Modular Prompt System**: Consolidated all prompts in `src/prompts/` with reusable fragments
3. **Phase Initialization System**: Each phase has dedicated initializer for startup logic
4. **NostrPublisher with LLM Metadata**: All LLM-generated events include usage and cost tags
5. **Prompt Architecture**: Created template builders using composable fragments

### Modular Prompt System
```
src/prompts/
├── core/           # PromptBuilder and FragmentRegistry
├── fragments/      # Reusable components (agent lists, tools, etc)
├── templates/      # High-level builders (routing, phases, agents)
└── index.ts       # Unified exports
```

Benefits:
- **DRY**: Agent lists, tool descriptions used across many prompts
- **Testable**: Each fragment independently testable
- **Maintainable**: Update formatting in one place
- **Composable**: Build complex prompts from simple pieces

## Completed Design Work

### 1. Architecture Document (`ARCHITECTURE.md`)
- Comprehensive system design covering all components
- Event-driven, phase-based conversation management
- Agent orchestration with feedback mechanisms
- Git-based execution control

### 2. Implementation Plan (`IMPLEMENTATION_PLAN.md`)
- Detailed module breakdown with interfaces
- 5-week implementation timeline
- Testing strategy and directory structure
- Key design decisions documented

### 3. Type Definitions
Created foundational types in `src/types/`:
- `conversation.ts`: Phase management and conversation state
- `routing.ts`: Routing decisions and agent summaries
- `agent.ts`: Agent execution context and responses
- `llm.ts`: LLM configuration and integration types

## Key Updates to Architecture

### Phase Initialization
Each phase now has a dedicated initializer that executes when entering:
- **Chat Phase**: Project uses its own nsec to engage with user
- **Plan Phase**: Automatically triggers Claude Code CLI with planning prompt
- **Execute Phase**: Creates git branch, then triggers Claude Code CLI
- **Review Phase**: Selects appropriate review agent or testing approach

### Routing Templates
Created structured prompts for:
- **New Conversation**: Analyzes intent → determines initial phase
- **Phase Transition**: Evaluates completion criteria → next phase
- **Agent Selection**: Matches expertise to current needs
- **Fallback Routing**: Secondary mechanism when primary fails

### NostrPublisher Implementation
```typescript
const reply = eventToReply.reply()
reply.tag(projectContext.projectEvent)
reply.tags = reply.tags.filter(tag => tag[0] !== 'p')
reply.tag(['p', nextAgent])
// Add LLM metadata tags
```

## Key Architecture Decisions

### 1. Event-Driven Communication
- All agent communication via Nostr events
- P-tagging determines next responder
- Event kind:11 for new conversations

### 2. Phase-Based Development
- Four phases: `chat`, `plan`, `execute`, `review`
- Bidirectional transitions allowed
- Context compaction between phases
- Each phase has specific completion criteria

### 3. Agent System
- Agents loaded from NDKAgent events
- Each agent has own nsec and LLM config
- Tools registered per agent capability
- Stateless execution with full context

### 4. LLM Integration
- Multi-provider support via multi-llm-ts
- Named configurations in llms.json
- Per-agent model selection
- Structured prompt building system

### 5. Feedback Mechanism
- Expert agents provide domain-specific feedback
- Main agent decides on feedback integration
- Configurable feedback rounds (default: 10)
- Human escalation always available

### 6. Execution Control
- Git branch isolation for execution phase
- Only one execution at a time
- Work suspension with WIP commits
- Return to main/master when complete

## Next Implementation Steps

### Phase 1: Core Infrastructure (Week 1)
1. **LLM Service**
   - Implement `LLMService.ts` with multi-llm-ts
   - Create `ConfigManager.ts` for llms.json loading
   - Add structured response parsing

2. **Agent Registry**
   - Build `AgentRegistry.ts` with project loading
   - Implement agent lifecycle management
   - Add nsec generation and storage

3. **Event Handler Update**
   - Modify `EventHandler.ts` to recognize kind:11
   - Add conversation routing logic
   - Implement p-tag based agent selection

### Phase 2: Routing System (Week 2)
1. **Routing LLM**
   - Create routing prompt templates
   - Implement phase detection logic
   - Add fallback routing mechanism

2. **Conversation Manager**
   - State persistence in .tenex/conversations/
   - Phase transition management
   - History compaction for phase changes

### Phase 3: Agent Execution (Week 3)
1. **Agent Executor**
   - LLM prompt construction with context
   - Tool call extraction and execution
   - Next action determination

2. **Nostr Publisher**
   - Conversation event publishing
   - Proper p-tagging for next agent
   - Phase transition events

## Current State

- **Existing**: Event monitoring, project loading, basic agent creation
- **Stubbed**: NostrPublisher, Agent system, LLM providers
- **New**: Conversation types, routing system, phase management
- **Reusable**: ClaudeParser for Claude Code tool integration

## Directory Structure
```
tenex/src/
├── types/          ✅ Created foundation types
├── llm/            📋 Next: LLM service implementation
├── agents/         📋 Next: Registry and executor
├── routing/        📋 Week 2: Routing system
├── conversations/  📋 Week 2: State management
├── phases/         📋 Week 2: Phase logic
└── tools/          📋 Week 3: Tool integration
```