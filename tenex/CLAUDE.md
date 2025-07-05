# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TENEX is a CLI and daemon system that orchestrates multiple AI agents to build software collaboratively using the Nostr protocol. It features a sophisticated agent-based, event-driven architecture with a star topology where the orchestrator acts as the central hub.

## Development Commands

### Build and Development
```bash
# Run the CLI directly (no build needed)
bun run ./src/tenex.ts

# Build the bundled version
bun scripts/build-bundled.js

# Type checking
bun run typecheck

# Linting
bun run lint
bun run lint:fix
```

### Testing
```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run tests with coverage
bun test --coverage

# Run specific test types
bun test:unit       # Unit tests only
bun test:integration # Integration tests only
bun test:e2e        # End-to-end tests only

# Run a single test file
bun test path/to/test.ts
```

### LLM Log Analysis
```bash
# Analyze LLM logs
bun run scripts/llm-log-tree.ts
```

### Agent Management
```bash
# List all available agents
tenex agent list           # Shows all agents (global and project)
tenex agent list --global  # Shows only global agents
tenex agent list --project # Shows only project agents

# Add a new agent
tenex agent add           # Interactive wizard (adds to project if in one, else global)
tenex agent add --global  # Add to global configuration (~/.tenex)
tenex agent add --project # Add to project configuration (must be in project)

# Remove an agent
tenex agent remove <name>           # Remove from current scope
tenex agent remove <name> --global  # Remove from global configuration
tenex agent remove <name> --project # Remove from project configuration
```

## Architecture Overview

### Core Architecture Pattern
The system uses a **star topology** with the orchestrator as the central hub:
- All non-orchestrator agents complete back to the orchestrator
- Only the orchestrator can use the `continue` tool
- The orchestrator makes all routing decisions based on request clarity and agent availability

### Key Components

1. **Agent System** (`src/agents/`)
   - Built-in agents: orchestrator, executor, planner, project-manager
   - Agent execution through `AgentExecutor` and `ReasonActLoop`
   - Agents communicate exclusively through Nostr events

2. **Conversation Management** (`src/conversations/`)
   - Phase-based workflow: CHAT → PLAN → EXECUTE → REVIEW → CHORES → REFLECTION
   - Recommended phase progression after EXECUTE (can skip with valid reason)
   - Smart feedback loops between EXECUTE ↔ REVIEW

3. **Nostr Integration** (`src/nostr/`)
   - Uses NDK (Nostr Development Kit) directly
   - Custom event types: `NDKAgent`, `NDKAgentLesson`
   - All agent communication happens through Nostr events

4. **LLM Integration** (`src/llm/`)
   - Multi-LLM support through `multi-llm-ts` package
   - Native function calling for tool execution
   - Router pattern for LLM selection

5. **Prompt System** (`src/prompts/`)
   - Fragment-based prompt composition
   - Dynamic prompt building with `PromptBuilder`
   - Reusable fragments for different contexts

6. **Tool System** (`src/tools/`)
   - Tools are implemented as functions
   - Native function calling abstraction
   - Key tools: analyze, yield_back, end_conversation, continue, learn, claude-code

### Configuration
- Global config: `~/.tenex/config.json`
- Project config: `.tenex/config.json`
- Agent definitions: 
  - Global agents: `~/.tenex/agents/` (available to all projects)
  - Project agents: `.tenex/agents/` (project-specific, can override global)
- LLM configurations: `llms.json`
- MCP servers: `mcp.json`

### Important Design Principles

1. **No Direct Event Creation**: Always use NDK directly, don't wrap it
2. **Feature-Based Organization**: Code is organized by feature/domain
3. **Clean Code Only**: No backwards compatibility unless explicitly requested
4. **Direct Modifications**: Modify existing code directly, don't extend or wrap
5. **Clarity-Based Routing**: Orchestrator routes based on request clarity, not complexity

### Control Flow
After the ongoing refactor (see ORCHESTRATOR_CONTROL_FLOW_PLAN.md):
- Well-defined requests: Skip PLAN, go directly to EXECUTE
- Ambiguous requests: Go through PLAN phase first
- Vague requests: Start with BRAINSTORM phase
- Post-execution: Required REVIEW → CHORES → REFLECTION (only skip if user explicitly requests)

### Testing Guidelines
- Tests are colocated with source files in `__tests__/` directories
- Use `.test.ts` for unit tests, `.integration.test.ts` for integration tests
- 30-second timeout configured for all tests
- Run typecheck and lint before committing changes

### Key Files to Understand
- `src/agents/execution/AgentExecutor.ts` - Core agent execution engine
- `src/agents/execution/ReasonActLoop.ts` - Agent reasoning loop
- `src/conversations/ConversationManager.ts` - Conversation orchestration
- `src/prompts/core/PromptBuilder.ts` - Dynamic prompt construction
- `src/tools/implementations/yieldBack.ts` - Non-orchestrator agents yielding control
- `src/tools/implementations/endConversation.ts` - Orchestrator ending conversations