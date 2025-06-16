# SPEC.md - TENEX System Specification

> **IMPORTANT**: This is a LIVING DOCUMENT that reflects the current state of TENEX. When the system evolves, update this document to describe what TENEX IS, not what it WAS. Remove outdated information and maintain this as a current reference, not a historical record.

> **NOTE FOR AI AGENTS**: When working through the TENEX CLI, use the `read_specs` tool to access this document and `update_spec` tool (default agent only) to update it. The specification is stored as a Nostr event (NDKArticle) and is the authoritative source of project documentation.

## What is TENEX?

TENEX is a context-first development environment that fundamentally reimagines how software is built in the age of AI. Rather than treating code as the primary interface, TENEX positions **context** as the central building block, orchestrating multiple AI agents to collaborate on software development through a decentralized protocol.

The system has evolved into a sophisticated multi-agent orchestration platform featuring living documentation, agent learning capabilities, and rich communication features that enable AI agents to not just write code, but to understand, maintain, evolve, and learn from complex software projects.

### Core Philosophy

"Orchestrate the orchestrators" - TENEX doesn't just use AI to write code; it creates an environment where multiple specialized AI agents can understand, maintain, and evolve complex software projects through shared context and structured communication.

## System Architecture

TENEX consists of four interconnected components that work together:

### 1. Web Client (`web-client/`)

A Vite-based React application (not Next.js) providing the user interface:

- **Project Management**: Create, configure, and manage software projects with templates
- **Living Documentation**: View and navigate project specifications stored as Nostr events
- **Task Orchestration**: Create, assign, and track development tasks
- **Voice-to-Task**: Convert spoken ideas into structured development tasks
- **Real-time Collaboration**: View live updates with typing indicators and rich text
- **Agent Management**: Configure and monitor multiple AI agents
- **Rich Communication**: Parse and display Nostr entity references

**Key Technologies**:
- Vite + React + TypeScript
- Tailwind CSS v4 + shadcn/ui
- Jotai for state management (not Zustand)
- @nostr-dev-kit/ndk-hooks for Nostr integration
- Whisper API for voice transcription

**Architecture Patterns**:
- Component-based architecture with hooks
- Real-time subscriptions via NDK hooks
- Optimistic updates for better UX
- Entity parsing for rich content display

### 2. CLI Tool (`tenex/`)

A command-line interface for local development operations with sophisticated agent orchestration:

- **Project Initialization**: Set up new TENEX projects locally (`tenex project init`)
- **Agent Orchestration**: Run multi-agent system with `tenex run`
- **Agent Management**: Configure multiple agents with individual identities
- **Status Broadcasting**: Publishes project online status (kind 24010) every 60 seconds
- **Conversation Management**: Persistent storage with token optimization
- **Tool System**: Extensible tool registry for agent capabilities

**Enhanced Agent Features**:
- **Agent Tools**: 
  - `read_specs` - Access living documentation
  - `update_spec` - Update documentation (default agent only)
  - `remember_lesson` - Record learnings from mistakes
  - Claude Code tools for file operations
- **Conversation Persistence**:
  - 30-day retention with automatic cleanup
  - Token usage tracking and optimization
  - Context window management
  - Event deduplication
- **Multi-Agent Support**:
  - Agent-specific LLM configurations
  - Individual tool registries per agent
  - Participant tracking in conversations
  - P-tag based agent summoning

**Project Mode Operations**:
- Fetches project and agent configurations from Nostr
- Displays all available agents and their capabilities
- Subscribes to project events with 5-minute lookback
- Handles tasks, chats, and status updates
- Manages typing indicators with prompt visibility
- Tracks LLM usage and costs in event metadata

### 3. MCP Server (`mcp/`)

Model Context Protocol server that enables AI agents to interact with the system:

- **Publish Status Updates**: Real-time progress updates with agent identification
- **Git Operations**: Advanced git integration with context preservation
- **Learning System**: Remember lessons from mistakes and wrong assumptions
- **Multi-Agent Support**: Manages agent identities and configurations

**Core Tools**:
- `publish_task_status_update` - Progress updates with confidence levels
- `publish` - General Nostr event publishing
- `git_reset_to_commit` - Time travel in git history
- `git_commit_details` - Inspect commit information
- `git_validate_commit` - Verify commit existence
- `remember_lesson` - Record learnings (via MCP integration)

**Agent Loader**:
- Fetches agent configurations from NDKAgent events (kind 4199)
- Parses agent metadata (name, role, instructions, version)
- Configures agent-specific settings and capabilities
- Integrates with project's agent registry

### 4. Shared Libraries (`shared/`)

Common code and type definitions used across all components:

- **Event Types**: Standardized event kinds and interfaces
- **Project Types**: Project and template interfaces  
- **LLM Types**: Configuration interfaces for AI models
- **Utilities**: File system, logging, and Nostr helpers

### 5. TENEX Daemon (`tenexd/`)

A background service that monitors Nostr for events and manages project processes:

- **Event Monitoring**: Listens for all events from whitelisted pubkeys
- **Process Management**: Starts `tenex run` when ANY event with project "a" tag is received
- **LLM Configuration**: Initializes project llms.json from daemon's AI settings if missing
- **Project Discovery**: Automatically initializes projects from Nostr if not found locally
- **Agent Configuration**: Creates agent configurations from NDKAgent events (kind 4199)

**Key Features**:
- Whitelist-based security for event processing
- One `tenex run` process per project
- Automatic llms.json initialization from daemon's AI configurations
- Process deduplication (won't start if already running)
- Real-time project process management

### 6. iOS Client (`ios-client/`)

Native iOS application for mobile access to TENEX:

- **SwiftUI Interface**: Modern, responsive design
- **NDK Integration**: Full Nostr protocol support
- **Project Management**: Create and manage projects on mobile
- **Task Tracking**: Monitor agent progress
- **Real-time Updates**: Live status from agents

## Advanced Features

### Context Management & Optimization

**Context Caching**: 
- Anthropic prompt caching reduces costs by 90% for cached tokens
- OpenRouter automatic caching for supported models
- Enable with `"enableCaching": true` in LLM configs

**Context Window Optimization**:
- Automatic conversation truncation to fit context windows
- Token estimation and usage tracking
- Configurable context window sizes per model

**Configuration Example**:
```json
{
  "provider": "anthropic",
  "model": "claude-3-opus-20240229",
  "enableCaching": true,
  "contextWindowSize": 200000
}
```

### Living Documentation System

Documentation is now stored as Nostr events (NDKArticle kind 30023):

- **Version Control**: Each update creates a new event with timestamp
- **Change Tracking**: Summary tags describe what changed
- **Agent Access**: Agents can read/write documentation
- **Web Viewer**: DocsPage component for browsing specs
- **Decentralized**: Documentation lives on Nostr, not just files

### Agent Learning System

Agents can record lessons learned (kind 4124 events):

- **Mistake Recognition**: Agents detect when assumptions were wrong
- **Lesson Recording**: Structured storage of learnings
- **Knowledge Sharing**: Other agents can access lesson history
- **Continuous Improvement**: System gets smarter over time

## How It All Works Together

### 1. Project Creation Flow

```
User → Web UI → Creates Project → Publishes Project Event (kind 31933) to Nostr
                                → Creates local directory structure
                                → Generates project nsec
                                → Initializes .tenex directory with agents.json and metadata.json
```

### 2. Event-Driven Project Flow

```
Any Event (from whitelisted pubkey) → tenexd receives
                                            ↓
                                    Has project "a" tag?
                                            ↓
                                          If yes:
                                    Extract project identifier
                                            ↓
                                    Check if project running
                                            ↓
                                        If not running:
                                    Initialize project if needed
                                    Initialize llms.json if needed
                                            ↓
                                      Start "tenex run"
                                            ↓
                                    "tenex run" process:
                                    - Fetches project event
                                    - Shows agent configs & LLMs
                                    - Subscribes to all project events
                                    - Publishes 24010 pings every 60s
```

### 3. Context Management

Projects maintain context through:

- **`.tenex/agents.json`**: Maps agent names to their nsec keys
- **`.tenex/llms.json`**: Contains LLM configurations for the project (auto-created by daemon when needed)
- **`.tenex/agents/` directory**: Agent-specific configurations from NDKAgent events
  - During initialization: Automatically fetches and saves all agent definitions referenced in project's "agent" tags
  - File format: `{agent-event-id}.json` containing agent metadata (name, description, role, instructions, version)
- **`.tenex/metadata.json`**: Project metadata including title and naddr
- **SPEC.md files**: Project-specific specifications
- **Nostr events**: Persistent, decentralized project history

## Key Concepts

### Context-First Development

Traditional development: `Code → Documentation → Understanding`
TENEX v4 approach: `Context → Agents → Understanding → Code → Learning`

Context now includes:
- Business requirements and constraints
- Living documentation as Nostr events
- Agent configurations and capabilities
- Conversation history and learnings
- Real-time collaboration state
- Rich text with entity references

### Decentralized Collaboration

All project activity flows through Nostr with enhanced event types:

**Core Events**:
- **Projects** (31933): Project definitions with agent configurations
- **Tasks** (1934): Development tasks with structured metadata
- **Chats** (11/1111): Direct messages and threaded conversations
- **Status Updates** (1): General progress messages

**Agent Events**:
- **Agent Config** (4199): NDKAgent definitions with role/instructions
- **Agent Lessons** (4124): Recorded learnings from mistakes
- **Typing Indicators** (24111/24112): Real-time typing status
- **Project Status** (24010): Online/offline presence

**Documentation Events**:
- **Specifications** (30023): Living documentation as NDKArticle
- **Templates** (30717): Project templates with configurations

**Rich Features**:
- Entity references (nostr:nevent1..., nostr:naddr1...)
- LLM metadata tags (model, tokens, cost)
- System/user prompt visibility in typing indicators
- Multi-agent participant tracking

#### Project Event Structure (kind 31933)

Project events are NDKArticle events with additional fields:
- **d tag**: Unique project identifier (slug)
- **title tag**: Project name
- **repo tag**: Git repository URL
- **hashtags tag**: Array of project hashtags/topics
- **content**: Project description/README

#### Template Event Structure (kind 30717)

Template events contain:
- **d tag**: Unique project identifier
- **title tag**: Project name
- **description tag**: Short project description
- **uri tag**: Git repository URL (format: `git+https://...`)
- **image tag**: Project banner/logo URL
- **command tag**: Execution command (e.g., "git")
- **t tags**: Topics/technologies (e.g., "html", "css")
- **agent tag**: JSON string with agent configuration including name, model, and MCP servers
- **content**: Markdown README with full project documentation

#### Project Status Event Structure (kind 24010)

Status events published by `tenex run` every 60 seconds:
- **content**: JSON object containing:
  - `status`: "online"
  - `timestamp`: Unix timestamp of the ping
  - `project`: Project title
- **a tag**: Project reference (31933:pubkey:identifier)

#### NDKAgent Event Structure (kind 4199)

Agent configuration events:
- **title tag**: Agent name/identifier
- **description tag**: One-line description of agent purpose
- **role tag**: Agent's expertise and personality
- **instructions tag**: Detailed operational guidelines
- **version tag**: Configuration version number
- **a tag**: Project reference (31933:pubkey:identifier)

#### Specification Event Structure (kind 30023)

Living documentation events (NDKArticle):
- **d tag**: Document identifier (e.g., "SPEC", "ARCHITECTURE")
- **title tag**: Human-readable document title
- **summary tag**: Description of latest changes
- **published_at tag**: Unix timestamp of publication
- **a tag**: Project reference
- **content**: Full markdown documentation

#### Agent Lesson Event Structure (kind 4124)

Learning events from agent mistakes:
- **e tag**: References the NDKAgent event ID
- **title tag**: Short lesson summary
- **content**: Detailed lesson learned

#### Typing Indicator Events (kinds 24111/24112)

Real-time typing status:
- **e tag**: Conversation/thread ID
- **a tag**: Project reference
- **system-prompt tag**: LLM system prompt (24111 only)
- **prompt tag**: User prompt being processed (24111 only)
- **content**: Status message or empty (24112)

### AI Agent Orchestration

Enhanced multi-agent system with sophisticated capabilities:

**Agent Types**:
- **Default Agent**: Primary orchestrator with full tool access
- **Code Agent**: Feature implementation specialist
- **Debug Agent**: Issue resolution and testing
- **Planner Agent**: Architecture and design
- **Custom Agents**: Project-specific roles

**Orchestration Features**:
- **Tool Specialization**: Agent-specific tool registries
- **Conversation Tracking**: Multi-agent participant management
- **P-tag Summoning**: Explicit agent invocation via mentions
- **Anti-Chatter Logic**: Prevents unnecessary agent-to-agent messages
- **Learning System**: Agents share lessons across sessions
- **Cost Optimization**: Token caching and context management

## Data Flow

### 1. Project Data

```
Local File System          Nostr Network
├── projects/             ├── Project Events (31933)
│   └── [project]/       ├── Task Events (1934)
│       ├── .tenex/      ├── Status Updates
│       │   ├── agents.json
│       │   ├── metadata.json
│       │   ├── llms.json
│       │   ├── agents/
│       │   └── conversations/
│       └── code/        └── Agent Communications
```

### 2. Configuration Flow

```
Frontend (localStorage) → API Routes → File System
    ↓                        ↓            ↓
Backend URL              Project Config  Source Code
```

### 3. Real-time Updates

```
AI Agent → MCP Server → Nostr Publish → Web Subscriptions → UI Updates
                     ↓
                Git Commit (with context)
```

## Component Interactions

### Web ↔ CLI
- Web creates project structure
- CLI operates on existing projects
- Shared project format (.tenex directory with agents.json and metadata.json)

### Web ↔ MCP
- Web displays MCP status updates
- MCP reads project context
- Shared Nostr identity (project nsec)

### CLI ↔ MCP
- CLI can invoke MCP tools
- MCP provides git integration
- Shared command patterns

## Evolution Guidelines

When extending TENEX:

1. **Context First**: Any new feature should enhance context understanding
2. **Decentralized**: Use Nostr events for all communication
3. **Transparent**: All AI actions should be visible and traceable
4. **Modular**: Components should work independently when possible
5. **Live Documentation**: Update this SPEC.md immediately when changes are made

## Current Implementation Details

### Unified CLI Architecture

The CLI now provides a unified interface combining daemon and project management:

**Core Commands**:
- `tenex daemon` - Starts the event monitoring daemon
  - Monitors Nostr events from whitelisted pubkeys
  - Automatically spawns `tenex project run` for active projects
  - Manages project initialization when needed
- `tenex project init <path> <naddr>` - Initializes a new project
- `tenex project run` - Runs the agent orchestration system for a project

**Architecture Benefits**:
- Single installation and distribution
- Shared code for project management and Nostr connections
- Clean separation of concerns with dependency injection
- Comprehensive testing at all levels (unit, integration, e2e)

### Project Creation
- Uses `tenex project init <path> <naddr>` command
- Initializes `.tenex/` directory structure:
  - `agents.json`: Agent nsec mappings with optional file references
  - `metadata.json`: Project metadata and naddr
  - `llms.json`: LLM configurations (auto-created by tenexd)
  - `agents/`: Cached NDKAgent event definitions
  - `conversations/`: Persistent conversation storage
- Fetches all referenced NDKAgent events automatically
- Creates default agent with project-specific identity

### Project Execution
- `tenex run` starts the agent orchestration system
- Features:
  - Multi-agent conversation handling
  - Tool execution with context
  - Typing indicators with prompt visibility
  - Token usage and cost tracking
  - Event deduplication
  - 30-day conversation retention
  - Automatic context optimization
  - Rich text parsing and display

### Configuration Management
- **Agent Configuration**: Dual format support (legacy string or object)
- **LLM Configuration**: Per-agent settings with caching options
- **Tool Registry**: Extensible, priority-based tool system

## Development Roadmap

### Completed Features (v4.0)
1. **Living Documentation**: Specs as Nostr events with versioning
2. **Agent Learning**: Lesson recording and knowledge persistence
3. **Multi-Agent Orchestration**: Sophisticated conversation management
4. **Rich Communication**: Entity parsing and typing indicators
5. **Cost Optimization**: Token caching and context management

### In Progress
1. **Template Expansion**: More sophisticated project templates
2. **Cross-Project Learning**: Agents sharing lessons between projects
3. **Enhanced Tool System**: More specialized agent tools

### Future Enhancements
1. **Visual Development**: Flowchart to code generation
2. **Testing Orchestration**: AI-driven test generation
3. **Deployment Automation**: CI/CD with agent oversight
4. **Knowledge Graphs**: Semantic code understanding
5. **Swarm Intelligence**: Emergent multi-agent behaviors

## Technical Constraints

- **Bun Runtime**: All components use Bun, not Node.js
- **Nostr Protocol**: All communication must flow through Nostr
- **Local First**: Projects work offline, sync when connected
- **Git Integration**: All code changes tracked with meaningful context
- **Class-Based NDK Wrappers**: Always use NDKAgent and other NDKEvent-extending classes
- **Testability**: All core components use dependency injection for comprehensive testing

---

*Last Updated: January 2025*
*Version: 4.1.0*