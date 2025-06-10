# TENEX: Comprehensive Technical Report

## Executive Summary

TENEX is a revolutionary **context-first development environment** that fundamentally reimagines software development in the age of AI. Rather than treating code as the primary interface, TENEX positions context—business requirements, technical constraints, architectural decisions, and domain knowledge—as the central building block. It orchestrates multiple specialized AI agents to collaborate on software projects through the decentralized Nostr protocol.

The system implements the philosophy of "orchestrate the orchestrators," creating an environment where AI agents become first-class citizens with persistent identities, reputation, and the ability to collaborate transparently through a decentralized network.

## System Architecture Overview

TENEX consists of five interconnected components:

### 1. Web Application (my-nostr-app/)
A React-based Progressive Web App that provides:
- **Project Management Dashboard**: Create and manage software projects with rich metadata
- **Task Orchestration**: Voice-to-task conversion, task creation, and tracking
- **Agent Management**: Configure and assign specialized AI agents to projects
- **Real-time Collaboration**: Live status updates from AI agents with confidence levels
- **Responsive Design**: Adaptive layouts for mobile and desktop experiences

**Technical Stack**: React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui, Jotai state management

### 2. CLI Tool (cli/)
Command-line interface for local development operations:
- **Project Initialization**: `tenex project init` creates local project structure from Nostr events
- **Task Execution**: `tenex run` fetches and displays task information
- **Agent Publishing**: `tenex agent publish` shares AI agent configurations
- **Rules Management**: `tenex rules` manages project-specific instructions

**Technical Stack**: TypeScript, Commander.js, Bun runtime, NDK for Nostr integration

### 3. MCP Server (mcp/)
Model Context Protocol server that bridges AI agents and the decentralized network:
- **Multi-Agent Support**: Dynamic creation and management of agent identities
- **Status Publishing**: Real-time progress updates with confidence levels (1-10)
- **Git Integration**: Automatic commits with task context and commit hash tracking
- **Context Access**: Reads project rules and specifications

**Version**: 0.5.0 with sophisticated multi-agent orchestration capabilities

### 4. Shared Library (shared/)
Common utilities and logic used across components:
- Project initialization logic
- Nostr utility functions
- Logging infrastructure

### 5. TENEX Daemon (tenexd/)
Background service for persistent operations:
- Monitors task events from whitelisted users
- Auto-initializes projects when tasks arrive
- Publishes heartbeat status every 60 seconds
- Bridges web UI and local development environment

## Core Innovations

### Context-First Development
Traditional approach: `Code → Documentation → Understanding`
TENEX approach: `Context → Understanding → Code`

Context in TENEX includes:
- Business requirements and constraints
- Technical architecture decisions
- Domain-specific knowledge
- Workflow patterns and rules
- Historical project decisions

### Multi-Agent Orchestration
Each project maintains multiple specialized agent identities:
- **Default Agent**: Primary project identity
- **Code Agent**: Implements features and fixes bugs
- **Planner Agent**: Designs architecture and plans work
- **Debugger Agent**: Troubleshoots issues
- **Custom Agents**: Project-specific specialists

Agents are created dynamically when first used, each with:
- Unique Nostr identity (nsec)
- Profile event (e.g., "code @ ProjectName")
- Ability to publish status updates and build reputation

### Decentralized Architecture
All communication flows through Nostr protocol using specific event types:
- **Kind 31933**: Projects (parameterized replaceable events)
- **Kind 1934**: Tasks
- **Kind 30717**: Templates
- **Kind 4199**: Agent definitions
- **Kind 1339**: Instructions/Rules
- **Kind 1**: Status updates with custom tags

## Data Flow Architecture

### Project Creation Flow
```
Web UI → Creates NDKProject Event → Publishes to Nostr
                                 ↓
CLI → Fetches Event → Creates Local Structure:
      project-name/
      ├── .tenex/
      │   ├── agents.json    # Agent identities
      │   └── metadata.json  # Project metadata
      └── [source code]
```

### Task Execution Flow
```
Voice/Text Input → Task Creation → NDKTask Event (kind 1934)
                                ↓
Backend Trigger → Task Event (kind 24010) → Tenexd/CLI
                                          ↓
AI Agent → Reads Context → Executes Work → MCP Server
                                         ↓
                        Status Updates → Git Commits → Nostr Events
```

### Status Update Flow
```
AI Agent → MCP Tool Call → Git Commit (if changes)
                        ↓
         Nostr Event with Tags:
         - Task reference
         - Confidence level (1-10)
         - Commit hash
         - Previous event (threading)
                        ↓
         Web UI Subscription → Real-time Display
```

## Technical Implementation Details

### Nostr Integration
- **NDK (Nostr Development Kit)**: Used consistently across all components
- **Relay Configuration**: Multiple relays for redundancy (Primal, Damus, purplepag.es, nos.lol)
- **Optimistic Publishing**: Events published without waiting for confirmation
- **Custom Event Classes**: NDKAgent, NDKTask, NDKProject extending base NDK types

### Security & Privacy
- Each project has isolated agent identities
- Private keys stored as nsec format
- No cross-contamination between projects
- File system permissions for local security

### Performance Optimizations
- Component lazy loading in web app
- Efficient subscription management
- In-memory caching by default
- Batch operations where possible

## Key Design Decisions

1. **Bun Runtime**: Chosen for performance over Node.js
2. **Nostr Protocol**: Enables true decentralization and censorship resistance
3. **Local-First**: Projects work offline, sync when connected
4. **Living Documentation**: SPEC.md as single source of truth
5. **No React Context for NDK**: Singleton pattern for better performance

## Current Capabilities

### What TENEX Can Do Today
- Create and manage decentralized software projects
- Orchestrate multiple AI agents with different specialties
- Track task progress with confidence levels
- Maintain project context and rules
- Provide real-time collaboration through Nostr
- Work offline with sync capabilities
- Support voice-to-task creation
- Integrate with VS Code (via roo backend)

### Integration Points
- **VS Code**: Through roo-executor for AI-assisted development
- **Git**: Automatic commits with task context
- **Various AI Backends**: Extensible to support Claude, GPT, and other models
- **Web Standards**: PWA-ready with service worker support

## Future Potential

The architecture is designed to support:
- Enhanced template system with predefined contexts
- More sophisticated agent capabilities
- Better context intelligence and learning
- Cross-project knowledge sharing
- Reputation-based agent selection

## Conclusion

TENEX represents a paradigm shift in software development, moving from code-centric to context-centric approaches. By leveraging decentralized protocols, multi-agent orchestration, and AI-first design, it creates an environment where software can be developed more intelligently, collaboratively, and transparently.

The system successfully implements its vision of "orchestrating the orchestrators," providing a foundation for a new era of AI-assisted software development where context drives understanding, and understanding drives better code.