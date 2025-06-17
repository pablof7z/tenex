# TENEX CODEBASE INVENTORY

> **CRITICAL INSTRUCTION FOR AI AGENTS**: This file MUST be updated whenever you add, edit, or remove functionality. When you notice discrepancies between this inventory and the actual codebase, immediately update this file to reflect the current state. This inventory serves as the source of truth for understanding reusable components across the entire TENEX ecosystem.

## Overview

TENEX is a sophisticated multi-agent orchestration platform with a monorepo architecture. This inventory documents all reusable components, classes, services, and utilities that can be leveraged across the ecosystem.

## Architecture Summary

- **Web Client** (`web-client/`) - Vite React app with sophisticated UI components
- **CLI Tool** (`tenex/`) - Multi-agent orchestration with advanced LLM integration
- **MCP Server** (`mcp/`) - Model Context Protocol server for AI integration
- **Shared Libraries** (`shared/`) - Common utilities and business logic
- **CLI Client** (`cli-client/`) - Interactive command-line interface

---

## 🎯 Shared Libraries (`shared/`)

### Core Services
- **`ProjectService`** - Complete project lifecycle management (create, clone, initialize) with metadata.json structure
- **`FileSystem`** - Abstracted file operations with async/await patterns
- **`TenexFileSystem`** - TENEX-specific file operations (.tenex directory management)
- **`ConfigLoader`** - Configuration loading with validation and environment overrides
- **`Logger`** - Structured logging with multiple output formats

### Project Identity System
- **Project nsec Generation** - Unique cryptographic identity for each project stored in metadata.json
- **Project Profile Creation** - Automatic kind:0 Nostr profile events for project discoverability
- **Spec Signing** - Living documentation signed by project identity (not individual agents)
- **Consistent Attribution** - All project specifications maintain unified authorship

### Business Utilities (`src/utils/business.ts`)
- **`StringUtils`** - Text manipulation, truncation, initials generation, slugification
- **`LocalStorageUtils`** - Secure browser storage with type-safe operations
- **`ProfileUtils`** - Avatar URLs, display names, profile initials
- **`StatusUtils`** - Status colors, icons, and visual indicators
- **`TaskUtils`** - Task title extraction, complexity parsing, priority handling
- **`ArrayUtils`** - Unique additions, item removal, array toggling operations
- **`ValidationUtils` & `ValidationRules`** - Form validation patterns and rules
- **`CSSUtils`** - Class name combination, responsive utilities, avatar sizing

---

## 🎨 Web Client (`web-client/src/`)

### UI Component Library (`components/ui/`)
- **`Button`** - Comprehensive button with variants (primary, success, destructive, ghost, outline) and sizing (sm, default, lg, xl, icon)
- **`Dialog`**, **`Drawer`**, **`Sheet`** - Modal and overlay system with animations
- **`Card`**, **`Badge`**, **`Avatar`** - Content display components with theming
- **`Input`**, **`Textarea`**, **`Checkbox`**, **`Select`** - Form input components with validation
- **`HoverCard`**, **`DropdownMenu`**, **`Popover`** - Interactive overlay components
- **`ScrollArea`**, **`Separator`**, **`Skeleton`** - Layout and loading utilities
- **`Tabs`**, **`Accordion`**, **`Collapsible`** - Content organization components

### Business Components (`components/`)
- **`MessageWithEntities`** - Parse and display Nostr entity references (nevent, naddr, npub)
- **`NostrEntityCard`** - Rich display for Nostr entities with metadata and actions
- **`AgentCard`**, **`AgentSelector`**, **`AgentForm`** - Agent management interface
- **`TaskCard`**, **`TaskOverview`**, **`TaskUpdates`** - Task display and interaction
- **`ProjectCard`**, **`ProjectDetail`**, **`ProjectTabs`** - Project management interfaces
- **`TemplateCard`**, **`TemplateSelector`** - Template browsing and selection
- **`ChatInterface`**, **`ChatTypingIndicator`** - Real-time communication components
- **`DocumentationView`**, **`SpecificationViewer`** - Living documentation display
- **`EmptyState`**, **`ErrorState`**, **`LoadingState`** - Standard state components

### Custom Hooks (`hooks/`)
- **`useProjectData`** - Comprehensive project data subscription (tasks, threads, articles, status)
- **`useAgentActions`** - Agent CRUD operations (create, edit, delete, configure)
- **`useProjectStatus`** - Real-time project online/offline status tracking
- **`useBackendStatus`** - Backend health monitoring and connection status
- **`useInstructions`** - Instruction template management and application
- **`useTemplates`** - Project template browsing and filtering
- **`useAgentLessons`** - Agent learning system integration
- **`useProjectLLMConfigs`** - LLM configuration management per project
- **`useDialogState`** - Modal state management with stacking support
- **`useSwipeGesture`** - Mobile gesture handling for navigation
- **`useScrollManagement`** - Scroll behavior control and restoration

### State Management (`lib/store.ts`)
- **Jotai Atoms**: `onlineBackendsAtom`, `selectedTaskAtom`, `selectedProjectAtom`, `themeAtom`
- **Derived State**: `onlineProjectsAtom` (combines backend and project status data)
- **Persistent State**: Theme preferences, user settings, last selected items

### Utilities (`utils/`)
- **`nostrEntityParser`** - Parse Nostr entities in text (`findNostrEntities`, `replaceNostrEntities`, `decodeEntity`)
- **`ndkSetup`** - NDK initialization with relay configuration and authentication

---

## 🤖 Agent System (`tenex/src/utils/agents/`)

### Core Agent Classes
- **`Agent`** - Core agent implementation with LLM integration and tool execution
- **`AgentManager`** - Multi-agent lifecycle management and coordination
- **`AgentOrchestrator`** - High-level agent communication and task distribution
- **`AgentCore`** - Agent identity, configuration, and state management
- **`AgentResponseGenerator`** - Response generation with context and tools

### Conversation System
- **`Conversation`** - Thread-safe conversation management with participant tracking
- **`ConversationStorage`** - Persistent conversation storage with 30-day retention
- **`ConversationOptimizer`** - Token usage optimization and context window management
- **`ChatEventHandler`** - Chat message processing and routing
- **`TaskEventHandler`** - Task-related conversation handling

### LLM Provider System (`llm/`)
- **`AnthropicProvider`** - Claude integration with prompt caching (90% cost reduction)
- **`AnthropicProviderWithCache`** - Enhanced caching implementation
- **`OpenAIProvider`** - GPT integration with function calling
- **`OpenRouterProvider`** - Multi-model provider with automatic fallbacks
- **`ToolEnabledProvider`** - Universal tool-calling wrapper for any LLM
- **`LLMFactory`** - Provider instantiation with configuration and caching
- **`costCalculator`** - LLM usage cost tracking and reporting

### Tool System (`tools/`)
- **`ToolRegistry`** - Dynamic tool registration with priority and dependency management
- **`ToolExecutor`** - Safe tool execution with error handling and sandboxing
- **`ToolParser`** - Parse structured tool calls from LLM responses
- **Agent-Specific Tools**:
  - **`readSpecs`** - Access living documentation from Nostr events
  - **`updateSpec`** - Update project specifications using project nsec for signing (default agent only)
  - **`rememberLesson`** - Record learnings from mistakes
  - **`addTask`** - Create new tasks in project workflow
  - **`findAgent`** - Locate and summon other agents
- **Claude Code Integration** - Full compatibility with Claude Code tool system

### Prompt System (`prompts/`)
- **`SystemPromptBuilder`** - Dynamic system prompt construction with modularity
- **Prompt Builders**:
  - **`AgentIdentityBuilder`** - Agent role and personality definition
  - **`ProjectContextBuilder`** - Project-specific context and constraints
  - **`TeamInformationBuilder`** - Multi-agent team coordination information
  - **`ProjectRulesBuilder`** - Project-specific rules and guidelines
  - **`ProjectSpecsBuilder`** - Living documentation integration
  - **`StaticInstructionsBuilder`** - Base instruction templates
- **`SpecCache`** - Efficient specification caching and invalidation

---

## 🎼 Advanced Orchestration (`tenex/src/core/orchestration/`)

### Orchestration Core
- **`TeamOrchestrator`** - High-level multi-agent team coordination
- **`TeamFormationAnalyzer`** - Dynamic team assembly based on task requirements
- **`OrchestrationFactory`** - Strategy pattern for orchestration types
- **`PromptBuilder`** - Context-aware prompt construction for orchestration
- **`OrchestrationCoordinator`** - Integration between orchestration systems

### Orchestration Strategies (`strategies/`)
- **`HierarchicalStrategy`** - Leader-follower agent relationships
- **`ParallelExecutionStrategy`** - Concurrent agent task execution
- **`SingleResponderStrategy`** - Single agent response coordination
- **`PhasedDeliveryStrategy`** - Sequential phase-based execution for complex tasks with:
  - Lead agent creates phase plan breaking down complex requests
  - Each phase has specific agents, deliverables, and dependencies
  - Phase results feed into subsequent phases for building solutions
  - Lead agent reviews phase completion before proceeding
  - Final integration phase combines all deliverables into cohesive response

### Quality Systems
- **`GreenLightSystem`** - Task approval and validation workflows
- **`SupervisionSystem`** - Agent oversight and quality control
- **`ReflectionSystem`** - Agent self-assessment and improvement

### Adapters
- **`ConsoleLoggerAdapter`** - Logging integration for orchestration
- **`LLMProviderAdapter`** - LLM integration for orchestration decisions

---

## 🛠️ CLI System (`tenex/src/`)

### Core Management
- **`ProjectManager`** - Project lifecycle, configuration, and metadata management with project nsec generation and profile creation
- **`EventMonitor`** - Nostr event monitoring with filtering and processing
- **`ProcessManager`** - Multi-process coordination and lifecycle management

### Command Handlers (`commands/`)
- **`daemon.ts`** - Background daemon for event monitoring
- **`project/init.ts`** - Project initialization from Nostr events
- **`project/run.ts`** - Multi-agent orchestration startup
- **`debug/index.ts`** - Debugging and diagnostic tools

### Event Handling (`commands/run/`)
- **`AgentEventHandler`** - Agent-specific event processing
- **`EventHandler`** - Base event handling patterns
- **`ProjectDisplay`** - Project status and information display
- **`ProjectLoader`** - Project configuration loading with enhanced metadata.json parsing (includes project nsec)
- **`StatusPublisher`** - Project status broadcasting

---

## 🔌 MCP Server (`mcp/`)

### Core MCP Tools
- **`AgentLoader`** - Load agent configurations from NDKAgent events (kind 4199)
- **Git Integration Tools**:
  - **`git_reset_to_commit`** - Time travel in git history with safety checks
  - **`git_commit_details`** - Detailed commit information and analysis
  - **`git_validate_commit`** - Verify commit existence and integrity
- **Publishing Tools**:
  - **`publish_task_status_update`** - Real-time progress updates with agent identification
  - **`publish`** - General Nostr event publishing with validation
- **Learning Tools**:
  - **`remember_lesson`** - Record agent learnings and mistakes

### NDK Integration
- **Full Nostr Protocol Support** - Complete NDK integration for decentralized communication
- **Event Kind Handling** - Support for all TENEX event types (tasks, status, lessons, etc.)

---

## 💻 CLI Client (`cli-client/`)

### Interactive Interface
- **`TenexCLI`** - Interactive chat interface with command parsing
- **Command Handlers**:
  - **`project-create`** - Interactive project creation wizard
  - **`project-start`** - Project execution and monitoring
- **Event Processing**:
  - **`agent.ts`** - Agent-related command handling
  - **`instruction.ts`** - Instruction management commands
- **NDK Setup** - Nostr connection management and authentication

---

## 🧪 Test Infrastructure (`packages/test-utils/`)

### Mock Systems
- **`AgentBuilder`**, **`AgentFixtures`**, **`AgentMocks`** - Comprehensive agent testing utilities
- **`NostrBuilders`**, **`NostrHelpers`**, **`NostrMocks`** - Nostr protocol testing support
- **`TestProviders`**, **`TestRender`** - React testing utilities with context providers
- **General Fixtures** - Test data generators and helper functions

---

## 🏗️ Architectural Patterns

### Design Patterns Used
1. **Dependency Injection** - Core classes use DI for testability and modularity
2. **Strategy Pattern** - Orchestration strategies, LLM providers, tool execution
3. **Observer Pattern** - Event monitoring, real-time status updates
4. **Factory Pattern** - LLM provider creation, tool instantiation
5. **Adapter Pattern** - LLM provider interfaces, tool format standardization
6. **Repository Pattern** - Conversation storage, agent configuration management
7. **Builder Pattern** - Prompt construction, system configuration
8. **Registry Pattern** - Tool management, plugin-like architecture

### Integration Patterns
- **NDK Integration** - All components use `@nostr-dev-kit/ndk` directly (no wrappers)
- **Type Safety** - Shared TypeScript types ensure consistency
- **Tool System** - Extensible tool registry shared between CLI and MCP
- **Configuration** - Unified config system with environment-specific overrides
- **Event System** - Standardized Nostr event handling across components
- **State Management** - Jotai for web client, in-memory for CLI components

---

## 📊 Reusability Matrix

### Highly Reusable (90%+ reuse potential)
- UI component library (`web-client/src/components/ui/`)
- Business utilities (`shared/src/utils/business.ts`)
- Custom hooks (`web-client/src/hooks/`)
- Agent system core (`tenex/src/utils/agents/`)
- Tool registry and execution system
- LLM provider abstractions

### Moderately Reusable (70-90% reuse potential)
- Specific LLM provider implementations
- Nostr entity parsers and processors
- Orchestration strategies
- File system abstractions
- Test utilities and mocks

### Project-Specific (50-70% reuse potential)
- Page-level components
- Project-specific CLI commands
- MCP server tool implementations
- Configuration schemas

---

## 🚨 Maintenance Instructions

### For AI Agents Working on TENEX:

1. **ALWAYS** update this inventory when you:
   - Add new classes, components, or utilities
   - Modify existing functionality significantly
   - Remove or deprecate features
   - Notice discrepancies between this inventory and actual code

2. **When updating this file**:
   - Maintain the existing structure and format
   - Add new items in the appropriate sections
   - Update value propositions to reflect current functionality
   - Remove outdated entries
   - Update the reusability matrix if needed

3. **Before starting work**:
   - Read this inventory to understand available components
   - Check if functionality already exists before creating new code
   - Leverage existing patterns and utilities

4. **Quality standards**:
   - All new reusable components should follow established patterns
   - Maintain type safety throughout
   - Include appropriate error handling
   - Follow the dependency injection pattern where applicable

---

## 🆕 Recent Updates

### Phased Delivery Strategy Addition (January 2025)
- **Added PhasedDeliveryStrategy** - New orchestration strategy for complex multi-phase tasks
- **Sequential phase execution** - Tasks broken down into phases with specific deliverables
- **Phase dependencies** - Later phases build upon results from earlier phases
- **Lead agent coordination** - Lead agent plans phases, reviews progress, and integrates results
- **Comprehensive testing** - Full test coverage including partial failure handling

### Project Identity System Enhancement (January 2025)
- **Added project nsec generation** - Each project now has its own cryptographic identity
- **Enhanced metadata.json structure** - Now includes project nsec for consistent attribution
- **Updated updateSpec tool** - Living documentation now signed by project identity rather than individual agents
- **Project profile creation** - Automatic kind:0 Nostr profile events for improved discoverability
- **Backwards compatibility** - Graceful handling of projects without nsec (requires re-initialization)

---

*Last Updated: January 2025*
*Inventory Version: 1.1.0*