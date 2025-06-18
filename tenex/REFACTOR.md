# TENEX Agent System Refactor

## Overview
This document tracks the complete refactoring of the TENEX agent system from a complex, overengineered architecture to a clean, simple system that preserves core functionality.

## Current Problems
- **AgentManager** and **AgentOrchestrator** have overlapping, confusing responsibilities
- Complex dependency injection patterns throughout
- Duplicate event processing logic (ChatEventProcessor, TaskEventProcessor)
- Scattered agent discovery logic
- Overly complex conversation management
- Team orchestration mixed with individual agent management

## New Architecture

### Core Principles
1. **Clear Single Responsibility** - Each module does one thing well
2. **No Backwards Compatibility** - Clean break from old system
3. **Typing Indicators First-Class** - Built into LLM layer
4. **Team Lead Orchestration** - Team lead controls conversation flow

### Module Structure
```
src/agents/new/
├── core/
│   ├── types.ts         # Core interfaces and types
│   └── errors.ts        # Custom error types
├── infrastructure/
│   ├── LLMProvider.ts   # LLM with typing indicators
│   ├── ConversationStore.ts # Simple persistence
│   └── NostrPublisher.ts # Event publishing
├── domain/
│   ├── Agent.ts         # Individual agent
│   ├── Team.ts          # Team structure
│   └── TeamLead.ts      # Team lead (extends Agent)
├── application/
│   ├── EventRouter.ts   # Entry point router
│   └── TeamOrchestrator.ts # Team formation
└── index.ts             # Public API
```

Note: The 'new' folder is temporary. Once we replace the old system, this will become the main agents folder.

## Implementation Plan

### Phase 1: Core Types and Interfaces
```typescript
// Core types that everything depends on
interface AgentResponse {
    content: string
    signal?: ConversationSignal
}

interface ConversationSignal {
    type: 'continue' | 'ready_for_transition' | 'need_input' | 'complete'
    reason?: string
}

interface ConversationPlan {
    stages: ConversationStage[]
}

interface ConversationStage {
    participants: string[]
    purpose: string
    expectedOutcome: string
    transitionCriteria: string
}
```

### Phase 2: Infrastructure Layer
1. **LLMProvider** - Clean LLM interface with automatic typing indicators
2. **ConversationStore** - Simple key-value persistence
3. **NostrPublisher** - Clean event publishing

### Phase 3: Domain Layer
1. **Agent** - Simple agent that can generate responses with signals
2. **Team** - Data structure for team composition
3. **TeamLead** - Special agent that orchestrates conversation flow

### Phase 4: Application Layer
1. **EventRouter** - Routes events to existing teams or creates new ones
2. **TeamOrchestrator** - Uses LLM to form teams and create conversation plans

### Phase 5: Integration
1. Create new entry point that uses EventRouter
2. Test with real events
3. Swap out old system
4. Delete old modules

## Key Flows

### New Conversation Flow
```
1. Event arrives → EventRouter
2. EventRouter → TeamOrchestrator (no existing team)
3. TeamOrchestrator → LLM (analyze request)
4. LLM returns team composition + conversation plan
5. TeamLead created with plan
6. TeamLead executes first stage with active participants
7. Agents generate responses with signals
8. TeamLead transitions stages based on signals
9. Process continues until plan complete
```

### Existing Conversation Flow
```
1. Event arrives → EventRouter
2. EventRouter finds existing TeamLead
3. TeamLead routes to active speakers
4. Agents respond with signals
5. TeamLead manages transitions
```

## Typing Indicator Architecture

Every LLM operation automatically publishes typing indicators:

```typescript
class LLMProvider {
    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        await this.startTyping(request.context)
        try {
            const response = await this.callLLM(request)
            return response
        } finally {
            await this.stopTyping(request.context)
        }
    }
}
```

Tool calls update typing with status messages:
```typescript
await this.updateTyping("Searching codebase for similar patterns...")
```

## Migration Strategy

1. **Build New System** - Complete implementation in `src/agents/new/`
2. **Test in Isolation** - Unit tests for each module
3. **Integration Test** - Test complete flows with real events
4. **Direct Replacement** - Replace AgentManager with EventRouter
5. **Cleanup** - Delete all old modules and rename `new/` to main agents folder

## Modules to Delete

After migration, delete:
- `src/utils/agents/AgentManager.ts`
- `src/utils/agents/AgentOrchestrator.ts`
- `src/utils/agents/AgentCommunicationHandler.ts`
- `src/utils/agents/ChatEventProcessor.ts`
- `src/utils/agents/TaskEventProcessor.ts`
- `src/utils/agents/EventRouter.ts`
- `src/utils/agents/AgentSelectionService.ts`
- `src/utils/agents/ResponseCoordinator.ts`
- `src/utils/agents/ConversationManager.ts`
- `src/utils/agents/OrchestrationExecutionService.ts`
- Most of `src/core/orchestration/` (keep only team formation logic)

## Success Criteria

1. **70% less code** than current system
2. **Clear module boundaries** - no circular dependencies
3. **Simple data flow** - easy to trace event through system
4. **Typing indicators** on all LLM operations
5. **Team formation** preserved and simplified
6. **All tests pass** with new system

## Current Status

- [x] Phase 1: Core Types and Interfaces
  - ✅ Created `core/types.ts` with all interfaces
  - ✅ Created `core/errors.ts` with error types
- [x] Phase 2: Infrastructure Layer
  - ✅ Implemented `LLMProvider` with automatic typing indicators
  - ✅ Implemented `ConversationStore` (file-based and in-memory)
  - ✅ Implemented `NostrPublisher` for event publishing
- [x] Phase 3: Domain Layer
  - ✅ Implemented simplified `Agent` class
  - ✅ Implemented `Team` data structure
  - ✅ Implemented `TeamLead` with conversation orchestration
- [x] Phase 4: Application Layer
  - ✅ Implemented `EventRouter` as main entry point
  - ✅ Implemented `TeamOrchestrator` for team formation
  - ✅ Created main factory function in `index.ts`
- [ ] Phase 5: Testing & Integration
  - [ ] Create unit tests for new system
  - [ ] Test with real events
  - [ ] Replace old AgentManager with new EventRouter
  - [ ] Remove all old modules

## Implementation Notes

### Key Simplifications Achieved
1. **Reduced from ~20 classes to 8 core classes**
2. **Eliminated complex dependency injection** - Clean constructor injection only
3. **Unified event processing** - No separate Chat/Task processors
4. **Automatic typing indicators** - Built into LLM layer
5. **Simple conversation storage** - Just teams and messages
6. **Flexible LLM configuration** - Supports separate orchestrator LLM for team formation

### Architecture Highlights
- **EventRouter** is the single entry point
- **TeamOrchestrator** uses LLM to form teams dynamically
- **TeamLead** manages conversation flow based on signals
- **Agents** generate responses with conversation signals
- **Clean layered architecture** with clear boundaries

Last Updated: 2025-01-17