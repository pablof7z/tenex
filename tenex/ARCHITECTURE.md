# TENEX Agentic System Architecture

## Overview

The TENEX agentic system is a conversation-driven development platform that orchestrates multiple AI agents through different phases of software development. The system monitors Nostr events, routes conversations through appropriate phases, and coordinates agent interactions to accomplish development tasks.

## Core Principles

- **Event-Driven**: All communication happens through Nostr events
- **Phase-Based**: Conversations progress through defined phases (chat, plan, execute, review)
- **Agent-Oriented**: Specialized agents handle different aspects of development
- **Feedback-Driven**: Every phase includes feedback mechanisms from domain experts
- **Modular**: Clean separation of concerns following SRP and DRY principles

## System Context

### Project Runtime
- Project loaded once at startup via ProjectLoader
- Project context (event, signer, agents) available globally throughout runtime
- Not tied to agent system - shared infrastructure

## System Components

### 1. Event Monitor
- Monitors for new conversation events (kind:11)
- Triggers routing for new conversations
- Maintains conversation state across restarts

### 2. Routing System

#### RoutingLLM
- **Responsibility**: Determines conversation phase and next agent
- **Inputs**: Conversation history, available agents, current phase
- **Outputs**: Next phase, next agent assignment
- **Fallback**: Secondary routing mechanism if primary fails

#### Routing Prompt Templates
- **New Conversation**: Analyzes user intent to determine initial phase
- **Phase Transition**: Evaluates completion criteria and next phase
- **Agent Selection**: Matches expertise to current needs
- **Structured Output**: JSON format for reliable parsing

#### Phase Manager
- **Phases**: `chat`, `plan`, `execute`, `review`
- **Transitions**: Bidirectional (can move backwards)
- **Completion Criteria**: Defined per phase by main agent
- **Persistence**: Phase state saved to conversation metadata

### 3. Agent System

#### Agent Registry
- **Storage**: `.tenex/agents.json`
- **Structure**:
  ```json
  {
    "agent-slug": {
      "nsec": "nsec1....",
      "file": "<path-to-agent.json>",
      "llmConfig": "deepseek"
    }
  }
  ```

#### Agent Types
- **System Agents**: Core routing and orchestration
- **Expert Agents**: Domain-specific feedback providers
- **Execution Agents**: Task performers with tool access

#### Agent Lifecycle
1. **Initialization**: Load from NDKProject agent tags
2. **Registration**: Generate nsec, store in registry
3. **Activation**: Create NDKPrivateKeySigner, load configuration
4. **Execution**: Process p-tagged events, invoke tools/LLMs
5. **Response**: Publish results with next agent p-tag

### 4. LLM Integration Layer

#### Multi-LLM Manager
- **Backend**: multi-llm-ts library
- **Configuration**: Named configurations in `llms.json`
- **Selection**: Per-agent model selection
- **Interface**: Unified API across providers

#### Prompt Builder System
- **Modular Fragments**: Reusable components (agent lists, tools, phases)
- **Template Builders**: High-level builders for routing, phases, agents
- **Fragment Registry**: Centralized registration and management
- **Priority-Based Composition**: Fragments ordered by priority
- **Location**: All prompts in `src/prompts/` directory

##### Prompt Fragments
- **Common**: Agent lists, tool lists, phase descriptions, JSON formats
- **Generic**: Base context, task descriptions, history
- **Context**: Conversation, project, requirements, plan summaries
- **Agent-Specific**: Identity, instructions, review contexts

### 5. Tool System

#### Tool Registry
- **Claude Code CLI**: Wrapped for execution tasks
- **File Operations**: Delegated to appropriate tools
- **Custom Tools**: Registered per agent capability

#### Tool Execution
- **Parser**: Extracts tool calls from LLM responses
- **Executor**: Runs tools with proper context
- **Result Handler**: Formats results for agent consumption

### 6. Nostr Publishing

#### NostrPublisher
- **Base Reply**: Uses `eventWeReplyingTo.reply()` method
- **P-tag Management**: Filters existing p-tags, adds next responder
- **Project Tagging**: Tags project event on all responses
- **LLM Metadata**: Enriches events with model and usage data

#### LLM Metadata Tags
All LLM-generated events include:
- `llm-model`: Model identifier (e.g., "deepseek/deepseek-chat")
- `llm-system-prompt`: Hash of system prompt used
- `llm-user-prompt`: Hash of user prompt
- `llm-cost-usd`: Cost in USD
- `llm-prompt-tokens`: Input token count
- `llm-completion-tokens`: Output token count
- `llm-total-tokens`: Total tokens used

### 7. Conversation Management

#### Conversation State
- **History**: Full event chain per conversation
- **Phase Context**: Compacted history when transitioning
- **Metadata**: Current phase, assigned agents, completion status

#### Context Compaction
- **Trigger**: Phase transitions
- **Process**: Summarize relevant information
- **Output**: Nostr event with phase transition tag

### 8. Execution Control

#### Git Branch Management
- **Constraint**: Only one execution phase at a time
- **Branch Creation**: Named by LLM for the task
- **Work Suspension**: Commit WIP, return to main
- **Completion**: Merge or leave for human review

#### Parallelism
- **Conversations**: Multiple concurrent, except execution
- **Phases**: All phases parallel except execution
- **Agents**: Can handle multiple conversations

## Event Flow

### 1. New Conversation
```
User Event (kind:11) → Event Monitor → RoutingLLM → Phase Assignment → Phase Initializer
```

### 2. Phase Initialization
```
Phase Initializer → Execute Phase Logic → Publish Event → P-tag Next Responder
```

### 3. Agent Interaction
```
P-tagged Event → Agent → LLM/Tools → Response Event → Next Agent P-tag
```

### 4. Phase Transition
```
Completion Criteria Met → Context Compaction → Phase Update → New Agent Assignment
```

### 5. Feedback Loop
```
Main Agent Output → Expert Selection → Feedback Request → Expert Response → Main Agent Integration
```

## Phase Specifications

### Phase Initialization System
Each phase has a dedicated initializer that executes when entering the phase:

#### PhaseInitializer
- **Responsibility**: Execute phase-specific startup logic
- **Context**: Receives conversation, project context, and phase history
- **Output**: Initial action (agent handoff or tool execution)

### Chat Phase
- **Purpose**: Gather requirements and clarify intent
- **Initializer**: Uses project nsec to engage with user
- **Main Agent**: Project itself (via nsec)
- **Completion**: Sufficient information for planning
- **Transition**: To plan when requirements clear

### Plan Phase
- **Purpose**: Create architectural and implementation plan
- **Initializer**: Triggers Claude Code CLI with planning prompt
- **Main Agent**: Claude (via tool)
- **Feedback**: Domain expert review
- **Completion**: All experts approve plan
- **Transition**: To execute when plan approved

### Execute Phase
- **Purpose**: Implement the approved plan
- **Initializer**: Creates git branch, triggers Claude Code CLI
- **Main Agent**: Claude (via tool)
- **Constraints**: Git branch isolation
- **Feedback**: Technical review during implementation
- **Completion**: Implementation matches plan
- **Transition**: To review when complete

### Review Phase
- **Purpose**: Validate and test implementation
- **Initializer**: Selects appropriate review agent or tool
- **Main Agent**: Selected by routing
- **Activities**: Testing, documentation, cleanup
- **Completion**: Quality criteria met
- **Transition**: To chat or done

## Error Handling

### LLM Failures
- **Primary**: Retry with exponential backoff
- **Fallback**: Secondary routing mechanism
- **User Notification**: Via conversation event

### Agent Timeouts
- **Detection**: Configurable timeout per agent
- **Resolution**: Reassign or escalate to human

### Tool Failures
- **Capture**: Full error context
- **Recovery**: Agent determines next action
- **Logging**: Preserved in conversation

## Configuration

### Agent Configuration
- **Location**: NDKAgent events + local registry
- **Updates**: Hot-reloadable
- **Validation**: Schema enforcement

### LLM Configuration
- **File**: `llms.json`
- **Format**: Named provider configurations
- **Selection**: Per-agent basis

### System Configuration
- **Feedback Rounds**: Max 10 (configurable)
- **Timeouts**: Per-agent settings
- **Parallelism**: Execution gating rules

## Testing Strategy

### Unit Tests
- **Routing Logic**: Phase determination
- **Agent Registry**: CRUD operations
- **Tool Execution**: Parser and executor
- **Context Compaction**: Summarization quality

### Integration Tests
- **Event Flow**: End-to-end conversation
- **Phase Transitions**: State management
- **Agent Communication**: P-tagging accuracy
- **Git Operations**: Branch management

### System Tests
- **Multi-Conversation**: Parallel execution
- **Failure Scenarios**: Graceful degradation
- **Performance**: Response latency

## Future Enhancements

### Token Tracking
- **Usage**: Per agent/conversation
- **Cost**: Provider-specific calculation
- **Reporting**: Aggregated metrics

### Advanced Routing
- **Learning**: Improve phase detection
- **Optimization**: Agent selection efficiency
- **Patterns**: Common workflow templates

### Enhanced Feedback
- **Consensus**: Multi-agent agreement protocols
- **Prioritization**: Weighted expert opinions
- **History**: Learn from past decisions

## Implementation Priorities

1. **Core Event System**: Monitor, router, basic agents
2. **LLM Integration**: Multi-provider support
3. **Phase Management**: State machine implementation
4. **Tool System**: Claude wrapper, basic tools
5. **Feedback Mechanism**: Expert agent integration
6. **Git Integration**: Execution phase gating
7. **Testing Suite**: Comprehensive coverage