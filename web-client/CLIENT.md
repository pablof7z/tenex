# TENEX Web Client: Comprehensive Feature & Schema Documentation

## Overview

TENEX is a decentralized AI-assisted software development platform built on the Nostr protocol. The web client serves as the primary interface for users to interact with AI agents, manage projects, and collaborate on software development tasks. The system enables real-time communication between human users and specialized AI agents through a structured event-based architecture.

## Core Concepts

### 1. Projects
A **Project** is the central organizational unit in TENEX. Each project represents a discrete software development effort with its own directory, agents, tools, configurations, and conversation history.

**Key Properties:**
- **Title**: Human-readable project name
- **Description**: Detailed project description  
- **Repository URL**: Optional Git repository link
- **Picture**: Optional project avatar/image
- **Directory**: Local filesystem path where project files reside
- **Unique Identifier**: Nostr `d-tag` that uniquely identifies the project

**Associated Entities:**
- **Agents**: AI assistants assigned to help with the project
- **MCP Tools**: External tools available through Model Context Protocol
- **Instructions/Rules**: Guidelines that agents must follow
- **Templates**: Base configurations the project was created from

### 2. Agents
**Agents** are AI entities with specific roles and capabilities. Each agent has:
- **Public Key (pubkey)**: Unique Nostr identity
- **Name**: Human-readable identifier
- **Role**: What the agent specializes in (e.g., "Code Review", "Documentation")
- **Instructions**: Custom guidelines for behavior
- **Available Tools**: What actions the agent can perform
- **LLM Configuration**: Which AI model powers the agent

Agents can be:
- **Built-in**: Pre-configured agents provided by the system
- **Custom**: User-created agents with specific instructions
- **Discovered**: Agents found through the discovery system

### 3. Conversations & Threads
Conversations in TENEX follow a structured approach:

**Thread Types:**
- **Task Conversations**: Discussions centered around a specific task
- **Open Threads**: General project discussions not tied to a task

**Conversation Phases:**
1. **Chat**: Initial discussion and requirements gathering
2. **Plan**: Creating an implementation strategy
3. **Execute**: Carrying out the plan with code/actions
4. **Verify**: Testing and validation
5. **Chores**: Cleanup and maintenance tasks
6. **Reflection**: Learning and improvement

### 4. Tasks
Tasks represent discrete units of work within a project. Each task includes:
- **Title**: Brief description of what needs to be done
- **Content**: Detailed requirements and context
- **Complexity**: Numerical rating (1-10) of task difficulty
- **Status**: Current state (pending, progress, completed, failed)
- **Agent Assignment**: Which agent is responsible
- **Tool Requirements**: Specific tools needed (e.g., claude_code)

## Event Schema

TENEX uses Nostr events for all communication. Here are the key event kinds:

### Standard Nostr Events
- **Kind 0 (Metadata)**: User profile information
- **Kind 3 (Contact List)**: User's followed contacts

### Core TENEX Events

#### Kind 11 (Chat Message)
Primary conversation event for threads.
```json
{
  "kind": 11,
  "content": "Message content here",
  "tags": [
    ["title", "Thread Title"],
    ["a", "31933:pubkey:project-d-tag"],
    ["p", "participant-pubkey-1"],
    ["p", "participant-pubkey-2"]
  ]
}
```

#### Kind 1111 (Comment)
Comments on events following NIP-22 threading specification. Comments are plaintext-only threading notes that must be scoped to both a root event and parent item.
```json
{
  "kind": 1111,
  "content": "Plain text comment (no HTML/Markdown)",
  "tags": [
    // Root scope tags (uppercase)
    ["A", "31933:pubkey:project-d-tag"],  // Root addressable event
    ["K", "31933"],                        // Root event kind
    ["P", "root-author-pubkey"],           // Root author
    
    // Parent item tags (lowercase)
    ["e", "parent-event-id"],              // Parent event being replied to
    ["k", "1934"],                         // Parent event kind (e.g., task)
    ["p", "parent-author-pubkey"],         // Parent author
    
    // TENEX-specific tags
    ["status", "progress"],                // For task updates
    ["phase", "execute"],                  // Current conversation phase
    
    // Agent routing (CRITICAL)
    ["p", "agent-pubkey"]                  // Which agent(s) should handle this next
  ]
}
```

**Critical Implementation Notes:**
1. **Phase Tag**: Controls the conversation workflow state (chat → plan → execute → verify → chores → reflection). Agents use this to understand what type of response is expected.
2. **P-Tag Agent Routing**: The `p` tags determine which agents receive and process the message. This is the primary routing mechanism in TENEX.
   - **WARNING**: NDK automatically adds p-tags when constructing reply events. These MUST be removed to prevent accidentally routing messages to unintended recipients.
   - **Implementation**: Always clear existing p-tags and explicitly set only the agent pubkeys you want to handle the message.
   - **Multiple Agents**: Can include multiple p-tags to involve multiple agents in the conversation.
3. **Content Restriction**: Per NIP-22, content must be plaintext only (no HTML/Markdown).

#### Kind 1934 (Task)
Represents a unit of work.
```json
{
  "kind": 1934,
  "content": "Detailed task description",
  "tags": [
    ["title", "Task Title"],
    ["a", "31933:pubkey:project-d-tag"],
    ["complexity", "5"],
    ["agent", "agent-name"],
    ["tool", "claude_code"]
  ]
}
```

#### Kind 31933 (Project)
Defines a project (parameterized replaceable event).
```json
{
  "kind": 31933,
  "content": "Project description",
  "tags": [
    ["d", "unique-project-id"],
    ["title", "Project Name"],
    ["repo", "https://github.com/user/repo"],
    ["picture", "https://example.com/avatar.png"],
    ["agent", "agent-event-id", "agent-pubkey"],
    ["mcp", "mcp-tool-event-id"],
    ["rule", "instruction-event-id", "agent-pubkey-if-specific"],
    ["template", "template-event-id"]
  ]
}
```

#### Kind 4199 (Agent Configuration)
Defines an AI agent.
```json
{
  "kind": 4199,
  "content": "Agent description",
  "tags": [
    ["d", "agent-unique-id"],
    ["name", "Agent Name"],
    ["role", "Code Review Expert"],
    ["model", "claude-3-sonnet"],
    ["instruction", "Always follow best practices..."],
    ["tool", "read_file"],
    ["tool", "analyze"]
  ]
}
```

#### Kind 24010 (Project Status)
Real-time project status updates from the backend.
```json
{
  "kind": 24010,
  "content": "{}",
  "tags": [
    ["a", "31933:pubkey:project-d-tag"],
    ["agent", "agent-pubkey", "agent-name"],
    ["model", "claude-3-sonnet", "provider-name"],
    ["status", "online"]
  ]
}
```

#### Kind 24111/24112 (Typing Indicators)
Real-time typing status.
```json
{
  "kind": 24111,  // Start typing
  "content": "",
  "tags": [
    ["e", "thread-or-task-id"],
    ["agent", "agent-name"]  // Optional
  ]
}
```

### Discovery Events

#### Agent Discovery Response
Special render type for agent discovery results.
```json
{
  "kind": 1111,
  "content": "JSON stringified discovery data",
  "tags": [
    ["render-type", "agent_discovery"],
    ["discovery-query", "original search query"]
  ]
}
```

### Other Important Events
- **Kind 30023 (Article)**: Documentation articles
- **Kind 30717 (Template)**: Project templates
- **Kind 4133 (Agent Request)**: Request for agent assistance
- **Kind 4129 (Agent Lesson)**: Learning/improvement data for agents

## Features & Functionality

### 1. Authentication & User Management
- **Nostr Key-based Auth**: Users sign in with their Nostr private key (nsec)
- **Profile Management**: Display names, avatars, and profile metadata
- **Multi-device Support**: Sessions persist across devices

### 2. Project Management

#### Creation Flow
1. **Basic Details**: Name, description, repository URL
2. **Agent Selection**: Choose AI assistants for the project
3. **Tool Configuration**: Select MCP tools to enable
4. **Instruction Setup**: Add rules/guidelines for agents
5. **Template Selection**: Optionally base on existing template

#### Project Dashboard
- **Thread List**: All conversations in the project
- **Task Overview**: Pending, active, and completed tasks
- **Agent Status**: Which agents are online/available
- **Documentation**: Project-specific docs and articles
- **Settings**: Modify project configuration

### 3. Conversation Interface

#### Message Types
- **User Messages**: Direct input from humans
- **Agent Responses**: AI-generated replies
- **Task Cards**: Interactive task representations
- **Status Updates**: Progress indicators and phase changes
- **Tool Outputs**: Results from agent actions

#### Interactive Elements
- **@Mentions**: Tag specific agents in messages
- **Voice Input**: Speech-to-text for message composition
- **Code Blocks**: Syntax-highlighted code snippets
- **Markdown Support**: Rich text formatting
- **File References**: Link to project files

#### Threading & Replies
- **Nested Conversations**: Replies create sub-threads
- **Participant Tracking**: See who's involved in each thread
- **Typing Indicators**: Real-time status of who's typing
- **Unread Markers**: Track new messages

### 4. Task Management

#### Task Creation
- **From Conversation**: Convert messages into tasks
- **Direct Creation**: Standalone task definition
- **Complexity Assessment**: Rate difficulty (1-10)
- **Agent Assignment**: Designate responsible AI

#### Task Lifecycle
1. **Pending**: Awaiting agent availability
2. **In Progress**: Agent actively working
3. **Completed**: Successfully finished
4. **Failed**: Encountered blocking issues

#### Task Features
- **Progress Updates**: Real-time status changes
- **Conversation History**: Full context preserved
- **Abort Capability**: Cancel running tasks
- **Result Artifacts**: Code, documents, or other outputs

### 5. Agent Interaction

#### Agent Selection
- **Project Agents**: Pre-assigned to the project
- **Discovery**: Find new agents by capability
- **Custom Creation**: Define new agents with specific roles

#### Agent Capabilities
- **File Operations**: Read, write, analyze code
- **Shell Commands**: Execute system commands
- **Web Browsing**: Fetch online resources
- **Code Generation**: Create new implementations
- **Testing**: Run and validate code

### 6. Real-time Features

#### Live Updates
- **Message Streaming**: See responses as they're generated
- **Status Changes**: Instant project/agent status updates
- **Typing Indicators**: Know when someone is composing
- **Online Presence**: See which agents are available

#### Collaboration
- **Multi-participant Threads**: Humans and agents together
- **Shared Context**: All participants see same information
- **Persistent History**: Conversations saved locally

### 7. Settings & Configuration

#### Project Settings
- **Metadata**: Title, description, repository
- **Agent Management**: Add/remove/configure agents
- **Tool Selection**: Enable/disable MCP tools
- **Rule Definition**: Set project-specific guidelines

#### LLM Configuration
- **Model Selection**: Choose AI models per agent
- **Provider Settings**: Configure API endpoints
- **Temperature Control**: Adjust creativity/consistency
- **Token Limits**: Set response length constraints

### 8. Documentation System

#### Article Management
- **Creation**: Write project documentation
- **Organization**: Categorize by topic
- **Versioning**: Track document changes
- **Integration**: Reference in conversations

#### Knowledge Base
- **Agent Lessons**: Captured learnings
- **Best Practices**: Project-specific guidelines
- **Templates**: Reusable configurations

## User Flows

### 1. Getting Started
1. Login with Nostr key
2. Create or select a project
3. Configure agents and tools
4. Start first conversation

### 2. Typical Development Workflow
1. Open project dashboard
2. Create new thread or task
3. Describe requirements to agents
4. Review and guide implementation
5. Verify results
6. Document learnings

### 3. Collaborative Session
1. Multiple users join project
2. Start shared thread
3. Tag relevant agents
4. Discuss and iterate
5. Agents execute agreed plans

## Data Persistence

### Local Storage
- **Session Data**: Authentication tokens
- **Draft Messages**: Unsent message content
- **UI Preferences**: Theme, layout settings
- **Cache**: Recent events and profiles

### Backend Storage
- **Project Files**: Code and documents
- **Conversation History**: All events
- **Agent Context**: Optimized conversation state
- **Configuration**: Project and agent settings

### Nostr Network
- **Event History**: Permanent record of all interactions
- **Profile Data**: User and agent identities
- **Project Definitions**: Immutable project records
- **Discovery Data**: Searchable agent registry

## Key Interactions

### Message Composition
- Text input with @mention support
- Markdown formatting preview
- File attachment references
- Voice dictation option

### Agent Communication
- Natural language instructions
- Structured task definitions
- Tool invocation requests
- Feedback and corrections

### Status Monitoring
- Real-time progress bars
- Phase transition indicators
- Error and warning messages
- Completion notifications

## Security & Privacy

### Authentication
- Private key never leaves client
- Event signing happens locally
- No centralized auth server

### Data Protection
- End-to-end encryption option
- Local file access controls
- Permissioned agent actions

### Network Security
- WebSocket connections to relays
- Event validation and filtering
- Rate limiting protection

## Summary

The TENEX web client provides a comprehensive interface for AI-assisted software development through a decentralized, event-driven architecture. It enables seamless collaboration between humans and AI agents while maintaining user sovereignty through Nostr's cryptographic identity system. The modular design allows for extensibility while the structured conversation phases ensure productive development workflows.