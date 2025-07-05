# Orchestrator Control Flow Redesign Plan

## Overview

This document outlines the plan to implement a "Smart Orchestrator with Star Topology" control flow in the TENEX system. The goal is to centralize control through the orchestrator while maintaining flexibility and following KISS (Keep It Simple, Stupid) and SRP (Single Responsibility Principle) principles.

## Core Architecture: Star Topology

```
         User
          |
    Orchestrator (Hub)
    /    |    |    \
Planner Executor Reviewer Other Agents
```

- **All non-orchestrator agents** complete back to the orchestrator
- **Only the orchestrator** can use the `continue` tool (already enforced)
- **Orchestrator** acts as the intelligent hub making all routing decisions

## Key Design Principles

1. **Centralized Control**: All control flow goes through the orchestrator
2. **Clarity-Based Routing**: Orchestrator routes based on request clarity, not complexity
3. **Availability-Based Reviews**: Review strategy depends on available agents, not task difficulty
4. **Required Phase Progression**: After EXECUTE, must go through REVIEW → CHORES → REFLECTION (unless user explicitly requests to skip)
5. **Clear Responsibilities**: Orchestrator manages workflow, agents do specialized work

## Implementation Changes

### 1. Complete Tool Modification (`src/tools/implementations/complete.ts`)

**Current Behavior**: 
- Agents try to return to their triggering event's author
- Falls back to orchestrator if no caller found

**New Behavior**:
```typescript
// Pseudo-code for the change
const projectContext = getProjectContext();
const orchestratorAgent = projectContext.getProjectAgent();
let nextAgent: string;

if (context.agent.isOrchestrator) {
    // Orchestrator completes to user (conversation root)
    const rootEvent = context.conversation?.history[0];
    nextAgent = rootEvent?.pubkey || "user";
} else {
    // ALL other agents ALWAYS return to orchestrator
    nextAgent = orchestratorAgent.pubkey;
}

// Include mandatory detailed summary
const metadata: CompleteMetadata = {
    completion: {
        response: input.response, // Must include detailed summary of work done
        nextAgent,
        summary: input.summary || input.response, // Ensure summary is present
    },
};
```

**Required Changes**:
- Modify routing logic to always return to orchestrator
- Add validation for comprehensive summaries
- Update type definitions to include mandatory summary field

### 2. Smart Orchestrator Enhancement (`src/agents/built-in/orchestrator.ts`)

**New Capabilities**:
1. **Request Clarity Assessment**
   - **Well-defined request** → Skip PLAN, go to EXECUTE
   - **Ambiguous request** → Go to PLAN phase
   - **Vague/exploratory request** → Go to BRAINSTORM phase

2. **Availability-Based Review Process**
   ```
   Has relevant agents:     Execute → Agent review(s) → Feedback loop
   No relevant agents:      Execute → Self-review request → Continue
   Multiple relevant agents: Execute → Parallel reviews → Consolidate feedback
   ```

3. **Mandatory Phase Progression After EXECUTE**
   - EXECUTE → REVIEW (mandatory)
   - REVIEW → CHORES (mandatory)
   - CHORES → REFLECTION (mandatory)
   - Phases can be skipped with valid justification (user request, trivial changes)
   - Orchestrator enforces this progression

### 3. Orchestrator Routing Logic Update (`src/prompts/fragments/orchestrator-routing.ts`)

**Current**: Rigid phase progression with mandatory review
**New**: Clarity-based routing with mandatory post-execution phases

Key prompt updates:
- Add request clarity assessment guidelines
- Define criteria for initial phase selection
- Document agent availability checking
- Enforce mandatory phase progression after EXECUTE
- Explain feedback forwarding process

Example routing decisions:
```
Well-defined request:
  CHAT → EXECUTE → REVIEW → CHORES → REFLECTION

Ambiguous request:
  CHAT → PLAN → EXECUTE → REVIEW → CHORES → REFLECTION

Vague/exploratory request:
  CHAT → BRAINSTORM → PLAN → EXECUTE → REVIEW → CHORES → REFLECTION
```

### 4. Enhanced Feedback Loop

**Process**:
1. Executor completes work with detailed summary
2. Orchestrator enters REVIEW phase
3. Orchestrator checks for available relevant agents
4. Orchestrator chooses review strategy based on availability:
   - **Has relevant agents**: Route to them for review
   - **No relevant agents**: Ask executor to self-review
   - **Multiple relevant agents**: Query in parallel
5. Orchestrator collects all feedback/observations
6. Orchestrator makes decision:
   - **No issues found**: Proceed to CHORES phase
   - **Issues found**: Return to EXECUTE phase with feedback
7. If returning to EXECUTE:
   - Forward all feedback verbatim to executor
   - Executor addresses issues and completes again
   - Return to step 2 (REVIEW phase)
8. Repeat EXECUTE ↔ REVIEW cycle until satisfactory
9. Then proceed to CHORES → REFLECTION

### 5. Phase Transition Management

**Phase Flow Rules**:
- Pre-execution phases: Flexible based on request clarity
- Post-execution phases: Required with feedback loops (unless user explicitly requests to skip)
- EXECUTE ↔ REVIEW: Can cycle multiple times based on issues found
- After satisfactory REVIEW: Must proceed through CHORES → REFLECTION

**Update ConversationManager** (`src/conversations/ConversationManager.ts`):
- Track agents consulted per phase
- Store feedback chains and review iterations
- Maintain audit trail of all EXECUTE ↔ REVIEW cycles
- Validate mandatory phase progression after satisfactory review

### 6. When to Skip Phases

The orchestrator may skip post-execution phases with valid justification:

**Skip REVIEW when:**
- User explicitly requests to skip review

**Skip CHORES when:**
- User explicitly requests to skip

**Skip REFLECTION when:**
- User explicitly requests to skip

**Important**: Orchestrator must explain reasoning in `<thinking>` tags when skipping phases.

### 7. Reflection Phase Completion

After CHORES phase completes:
1. Orchestrator should enter REFLECTION phase (unless skipping is justified)
2. All relevant agents provide insights
3. Agents use `learn` tool to capture learnings
4. **Orchestrator uses `complete()`** to:
   - Summarize entire workflow
   - Highlight key outcomes
   - Signal conversation completion

## Implementation Order

1. **Phase 1: Core Control Flow** (High Priority)
   - Modify `complete` tool routing
   - Add mandatory summary validation
   - Update tests for new behavior

2. **Phase 2: Smart Orchestrator** (High Priority)
   - Enhance orchestrator agent logic
   - Update orchestrator prompts
   - Implement dynamic review decisions

3. **Phase 3: Feedback System** (Medium Priority)
   - Implement feedback collection
   - Add feedback forwarding mechanism
   - Create feedback tracking

4. **Phase 4: Testing & Documentation** (Medium Priority)
   - Comprehensive test suite
   - Update agent documentation
   - Create workflow examples

## Example Workflows

### Well-Defined Request
```
User: "Fix the typo in the README file where it says 'teh' instead of 'the'"
1. Orchestrator assesses: Well-defined request
2. Orchestrator → Executor (skip PLAN)
3. Executor fixes typo, completes with summary
4. Orchestrator → REVIEW phase
   - Checks for relevant agents (none for simple typo)
   - Asks executor for self-review
5. Executor confirms fix, completes
6. Orchestrator → CHORES phase
7. Orchestrator → REFLECTION phase
8. Orchestrator completes to user with summary
```

### Ambiguous Request with Review Iterations
```
User: "Add authentication to the system"
1. Orchestrator assesses: Ambiguous (what kind of auth? where?)
2. Orchestrator → Planner
3. Planner creates detailed plan, completes with summary
4. Orchestrator checks for relevant agents
   - Finds security expert available
5. Orchestrator → Security Expert for plan review
6. Security Expert provides feedback
7. Orchestrator forwards feedback → Planner
8. Planner revises plan, completes
9. Orchestrator → Executor
10. Executor implements, completes
11. Orchestrator → REVIEW phase
    - Security Expert reviews implementation
    - Finds security issues
12. Orchestrator → EXECUTE phase (with feedback)
    - Forwards security concerns to Executor
13. Executor fixes issues, completes
14. Orchestrator → REVIEW phase (again)
    - Security Expert reviews fixes
    - Approves implementation
15. Orchestrator → CHORES → REFLECTION
```

### No Available Agents
```
User: "Implement the new widget feature"
1. Orchestrator → Planner (ambiguous request)
2. Planner creates plan, completes
3. Orchestrator checks for relevant agents (finds none)
4. Orchestrator asks Planner to self-review
5. Planner reviews own plan, completes
6. Orchestrator → Executor
7. Executor implements, completes
8. Orchestrator → REVIEW phase
   - No relevant agents available
   - Asks Executor to self-review implementation
9. Continue through CHORES → REFLECTION
```

## Benefits

1. **Simplified Control Flow**: Clear star topology, easy to understand
2. **Clarity-Based Routing**: Initial phase based on request clarity, not complexity assessment
3. **Quality Assurance**: Mandatory review phases ensure quality
4. **Agent-Aware Reviews**: Review strategy adapts to available expertise
5. **Clear Audit Trail**: All decisions tracked through orchestrator
6. **Consistent Workflow**: Post-execution phases are always followed

## Testing Strategy

1. **Unit Tests**:
   - Complete tool routing logic
   - Orchestrator decision making
   - Phase transition validation

2. **Integration Tests**:
   - Full workflow scenarios
   - Multi-agent interactions
   - Feedback loops

3. **E2E Tests**:
   - Simple task workflows
   - Complex feature implementations
   - Error handling and recovery

## Migration Notes

- No backwards compatibility needed (per guidelines)
- Direct refactoring of existing code
- Clean implementation without legacy support

## Success Criteria

1. All non-orchestrator agents route to orchestrator via complete()
2. Orchestrator makes intelligent routing decisions
3. Review process adapts to task complexity
4. No rigid phase requirements
5. Clear audit trail of all decisions
6. Improved task completion efficiency