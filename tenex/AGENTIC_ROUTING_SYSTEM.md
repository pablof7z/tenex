# TENEX Agentic Routing System

## Overview

The TENEX Agentic Routing System is a sophisticated conversation management framework that monitors Nostr events, routes conversations through different phases, and coordinates multiple AI agents to handle complex tasks.

## Architecture

### Core Components

1. **LLM Service** (`src/core/llm/`)
   - Integrates with multiple LLM providers via multi-llm-ts
   - Manages configurations and credentials
   - Tracks token usage and costs
   - Provides streaming and completion APIs

2. **Agent Registry** (`src/agents/`)
   - Manages agent definitions and nsec keys
   - Stores agents in `.tenex/agents.json`
   - Supports dynamic agent creation
   - Each agent has: name, role, expertise, tools, llmConfig

3. **Conversation Manager** (`src/conversations/`)
   - Tracks conversation state and history
   - Manages phase transitions
   - Compacts history between phases
   - Stores metadata for each phase

4. **Routing System** (`src/routing/`)
   - LLM-based routing decisions
   - Routes new conversations to appropriate phase
   - Handles in-phase routing and agent selection
   - Manages phase transitions

5. **Phase Initializers** (`src/phases/`)
   - Automatic actions when entering phases
   - Chat: Project responds directly
   - Plan: Triggers Claude Code CLI for planning
   - Execute: Creates git branch, triggers Claude Code
   - Review: Assigns review agents

6. **Nostr Publisher** (`src/nostr/`)
   - Publishes agent responses with proper signing
   - Manages p-tags for routing
   - Includes LLM metadata in events
   - Handles phase transition events

## Conversation Phases

### 1. Chat Phase
- Initial requirements gathering
- Project responds using project nsec
- Clarifies user needs
- No specific agent assigned

### 2. Plan Phase
- Creates detailed implementation plan
- Triggers Claude Code CLI automatically
- Assigns planning/architect agent
- Compacts chat history for context

### 3. Execute Phase
- Implements the plan
- Creates new git branch
- Triggers Claude Code CLI for coding
- Assigns developer agent

### 4. Review Phase
- Expert review of implementation
- Multiple reviewers can be assigned
- Provides feedback and suggestions
- Can loop back to execute for fixes

## Event Flow

1. **New Conversation (kind:11)**
   ```
   User → Nostr Event → Event Handler → Conversation Router
           ↓
   Routing LLM decides phase
           ↓
   Phase Initializer runs
           ↓
   Response published via Nostr
   ```

2. **Replies within Conversation**
   ```
   Reply Event → Find Conversation → Add to History
        ↓
   Check for phase transition request
        ↓
   Route within phase or transition
        ↓
   Update current agent
   ```

## Testing

### Unit Tests
```bash
# Test conversation system components
./dist/cli.js test conversation

# Test phase initializers
./dist/cli.js test phases

# Full integration test
./dist/cli.js test integration
```

### Test Scripts
- `test-conversation-system.ts` - Tests core components
- `test-phase-initializers.ts` - Tests phase initialization
- `test-integration.ts` - Full system integration test

## Configuration

### LLM Configuration (`llms.json`)
```json
{
  "configurations": {
    "default": {
      "provider": "openrouter",
      "model": "meta-llama/llama-3.2-3b-instruct",
      "temperature": 0.7,
      "maxTokens": 2000
    }
  },
  "defaults": {
    "default": "default"
  },
  "credentials": {
    "openrouter": {
      "apiKey": "sk-or-v1-...",
      "baseUrl": "https://openrouter.ai/api/v1"
    }
  }
}
```

### Agent Configuration (`.tenex/agents.json`)
```json
{
  "agents": [
    {
      "id": "uuid",
      "name": "System Architect",
      "role": "Software Architect",
      "expertise": "System design and planning",
      "instructions": "Design scalable systems",
      "nsec": "nsec1...",
      "pubkey": "hex pubkey",
      "tools": ["claude_code"],
      "llmConfig": "default"
    }
  ]
}
```

## Nostr Event Structure

### Conversation Event (kind:11)
```json
{
  "kind": 11,
  "content": "User's request",
  "tags": [
    ["title", "Conversation Title"],
    ["a", "35523:projectPubkey:projectName"]
  ]
}
```

### Agent Response
```json
{
  "kind": 1,
  "content": "Agent's response",
  "tags": [
    ["e", "conversationId", "", "root"],
    ["p", "nextResponderPubkey"],
    ["a", "35523:projectPubkey:projectName"],
    ["llm-model", "gpt-4"],
    ["llm-cost-usd", "0.05"],
    ["llm-total-tokens", "1500"],
    ["phase", "plan"]
  ]
}
```

## Implementation Status

### ✅ Completed
- LLM Service with multi-provider support
- Agent Registry with nsec management
- Conversation Manager with state tracking
- Routing LLM with JSON parsing
- Nostr Publisher with proper signing
- Phase Initializers for all phases
- Integration with project context
- Comprehensive test infrastructure
- **EventHandler integration** - Routing system now connected to main event loop
- **Agent Execution System** - Agents can now generate responses and perform work

### 🚧 In Progress
- Real Nostr relay connection
- Tool execution within agent responses
- Conversation persistence
- Context summarization

### 📋 Planned
- Web dashboard for monitoring
- Advanced routing strategies
- Multi-agent collaboration
- Feedback loop optimization

## Usage

1. **Initialize Project**
   ```bash
   tenex project init
   ```

2. **Configure LLMs**
   Create `llms.json` with your API keys

3. **Start Daemon**
   ```bash
   tenex daemon start
   ```

4. **Run Project**
   ```bash
   tenex project run
   ```

The system will now monitor for kind:11 events and automatically route conversations through the phases.

## Debugging

Enable debug logging:
```bash
export LOG_LEVEL=debug
tenex project run
```

Check logs:
```bash
tail -f ~/.tenex/logs/tenex.log
```

Test specific components:
```bash
# Test routing
tenex test conversation -m "Your message"

# Test phases
tenex test phases

# Full integration
tenex test integration
```