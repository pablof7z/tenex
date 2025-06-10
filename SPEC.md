# SPEC.md - TENEX System Specification

> **IMPORTANT**: This is a LIVING DOCUMENT that reflects the current state of TENEX. When the system evolves, update this document to describe what TENEX IS, not what it WAS. Remove outdated information and maintain this as a current reference, not a historical record.

## What is TENEX?

TENEX is a context-first development environment that fundamentally reimagines how software is built in the age of AI. Rather than treating code as the primary interface, TENEX positions **context** as the central building block, orchestrating multiple AI agents to collaborate on software development through a decentralized protocol.

### Core Philosophy

"Orchestrate the orchestrators" - TENEX doesn't just use AI to write code; it creates an environment where multiple specialized AI agents can understand, maintain, and evolve complex software projects through shared context and structured communication.

## System Architecture

TENEX consists of three interconnected components that work together:

### 1. Main Application (Next.js Frontend/Backend)

The web interface and API that provides:

- **Project Management**: Create, configure, and manage software projects
- **Context Editing**: Define and maintain project specifications, rules, and context
- **Task Orchestration**: Create, assign, and track development tasks
- **Voice-to-Task**: Convert spoken ideas into structured development tasks
- **Real-time Collaboration**: View live updates from AI agents and human developers

**Key Technologies**:
- Next.js 15 with App Router
- TypeScript + React
- Tailwind CSS + shadcn/ui
- Zustand for state management
- NDK (Nostr Development Kit) for protocol integration

**Architecture Patterns**:
- Server Components for initial data loading
- Client-side state for real-time updates
- API routes for file system operations
- Event-driven updates via Nostr subscriptions

### 2. CLI Tool (`cli/`)

A command-line interface for local development operations:

- **Project Initialization**: Set up new TENEX projects locally (`tenex project init`)
- **Task Execution**: Run tasks with different AI backends (`tenex run --roo/--claude/--goose`)
- **Agent Management**: Install, configure, and publish AI agents
- **Local Execution**: Run development commands without web dependency

**Current Implementation**: CLI-based operations handle all local development tasks for better portability and performance.

### 3. MCP Server (`mcp/`)

Model Context Protocol server that enables AI agents to:

- **Publish Status Updates**: Real-time progress updates to Nostr with agent identification
- **Git Operations**: Commit changes with context, reset to previous states
- **Context Access**: Read and understand project rules and specifications
- **Multi-Agent Support**: Manages multiple agent identities from `agents.json`

**Key Features**:
- Automatic git commits with task context
- Commit hash tracking in Nostr events
- Status updates with confidence levels and agent names
- Integration with project agents via `--config-file` parameter
- Agent-specific nsec management for each AI persona

## How It All Works Together

### 1. Project Creation Flow

```
User → Web UI → Creates Project → Publishes Project Event (kind 31933) to Nostr
                                → Creates local directory structure
                                → Generates project nsec
                                → Initializes .tenex directory with agents.json and metadata.json
```

### 2. Task Execution Flow

```
User → Voice Input → Transcription → Task Creation → NDKEvent (kind 1934)
                                                   ↓
AI Agent ← MCP Tools ← Task Assignment ← Nostr Subscription
    ↓
    → Reads context from .tenex/rules/
    → Executes work
    → Publishes status updates
    → Commits changes with context
```

### 3. Context Management

Projects maintain context through:

- **`.tenex/rules/` directory**: Structured rules and specifications
- **`.tenex/` directory**: Project configuration with agents.json and metadata.json files
- **SPEC.md files**: Project-specific specifications
- **Nostr events**: Persistent, decentralized project history

## Key Concepts

### Context-First Development

Traditional development: `Code → Documentation → Understanding`
TENEX approach: `Context → Understanding → Code`

Context includes:
- Business requirements
- Technical constraints
- Architectural decisions
- Domain knowledge
- Workflow patterns

### Decentralized Collaboration

All project activity flows through Nostr:
- **Projects**: Project events (kind 31933) with structured tags
- **Tasks**: NDKEvent (kind 1934)
- **Updates**: Text notes with task references
- **Agents**: Each project maintains multiple agent identities in `.tenex/agents.json`
  - `default`: Primary agent used by default
  - Additional agents (e.g., `code`, `planner`, `debugger`) created as needed
  - Each agent publishes its own kind:0 profile event (e.g., "code @ ProjectName")
- **Templates**: Template events (kind 30717) for project templates

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

### AI Agent Orchestration

Multiple specialized agents work together:
- **Code Agent**: Implements features
- **Debug Agent**: Fixes issues
- **Architect Agent**: Designs systems
- **Orchestrator Agent**: Coordinates work

## Data Flow

### 1. Project Data

```
Local File System          Nostr Network
├── projects/             ├── Project Events (31933)
│   └── [project]/       ├── Task Events (1934)
│       ├── .tenex/      ├── Status Updates
│       │   ├── agents.json
│       │   └── metadata.json
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

### Project Creation
- Uses `tenex project init <path>` command via CLI
- Accepts `--project-naddr` parameter for bech32-encoded project events
- Creates `.tenex/` directory with `agents.json` (containing 'default' agent) and `metadata.json` files
- Backend command configurable: `npx tenex` (default) or `bun ./cli/bin/tenex.ts` (dev)

### Task Execution
- Uses `tenex run` command with backend flags: `--roo`, `--claude`, or `--goose`
- `--roo` backend: VS Code integration with roo-executor
- `--claude` backend: Claude CLI integration with MCP server
  - Automatically creates/uses `claude-code` agent in `agents.json`
  - Configures MCP server with `--config-file` instead of direct nsec
  - Instructs Claude about its agent name for status updates
- `--goose` backend: Not yet implemented
- Accepts task details: `--project-path`, `--task-id`, `--task-title`, `--task-description`, `--context`
- Replaces the previous script-based approach for better modularity

## Development Roadmap

1. **Template System**: Expanding project templates with predefined contexts
2. **Agent Capabilities**: Enhancing MCP tools for better AI integration
3. **Context Intelligence**: Improving how agents understand and use context

## Technical Constraints

- **Bun Runtime**: All components use Bun, not Node.js
- **Nostr Protocol**: All communication must flow through Nostr
- **Local First**: Projects work offline, sync when connected
- **Git Integration**: All code changes tracked with meaningful context

---

*Last Updated: January 10, 2025*
*Version: 1.6.0*