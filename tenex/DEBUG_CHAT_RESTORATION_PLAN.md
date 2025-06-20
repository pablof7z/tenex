# Debug Chat Restoration Plan

## Overview
The debug chat functionality was removed as part of a major refactor that eliminated the agent orchestration system. This document outlines the plan to restore the debug chat command with a minimal, focused implementation.

## Current State Analysis

### What Was Removed
1. **Agent System Components**:
   - `createAgentSystem` function that initialized the full agent infrastructure
   - `EventRouter` for handling agent communication
   - Complex agent orchestration with teams and turn management
   - Tool execution pipeline integrated with agents

2. **Debug Chat Functionality**:
   - Interactive REPL for chatting with individual agents
   - System prompt display for debugging
   - Real-time agent response streaming
   - Tool execution during chat

### What Still Exists
1. **Core Infrastructure**:
   - `AgentRegistry` placeholder
   - Basic agent types and interfaces
   - LLM service with multi-provider support
   - Conversation management system
   - Routing system for agent selection
   - Prompt building system with templates
   - Nostr integration for event publishing

2. **Project Loading**:
   - `ProjectLoader` for loading project configuration
   - Agent configuration reading from `.tenex/agents.json`
   - LLM configuration system

## Implementation Strategy

### Phase 1: Minimal Agent Implementation
Create a simplified `Agent` class that can:
- Hold agent configuration (name, role, instructions, etc.)
- Use LLM service to generate responses
- Execute tools via direct integration
- Format responses properly

### Phase 2: Basic Agent System
Implement minimal `createAgentSystem` that:
- Creates agent instances from configuration
- Provides a simple interface for agent interaction
- Handles tool registration and execution
- Returns an interface suitable for debug chat

### Phase 3: Restore Debug Chat
Update debug chat to:
- Create a single agent instance
- Set up interactive REPL
- Handle user input and display agent responses
- Support tool execution during chat
- Stream responses in real-time

## Key Components to Implement

### 1. Simple Agent Class (`src/agents/SimpleAgent.ts`)
```typescript
export class SimpleAgent implements Agent {
  constructor(
    private config: AgentConfig,
    private llmService: LLMService,
    private toolRegistry: Map<string, Tool>
  ) {}
  
  async respond(message: string, context: AgentContext): Promise<AgentResponse> {
    // Build prompt using PromptBuilder
    // Call LLM service
    // Parse response and execute tools if needed
    // Return formatted response
  }
}
```

### 2. Minimal Agent System (`src/agents/createAgentSystem.ts`)
```typescript
export async function createAgentSystem(options: {
  projectPath: string;
  projectContext: ProjectContext;
  agents: Map<string, AgentConfig>;
  llmConfig: LLMConfig;
  ndk: NDK;
}): Promise<AgentSystem> {
  // Initialize LLM service
  // Create tool registry
  // Create agent instances
  // Return simple interface for interaction
}
```

### 3. Tool Registry (`src/agents/tools/ToolRegistry.ts`)
```typescript
export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  
  register(name: string, tool: Tool): void {
    this.tools.set(name, tool);
  }
  
  async execute(name: string, args: any): Promise<ToolResult> {
    // Find and execute tool
    // Return result
  }
}
```

### 4. Updated Debug Chat (`src/commands/debug/chat.ts`)
Restore the original functionality with simplified agent system:
- Load project and agent configuration
- Create single agent instance
- Set up readline interface
- Handle user input in a loop
- Display agent responses with streaming
- Support tool execution

## Implementation Order

1. **Tool Registry and Basic Tools** (Priority: High)
   - Implement ToolRegistry class
   - Add basic tools (shell, research, etc.)
   - Create tool execution pipeline

2. **Simple Agent Implementation** (Priority: High)
   - Create SimpleAgent class
   - Integrate with LLM service
   - Add prompt building
   - Implement tool execution

3. **Minimal Agent System** (Priority: High)
   - Implement createAgentSystem function
   - Wire up dependencies
   - Return simple interface

4. **Restore Debug Chat** (Priority: High)
   - Update chat.ts with new agent system
   - Restore REPL functionality
   - Add response streaming
   - Test with various agents

5. **System Prompt Debug** (Priority: Medium)
   - Restore system prompt display in debug/index.ts
   - Use PromptBuilder to show formatted prompts

## Success Criteria

1. Can run `tenex debug chat <agent-name>` and interact with an agent
2. Agent responds appropriately based on its configuration
3. Tools can be executed during chat
4. Responses are streamed in real-time
5. System prompts can be viewed with `tenex debug prompt <agent-name>`
6. No complex orchestration - just simple agent interaction

## Notes

- Keep implementation minimal and focused on debug functionality
- Avoid recreating the full orchestration system
- Use existing infrastructure where possible
- Make it easy to extend later if needed