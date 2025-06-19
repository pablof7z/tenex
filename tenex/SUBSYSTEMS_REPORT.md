# TENEX CLI Subsystems Analysis Report

## Overview

The TENEX CLI (`./tenex/`) is a sophisticated multi-agent orchestration platform that enables AI agents to collaborate on software development tasks. The codebase is organized into several interconnected subsystems, each responsible for specific aspects of the platform's functionality.

## Key Subsystems

### 1. **Agent System** (`src/agents/`)

**Purpose**: Orchestrates multiple AI agents to collaborate on tasks through structured conversations.

**Key Components**:
- **EventRouter**: Routes incoming Nostr events to appropriate teams
- **TeamOrchestrator**: Analyzes requests and forms optimal agent teams
- **TeamLead**: Manages multi-agent conversations and stage transitions
- **Agent**: Core agent implementation with LLM integration
- **TurnManager**: Coordinates turn-taking in conversations
- **ConversationStore**: Persists conversations with 30-day retention

**Interactions**:
- Receives events from the Event Handling subsystem
- Uses LLM Provider System for AI responses
- Leverages Tool System for agent capabilities
- Publishes responses through Nostr subsystem

**Documentation Status**: Well-documented with `AGENT_SYSTEM_TECHNICAL_SPEC.md`

### 2. **LLM Provider System** (`src/llm/`)

**Purpose**: Provides a unified interface for interacting with multiple Large Language Model providers.

**Key Components**:
- **LLMProvider Interface**: Base interface all providers implement
- **Provider Implementations**: 
  - AnthropicProvider (with caching support)
  - OpenAIProvider
  - OpenRouterProvider
  - OllamaProvider
- **Enhancement Layers**:
  - TypingAwareLLMProvider (publishes typing indicators)
  - ToolEnabledProvider (adds tool-calling capabilities)
- **Infrastructure**:
  - ResponseCache (90% cost reduction with caching)
  - MessageFormatter (provider-specific formatting)
  - CostCalculator (usage and cost tracking)
  - ProviderRegistry (dynamic provider management)

**Interactions**:
- Used by Agent System for generating responses
- Integrates with Tool System for function calling
- Publishes typing indicators through Nostr

**Documentation Status**: Well-documented with `LLM_PROVIDER_SYSTEM_TECHNICAL_SPEC.md`

### 3. **Tool System** (`src/utils/agents/tools/`)

**Purpose**: Extensible framework for giving agents capabilities to interact with the system and external services.

**Key Components**:
- **ToolRegistry**: Dynamic tool registration with priorities
- **ToolExecutor**: Safe tool execution with error handling
- **ToolParser**: Parses tool calls from LLM responses
- **Tool Implementations**:
  - `readSpecs`: Access living documentation
  - `updateSpec`: Update project specifications
  - `rememberLesson`: Record agent learnings
  - `findAgent`: Locate other agents
  - Claude Code tools integration

**Interactions**:
- Registered per-agent in ToolRegistry
- Executed by agents during response generation
- Integrates with file system and Nostr for various operations

**Documentation Status**: Well-documented with `TOOL_SYSTEM_TECHNICAL_SPEC.md`

### 4. **Core Management System** (`src/core/`)

**Purpose**: Manages project lifecycle, event monitoring, and process orchestration.

**Key Components**:
- **ProjectManager**: 
  - Project initialization and loading
  - Generates project nsec for identity
  - Creates project profiles
  - Manages agent configurations
- **EventMonitor**: 
  - Monitors Nostr events from whitelisted pubkeys
  - Triggers project processes based on events
  - Auto-initializes projects and LLM configs
- **ProcessManager**: 
  - Spawns and manages `tenex project run` processes
  - Prevents duplicate processes
  - Handles graceful shutdown

**Interactions**:
- EventMonitor triggers ProcessManager
- ProcessManager uses ProjectManager for initialization
- Integrates with Nostr subsystem for event monitoring

**Documentation Status**: Needs comprehensive documentation

### 5. **Command System** (`src/commands/`)

**Purpose**: CLI command structure and implementation.

**Key Components**:
- **Daemon Command**: Runs event monitoring daemon
- **Project Commands**:
  - `init`: Initialize project from Nostr
  - `run`: Start agent orchestration
- **Setup Commands**: LLM configuration wizard
- **Debug Commands**: Interactive agent testing

**Sub-components in `run/`**:
- **EventHandler**: Processes incoming events
- **SubscriptionManager**: Manages NDK subscriptions
- **StatusPublisher**: Publishes project online status
- **ProjectLoader**: Loads project configurations
- **ProcessedEventStore**: Prevents duplicate event processing

**Interactions**:
- Uses Core Management for project operations
- Integrates Agent System for event handling
- Leverages Nostr subsystem for communications

**Documentation Status**: Needs documentation

### 6. **Nostr Integration** (`src/nostr/`)

**Purpose**: Manages Nostr protocol connections and cryptographic operations.

**Key Components**:
- **ndkClient**: NDK singleton management
- **keyManager**: Cryptographic key operations

**Interactions**:
- Used by all subsystems for Nostr communications
- Provides relay connections
- Manages authentication

**Documentation Status**: Minimal, needs documentation

### 7. **Prompt System** (`src/prompts/`)

**Purpose**: Dynamic system prompt generation for agents.

**Key Components**:
- **SystemPromptComposer**: Composes agent prompts
- **Prompt Templates**:
  - base-agent: Multi-agent base prompt
  - single-agent: Single agent operations
  - team-lead: Team coordination
  - team-orchestrator: Team formation
  - spec-catalog: Available specifications
  - agent-catalog: Available agents
  - tool-instructions: Tool usage

**Interactions**:
- Used by Agent System for prompt construction
- Incorporates project context and rules
- Adapts based on team size and agent role

**Documentation Status**: Needs documentation

### 8. **Utility Systems** (`src/utils/`)

**Purpose**: Supporting utilities and helper functions.

**Key Components**:
- **RulesManager**: Project-specific rules management
- **SpecCache**: Specification caching
- **Agent Utilities**: Agent name formatting
- **Error Handling**: Standardized error formatting

**Interactions**:
- Used throughout all subsystems
- Provides common functionality

**Documentation Status**: Partially documented

## System Integration Flow

1. **Project Initialization**:
   ```
   User → CLI → ProjectManager → Nostr (fetch project) → File System
   ```

2. **Event Processing**:
   ```
   Nostr Event → EventMonitor → ProcessManager → `tenex run` → 
   SubscriptionManager → EventHandler → EventRouter → Agent System
   ```

3. **Agent Response Generation**:
   ```
   Agent → LLM Provider → Tool Execution → Response → Nostr Publication
   ```

4. **Multi-Agent Orchestration**:
   ```
   Event → TeamOrchestrator → Team Formation → TeamLead → 
   TurnManager → Individual Agents → Coordinated Response
   ```

## Areas Needing Documentation

### High Priority:
1. **Core Management System** - Critical for understanding project lifecycle
2. **Command System** - Entry points and command flow
3. **Prompt System** - How prompts are constructed and customized
4. **Nostr Integration** - Protocol integration and key management

### Medium Priority:
1. **Event Processing Flow** - End-to-end event handling
2. **Project Configuration** - Structure and management of `.tenex/` directory
3. **Multi-Agent Coordination** - Team formation and conversation management

### Low Priority:
1. **Utility Functions** - Helper documentation
2. **Error Handling Patterns** - Standardized error management
3. **Testing Infrastructure** - Test patterns and utilities

## Recommendations

1. **Create System Overview Documentation** - High-level architecture diagram showing all subsystems and their interactions

2. **Document Integration Points** - Clear documentation of how subsystems communicate

3. **API Reference** - Public interfaces for each subsystem

4. **Configuration Guide** - Comprehensive guide for all configuration options

5. **Event Flow Diagrams** - Visual representation of event processing

6. **Add inline documentation** - JSDoc comments for key interfaces and classes

The TENEX CLI represents a sophisticated multi-agent orchestration platform with well-separated concerns and clean architecture. While some subsystems are well-documented, others need comprehensive documentation to enable effective maintenance and extension of the platform.