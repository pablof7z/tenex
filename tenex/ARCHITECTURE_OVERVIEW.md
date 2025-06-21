# TENEX Architecture Overview

## Introduction

This document provides a comprehensive overview of the TENEX system architecture, serving as an entry point to understand how different modules integrate and the overall system design. TENEX is an agentic development coordination system that orchestrates AI agents through Nostr events to accomplish complex software development tasks.

## Architecture Documentation Structure

The TENEX architecture is documented across several specialized documents:

### 1. **[ARCHITECTURE.md](./ARCHITECTURE.md)**
- Original architectural specification
- Core principles and system components
- Event flow patterns
- Phase specifications

### 2. **[SYSTEM_ARCHITECTURE_DIAGRAMS.md](./SYSTEM_ARCHITECTURE_DIAGRAMS.md)**
- Comprehensive visual diagrams
- Module integration overview
- Event flow sequences
- Agent lifecycles
- Phase state machines
- Tool integration architecture

### 3. **[SYSTEM_DATA_FLOWS.md](./SYSTEM_DATA_FLOWS.md)**
- Detailed data flow documentation
- Data transformation patterns
- Persistence strategies
- Configuration management
- Error handling flows

### 4. **[ADDITIONAL_ARCHITECTURE_DIAGRAMS.md](./ADDITIONAL_ARCHITECTURE_DIAGRAMS.md)**
- Component deployment views
- Process architecture
- Security architecture
- Performance and scalability patterns
- Development and testing infrastructure

## Quick Architecture Summary

### Core Architecture Patterns

#### 1. **Event-Driven Coordination**
```
User Input → Nostr Events → Agent Processing → Response Events → User Feedback
```
- All communication flows through Nostr events
- Provides distributed coordination and audit trails
- Enables asynchronous, loosely-coupled interactions

#### 2. **Phase-Based Workflow**
```
Chat → Plan → Execute → Review → (Back to Chat or Complete)
```
- Structured progression through development phases
- Each phase has specialized agents and tools
- Bidirectional transitions based on feedback

#### 3. **Agent Orchestration**
```
Agent Registry → Agent Assignment → Prompt Building → LLM Execution → Tool Usage → Response Publishing
```
- Agents are specialized AI entities with specific roles
- Each agent has its own identity (nsec key) and configuration
- Agents coordinate through event tagging and routing

### Key Integration Points

#### Central Router: `ConversationRouter`
- **Location**: `src/routing/ConversationRouter.ts`
- **Role**: Central orchestrator for all conversation flow
- **Integrates**: ConversationManager, RoutingLLM, AgentExecutor, Publisher

#### Event Monitor: `EventMonitor`
- **Location**: `src/daemon/EventMonitor.ts`
- **Role**: Ingress point for all Nostr events
- **Integrates**: ProcessManager, ProjectManager, ConversationRouter

#### Agent System: `AgentExecutor` + `AgentRegistry`
- **Location**: `src/agents/execution/AgentExecutor.ts`, `src/agents/AgentRegistry.ts`
- **Role**: Manages agent lifecycle and execution
- **Integrates**: LLMService, PromptBuilder, ToolExecutionManager

#### Tool Integration: `ClaudeCodeExecutor`
- **Location**: `src/tools/ClaudeCodeExecutor.ts`
- **Role**: Bridge to external Claude CLI tool
- **Integrates**: Process spawning, stream parsing, event publishing

## Module Dependency Hierarchy

```
┌─ CLI Layer
│  ├─ commands/* (CLI interface)
│  └─ daemon (Event monitoring)
│
├─ Routing Layer
│  ├─ ConversationRouter (Central orchestration)
│  ├─ RoutingLLM (Decision making)
│  └─ Phase management
│
├─ Agent Layer
│  ├─ AgentRegistry (Agent management)
│  ├─ AgentExecutor (Agent coordination)
│  └─ Agent prompt building
│
├─ Conversation Layer
│  ├─ ConversationManager (State management)
│  ├─ Persistence (File system adapter)
│  └─ History compaction
│
├─ LLM Layer
│  ├─ LLMService (Provider abstraction)
│  ├─ MultiLLMService (Multi-provider support)
│  └─ Configuration management
│
├─ Prompt Layer
│  ├─ PromptBuilder (Prompt assembly)
│  ├─ FragmentRegistry (Reusable components)
│  └─ Template management
│
├─ Tool Layer
│  ├─ ToolExecutionManager (Tool coordination)
│  ├─ ClaudeCodeExecutor (Claude CLI integration)
│  └─ Tool detection and parsing
│
├─ Publishing Layer
│  ├─ ConversationPublisher (Event publishing)
│  ├─ NDKClient (Nostr integration)
│  └─ Event formatting
│
└─ Runtime Layer
   ├─ ProjectContext (Global state)
   ├─ Configuration loading
   └─ Utilities
```

## Key Data Flows

### 1. **New Conversation Flow**
```
User Event → EventMonitor → ConversationRouter → ConversationManager 
→ RoutingLLM → PhaseInitializer → AgentExecutor → Response Publishing
```

### 2. **Agent Execution Flow**
```
Agent Assignment → Context Preparation → Prompt Building → LLM Call 
→ Response Processing → Tool Detection → Tool Execution → Publishing
```

### 3. **Phase Transition Flow**
```
Completion Check → Business Rules → Phase Validation → Context Preparation 
→ State Update → Phase Initialization → Agent Reassignment
```

### 4. **Tool Integration Flow**
```
Tool Detection → Parameter Extraction → Process Spawning → Stream Processing 
→ Event Publishing → Result Integration → Response Generation
```

## Critical Configuration Files

- **`.tenex/agents.json`**: Agent registry with nsec keys and configurations
- **`llms.json`**: LLM provider configurations and model settings
- **`.tenex/conversations/*.json`**: Persistent conversation states
- **`src/prompts/fragments/*.ts`**: Reusable prompt components
- **`src/prompts/templates/*.ts`**: High-level prompt builders

## Architectural Strengths

### 1. **Modularity**
- Clear separation of concerns
- Pluggable components (LLM providers, tools)
- Consistent interfaces and contracts

### 2. **Scalability**
- Process isolation per project
- Asynchronous event processing
- Horizontal scaling via multiple instances

### 3. **Reliability**
- Persistent state management
- Error recovery mechanisms
- Circuit breakers and fallbacks

### 4. **Observability**
- Comprehensive logging
- Event audit trails
- Performance metrics collection

### 5. **Extensibility**
- Plugin architecture for tools
- Configurable agent behaviors
- Flexible prompt system

## Architectural Trade-offs

### Complexity vs. Flexibility
- **Pro**: Highly configurable and extensible
- **Con**: Complex setup and debugging

### Event-Driven vs. Direct Calls
- **Pro**: Distributed coordination, loose coupling
- **Con**: Eventual consistency, network dependency

### Process Isolation vs. Resource Efficiency
- **Pro**: Fault isolation, parallel execution
- **Con**: Resource overhead, IPC complexity

### Multi-LLM vs. Single Provider
- **Pro**: Vendor independence, cost optimization
- **Con**: Feature parity challenges, abstraction complexity

## Performance Characteristics

- **Latency**: 2-10 seconds per LLM interaction
- **Throughput**: 10-50 conversations per hour per instance
- **Memory**: ~50-100MB per project runner process
- **Storage**: ~1KB per conversation exchange
- **Network**: Primarily Nostr event traffic

## Development Workflow

### 1. **Local Development**
```bash
# Setup
tenex setup llm
tenex project init

# Development  
bun test           # Run tests
bun test:watch     # Watch mode
bun typecheck      # Type checking
bun lint           # Code linting

# Debugging
tenex debug chat [agent]     # Interactive agent testing
tenex debug system-prompt    # Inspect prompts
```

### 2. **Testing Strategy**
- **Unit Tests**: Individual component testing
- **Integration Tests**: Module interaction testing
- **E2E Tests**: Complete workflow testing
- **System Tests**: Full system behavior testing

### 3. **Debugging Tools**
- Debug agents for interactive testing
- System prompt inspection
- Conversation state examination
- Event flow tracing

## Operational Considerations

### 1. **Deployment**
- Single binary deployment
- Configuration file management
- Key distribution and security

### 2. **Monitoring**
- Application logs with structured JSON
- Performance metrics collection
- Error rate monitoring
- Cost tracking per conversation

### 3. **Scaling**
- Horizontal scaling via multiple daemon instances
- Vertical scaling limited by LLM rate limits
- Resource monitoring and alerting

### 4. **Security**
- Nostr key management
- Agent authorization
- Tool execution sandboxing
- Configuration secrets handling

## Future Evolution

### Planned Enhancements
- **Token Tracking**: Per-agent cost monitoring
- **Advanced Routing**: ML-based phase detection
- **Enhanced Feedback**: Multi-agent consensus protocols
- **Performance**: Response streaming optimization

### Extensibility Points
- **Custom Tools**: Plugin architecture for new tools
- **Agent Types**: Specialized agent implementations
- **Phase Logic**: Custom phase initialization
- **LLM Providers**: Additional provider integrations

## Getting Started with the Architecture

1. **Start with**: [ARCHITECTURE.md](./ARCHITECTURE.md) for core concepts
2. **Understand flows**: [SYSTEM_ARCHITECTURE_DIAGRAMS.md](./SYSTEM_ARCHITECTURE_DIAGRAMS.md) for visual overview
3. **Deep dive**: [SYSTEM_DATA_FLOWS.md](./SYSTEM_DATA_FLOWS.md) for data patterns
4. **Operational view**: [ADDITIONAL_ARCHITECTURE_DIAGRAMS.md](./ADDITIONAL_ARCHITECTURE_DIAGRAMS.md) for deployment

## Code Navigation Guide

### Key Entry Points
- **CLI**: `src/cli.ts` - Command line interface
- **Daemon**: `src/commands/daemon.ts` - Event monitoring service
- **Router**: `src/routing/ConversationRouter.ts` - Central orchestration
- **Agents**: `src/agents/AgentRegistry.ts` - Agent management
- **Tools**: `src/tools/ClaudeCodeExecutor.ts` - External tool integration

### Understanding Event Flow
1. Start at `src/daemon/EventMonitor.ts:handleEvent()`
2. Follow to `src/routing/ConversationRouter.ts:routeNewConversation()`
3. Trace through phase initialization
4. Examine agent execution in `src/agents/execution/AgentExecutor.ts`

### Debugging Integration Issues
1. Check logs for event correlation IDs
2. Examine conversation state in `.tenex/conversations/`
3. Verify agent registry configuration
4. Test LLM connectivity with debug commands

This architecture overview provides the foundation for understanding TENEX's sophisticated agentic coordination system and serves as a guide for both development and operational activities.