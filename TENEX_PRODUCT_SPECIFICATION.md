# TENEX Product Specification - Complete Functional Requirements

## Executive Summary

TENEX is a revolutionary context-first development environment that orchestrates multiple AI agents to build software collaboratively through a decentralized protocol (Nostr). Unlike traditional development tools that focus on code as the primary interface, TENEX positions **context** as the central building block, enabling AI agents to understand, maintain, evolve, and learn from complex software projects through shared context and structured communication.

## Core Concept

**Traditional Development Flow**: Code → Documentation → Understanding  
**TENEX Development Flow**: Context → AI Agents → Understanding → Code → Learning

TENEX transforms software development from a human-centric coding activity into an AI-orchestrated collaborative process where multiple specialized agents work together to implement features, fix bugs, and evolve software based on high-level tasks and specifications.

## System Architecture

### 1. Web Client (User Interface)
A browser-based application that provides the primary user interface for:
- Creating and managing software projects
- Defining tasks for AI agents to complete
- Monitoring real-time progress of development work
- Managing AI agent configurations and capabilities
- Viewing living documentation
- Voice-to-task conversion

### 2. CLI Tool (Agent Orchestration)
A command-line tool that:
- Initializes projects from Nostr events
- Runs the multi-agent orchestration system
- Manages conversations between agents
- Handles tool execution for agents
- Publishes status updates every 60 seconds
- Maintains persistent conversation history

### 3. MCP Server (Agent Tools)
A Model Context Protocol server that provides AI agents with tools to:
- Publish status updates with confidence levels
- Perform git operations (reset, inspect commits)
- Record lessons learned from mistakes
- Publish general Nostr events
- Interact with the development environment

### 4. TENEX Daemon (Process Management)
A background service that:
- Monitors Nostr for events from whitelisted users
- Automatically starts agent orchestration for projects
- Manages LLM configurations
- Initializes projects from Nostr if not found locally
- Ensures one orchestration process per project

### 5. Shared Libraries
Common code providing:
- Type definitions for all events and data structures
- Nostr protocol integration
- File system utilities
- Configuration management
- Logging infrastructure

## Complete Feature Set

### Project Management

#### Project Creation
1. **Multi-Step Wizard**:
   - Step 1: Enter project name, description, hashtags, repository URL, and banner image
   - Step 2: Select from available project templates or start empty
   - Step 3: Choose AI agents to work on the project (multiple selection)
   - Step 4: Select project-specific instructions/rules for agents
   - Step 5: Review and confirm all selections

2. **Project Structure**:
   ```
   project/
   ├── .tenex/
   │   ├── agents.json          # Maps agent names to nsec keys
   │   ├── metadata.json        # Project title, naddr, and metadata
   │   ├── llms.json           # LLM provider configurations
   │   ├── agents/             # Cached agent definitions
   │   └── conversations/      # Persistent conversation history
   └── [actual project files]
   ```

3. **Project Events** (Nostr kind 31933):
   - Unique identifier (d tag)
   - Project title and description
   - Repository URL
   - Associated agents
   - Hashtags/topics
   - Instruction references

### Task Management

#### Task Creation Methods
1. **Manual Creation**:
   - Title and description input
   - Published as NDKTask event (kind 1934)
   - Automatically tagged with project reference

2. **Voice-to-Task**:
   - Auto-starts audio recording
   - Transcribes using OpenAI Whisper API
   - Extracts title and description using GPT-3.5
   - Creates structured task from natural language

#### Task Features
- Real-time status updates from agents
- Swipeable interface for task actions
- Progress tracking and confidence levels
- Thread-based discussions per task
- Multi-agent collaboration on single tasks

### AI Agent System

#### Agent Types
1. **Default Agent**: Primary orchestrator with full tool access
2. **Code Agent**: Feature implementation specialist
3. **Debug Agent**: Issue resolution and testing expert
4. **Planner Agent**: Architecture and design specialist
5. **Custom Agents**: Project-specific roles and capabilities

#### Agent Capabilities
1. **Development Tools**:
   - File system operations (read, write, edit, delete)
   - Shell command execution with timeouts
   - Git operations via MCP server
   - Project-aware context management

2. **Documentation Tools**:
   - Read project specifications from Nostr
   - Update living documentation (default agent only)
   - Version-controlled documentation management

3. **Learning System**:
   - Record lessons from mistakes
   - Persist knowledge across sessions
   - Share learnings with other agents
   - Continuous improvement over time

4. **Communication Features**:
   - Multi-agent conversations
   - P-tag based agent summoning
   - Anti-chatter logic to prevent loops
   - Rich text with entity references

#### Agent Configuration (NDKAgent kind 4199)
- Unique identifier and name
- Role description and expertise
- Detailed operational instructions
- Version tracking
- Tool registry assignments
- LLM model preferences

### Living Documentation

#### Documentation System
1. **Storage**: NDKArticle events (kind 30023) on Nostr
2. **Versioning**: Each update creates new event with timestamp
3. **Change Tracking**: Summary tags describe modifications
4. **Access Control**: Agents can read, default agent can write

#### Documentation Features
- Full markdown support with GFM
- Syntax highlighting for code blocks
- Reading time estimation
- Tag-based categorization
- Update history with summaries
- Web-based viewer interface

### Real-Time Collaboration

#### Typing Indicators (kinds 24111/24112)
- Shows when agents are processing
- Displays current activity
- Optional debug info with prompts
- Animated status indicators

#### Status Updates
- Progress updates with confidence levels (1-10)
- Agent identification
- Task context references
- Git integration for commits
- Published to Nostr for all subscribers

#### Project Online Status (kind 24010)
- Published every 60 seconds by CLI
- Contains timestamp and project info
- Indicates active orchestration process

### Communication Features

#### Chat System
1. **Direct Messages** (kind 11):
   - Agent-to-user communication
   - Status updates and questions

2. **Threaded Conversations** (kind 1111):
   - Task-specific discussions
   - Multi-agent collaboration threads
   - Rich text with entity references

#### Entity References
- Support for Nostr entity URIs (nostr:nevent1..., nostr:naddr1...)
- Hover cards showing entity details
- Cross-referencing between events
- Rich text parsing and display

### Configuration Management

#### LLM Provider Support
1. **Anthropic**:
   - Claude models with prompt caching
   - 90% cost reduction for cached tokens
   - Context window optimization

2. **OpenAI**:
   - GPT models
   - Function calling support
   - Whisper API for voice

3. **Other Providers**:
   - OpenRouter (multi-model routing)
   - Google (Gemini models)
   - Groq (fast inference)
   - DeepSeek (specialized models)

#### Configuration Features
- Per-agent LLM assignments
- Context window management
- Token usage tracking
- Cost optimization settings
- Caching configurations

### Advanced Features

#### Multi-Agent Orchestration
1. **Conversation Management**:
   - 30-day retention with auto-cleanup
   - Token optimization
   - Context window management
   - Event deduplication
   - Persistent storage

2. **Tool Specialization**:
   - Agent-specific tool registries
   - Priority-based tool selection
   - Custom tool implementations
   - Shared tool libraries

3. **Collaboration Features**:
   - Agent summoning via p-tags
   - Participant tracking
   - Turn-based conversations
   - Conflict resolution

#### Cost Optimization
- Anthropic prompt caching
- Automatic context truncation
- Token usage monitoring
- Model-specific optimizations
- Conversation pruning

#### Template System
1. **Project Templates** (kind 30717):
   - Pre-configured project setups
   - Agent role assignments
   - Instruction templates
   - Repository scaffolding
   - Technology stacks

2. **Template Features**:
   - Git repository URLs
   - Default agent configurations
   - Topic/technology tags
   - Banner images
   - README documentation

## Data Flow Architecture

### Event-Driven Architecture
```
User Action → Web Client → Nostr Event → All Subscribers
                                      ↓
                                   TENEX Daemon
                                      ↓
                              Starts "tenex run"
                                      ↓
                          CLI subscribes to events
                                      ↓
                         Agent processes event
                                      ↓
                       MCP Server tools used
                                      ↓
                     Response published to Nostr
                                      ↓
                    Web Client shows update
```

### Event Types Summary

#### Project Events
- **31933**: Project definitions (NDKProject)
- **30717**: Project templates
- **30023**: Living documentation (NDKArticle)

#### Task & Communication
- **1934**: Development tasks (NDKTask)
- **11**: Direct messages
- **1111**: Threaded conversations
- **1**: General status updates

#### Agent Events
- **4199**: Agent configurations (NDKAgent)
- **4124**: Agent lessons learned
- **24111**: Typing indicator start
- **24112**: Typing indicator stop
- **24010**: Project online status

## Security & Privacy

### Access Control
- Whitelist-based event processing in daemon
- Project-specific nsec keys
- Agent-specific identities
- No central server or API

### Decentralized Architecture
- All data stored on Nostr relays
- No vendor lock-in
- Portable project data
- User-controlled keys

## User Workflows

### Typical Development Workflow
1. **Create Project**: User defines project through web UI
2. **Daemon Activation**: TENEXD detects project and starts orchestration
3. **Task Definition**: User creates tasks via UI or voice
4. **Agent Processing**: Agents receive tasks and begin work
5. **Real-time Updates**: User monitors progress through web UI
6. **Code Generation**: Agents implement features and commit code
7. **Learning**: Agents record lessons for future improvement

### Voice-Driven Development
1. **Voice Recording**: User speaks development request
2. **Transcription**: Whisper API converts to text
3. **Task Extraction**: GPT extracts structured task
4. **Agent Assignment**: Task routed to appropriate agents
5. **Implementation**: Agents collaborate to complete task

## System Requirements

### Technical Prerequisites
- Bun runtime (not Node.js)
- Git for version control
- Nostr relay access
- LLM API keys (OpenAI, Anthropic, etc.)

### Deployment Model
- Local-first architecture
- Decentralized data storage
- No central infrastructure
- Peer-to-peer collaboration

## Key Innovations

1. **Context-First Development**: Prioritizes understanding over code
2. **Decentralized Collaboration**: No central server required
3. **Living Documentation**: Docs that evolve with the project
4. **Agent Learning**: Continuous improvement through experience
5. **Multi-Agent Orchestration**: Specialized agents working together
6. **Voice-to-Code**: Natural language to implementation
7. **Real-time Transparency**: All actions visible and traceable

## Implementation Notes for Recreation

### Critical Implementation Details

1. **Event Ordering**: Use created_at timestamps for event ordering
2. **Deduplication**: Track seen event IDs to prevent duplicates
3. **Context Windows**: Respect model-specific token limits
4. **Relay Management**: Handle relay connection failures gracefully
5. **Key Management**: Secure storage of nsec keys
6. **Process Management**: Ensure single orchestration per project
7. **Conversation Storage**: Implement 30-day retention policy
8. **Token Optimization**: Cache prompts where supported
9. **Error Handling**: Graceful degradation for missing agents
10. **Status Updates**: Consistent 60-second heartbeat

### Architecture Decisions

1. **No Backend API**: Everything through Nostr protocol
2. **Local-First**: Projects work offline, sync when connected
3. **Event Sourcing**: All state changes as Nostr events
4. **Agent Autonomy**: Each agent operates independently
5. **Tool Extensibility**: Plugin architecture for new tools
6. **Version Control**: Git integration for all code changes
7. **Documentation as Code**: Specs stored as events
8. **Multi-Model Support**: Provider-agnostic LLM interface

This specification represents the complete functional requirements for TENEX. The system enables AI-driven software development through a decentralized, context-first approach that fundamentally changes how software is created and maintained.