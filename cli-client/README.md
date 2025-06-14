# TENEX CLI Client

A command-line interface for communicating with TENEX projects via Nostr protocol.

## Features

- 🔐 **Authenticate** with your Nostr private key (NSEC)
- 🚀 **Create new projects** with multi-step wizard including agents and instructions
- 🎯 **Connect** to any TENEX project using PROJECT_NADDR
- 🧵 **Create threads** (kind:11 events) to start conversations
- 💬 **Reply to threads** (kind:1111 events) within conversations
- 🤖 **Mention agents** using @agent syntax to tag specific agents
- ⌨️ **Real-time typing indicators** to see when agents are processing
- 👂 **Listen for responses** and display agent messages in real-time
- 📋 **Session management** to track current state

## Installation

```bash
cd cli-client
bun install
```

## Usage

### Environment Setup

```bash
export NSEC=nsec1your_private_key_here...
export PROJECT_NADDR=naddr1project_address_here...  # Optional
```

### Start the CLI

```bash
bun run dev
# or
bun run src/index.ts
```

### Main Menu Options

When you start the CLI, you'll see:

1. **💬 Connect to existing project** - Connect to a project using its NADDR
2. **🚀 Create new project** - Create a new TENEX project with guided wizard
3. **🚪 Exit** - Quit the application

### Creating a New Project

The project creation wizard will guide you through:

1. **Project Details** - Name, description, hashtags, repository URL, and image
2. **Template Selection** (optional) - Choose from existing project templates
3. **Agent Selection** - Select AI agents from available NDKAgent events
4. **Instruction Selection** - Choose instruction sets and assign them to agents
5. **Confirmation** - Review and create the project

### Connecting to a Project

Once connected to a project, you can:

1. **📝 Start new thread** - Create a new conversation thread
2. **💬 Reply to current thread** - Send replies to the active thread
3. **📋 Show current session** - Display session information
4. **🚪 Exit** - Disconnect and quit

## Architecture

### Event Types

The client implements the same event patterns as the web-client:

- **Kind 31933 (PROJECT)**: Project creation events
  - `d` tag: Unique project identifier
  - `title` tag: Project name
  - `repo` tag: Git repository URL
  - `t` tags: Hashtags/topics
  - `agent` tags: Selected agent IDs
  - `rule` tags: Instruction sets with optional agent assignments
  - `template` tag: Reference to project template

- **Kind 11 (CHAT)**: Thread creation events
  - `title` tag: Thread title
  - `a` tag: Project reference (31933:pubkey:identifier)
  - `p` tags: Agent participants

- **Kind 1111 (THREAD_REPLY)**: Thread reply events
  - `e` tag: Reference to original thread
  - `a` tag: Project reference
  - `p` tags: Mentioned agents

- **Kind 24010 (PROJECT_STATUS)**: Agent discovery
  - Agents are discovered from p-tags in status events

- **Kind 24111/24112**: Typing indicators
  - Shows when agents are processing requests
  - Includes system and user prompts when available

- **Kind 4199 (AGENT)**: NDKAgent configuration events
  - Used for agent selection during project creation

- **Kind 1339 (INSTRUCTION)**: Instruction/rule events
  - Used for instruction selection during project creation

- **Kind 30717 (TEMPLATE)**: Project template events
  - Used for template selection during project creation

### Key Components

- **`TenexNDK`**: NDK connection and event publishing
- **`TenexChat`**: Thread and reply management
- **`TenexCLI`**: Interactive command-line interface
- **`ProjectCreator`**: Multi-step project creation wizard

### Agent Mentions

Use `@agent` syntax in your messages to mention specific agents:

```
Hey @code can you help me implement this feature?
@planner what do you think about this architecture?
```

The client automatically:
- Extracts mentioned agent names from content
- Resolves agent names to pubkeys
- Adds p-tags for mentioned agents
- Keeps @mentions in the message content

## Development

```bash
# Development mode with auto-reload
bun run dev

# Build for production
bun run build

# Run built version
bun run start

# Lint and format
bun run lint
bun run format
```

## Example Usage

```bash
# Set up environment
export NSEC=nsec1abc123...
export PROJECT_NADDR=naddr1def456...

# Start chat session
bun run dev

# Follow prompts to:
# 1. Connect to project
# 2. Discover agents
# 3. Create thread or reply
# 4. Listen for responses
```

The client will automatically discover available agents from the project and allow you to communicate with them using the same protocol as the web interface.