# Agent System Technical Specification

## Overview

The TENEX Agent System is a sophisticated multi-agent orchestration platform that enables AI agents to collaborate on software development tasks. The system manages agent lifecycles, coordinates team formation, maintains conversation context, and handles complex multi-turn interactions through a clean domain-driven architecture.

## Architecture

The Agent System follows a layered architecture:

```
┌─────────────────────────────────────────────────┐
│           Application Layer                      │
│  EventRouter, TeamOrchestrator                  │
├─────────────────────────────────────────────────┤
│             Domain Layer                         │
│  Agent, Team, TeamLead, TurnManager            │
├─────────────────────────────────────────────────┤
│         Infrastructure Layer                     │
│  ConversationStore, LLMProviderAdapter,        │
│  NostrPublisher                                 │
├─────────────────────────────────────────────────┤
│              Core Layer                          │
│  Types, Interfaces, Errors                      │
└─────────────────────────────────────────────────┘
```

## Core Components

### 1. EventRouter (`application/EventRouter.ts`)

The EventRouter is the main entry point for all incoming events. It:

- **Routes events to appropriate teams**: Maintains a mapping of conversation IDs to TeamLead instances
- **Forms new teams**: When no existing team exists for a conversation, delegates to TeamOrchestrator
- **Manages team lifecycle**: Creates and recreates TeamLead instances as needed
- **Extracts conversation context**: Determines conversation ID from event tags

**Key Methods:**
- `handleEvent(event: NDKEvent)`: Main routing method
- `createTeamLead(team: Team)`: Creates a new TeamLead with all team agents
- `recreateTeamLead(team: ITeam)`: Recreates TeamLead from stored team data

### 2. Team (`domain/Team.ts`)

The Team domain entity represents a group of agents working together on a conversation.

**Properties:**
- `id`: Unique team identifier
- `conversationId`: The conversation this team handles
- `lead`: Name of the lead agent
- `members`: Array of all team member names (including lead)
- `plan`: The conversation plan/strategy
- `createdAt`: Team formation timestamp

**Key Features:**
- Immutable after creation
- Lead agent is always included in members
- Supports serialization for persistence

### 3. TeamLead (`domain/TeamLead.ts`)

TeamLead extends Agent with additional orchestration capabilities:

**Responsibilities:**
- **Turn management**: Decides which agent responds to each message
- **Context sharing**: Ensures all agents have necessary context
- **Response coordination**: Manages the flow of multi-agent conversations
- **Anti-chatter logic**: Prevents unnecessary agent-to-agent messages

**Key Methods:**
- `handleEvent(event, context)`: Processes incoming events
- `determineTurn(event, conversation)`: Decides which agent should respond
- `setTeamAgents(agents)`: Sets the team members this lead coordinates

**Turn Determination Logic:**
1. If user mentions specific agent with @, that agent responds
2. If conversation history suggests a specific agent should continue, they respond
3. If task requires specific expertise, appropriate agent is selected
4. Default to lead agent for general queries

### 4. Agent (`domain/Agent.ts`)

The base Agent class handles individual agent behavior:

**Core Functionality:**
- **Message generation**: Uses LLM to generate responses
- **Tool execution**: Processes tool calls from LLM responses
- **Context management**: Maintains conversation context
- **Event publishing**: Publishes responses as Nostr events

**Key Methods:**
- `generateResponse(conversation, context)`: Creates agent response
- `publishResponse(content, conversation, event)`: Publishes to Nostr
- `initialize()`: Sets up agent with any initialization logic

**Response Flow:**
1. Receive conversation history and context
2. Build system prompt with agent identity and project context
3. Generate response using LLM
4. Parse and execute any tool calls
5. Format and publish response

### 5. TurnManager (`domain/TurnManager.ts`)

Manages the turn-taking logic in multi-agent conversations:

**Features:**
- **Pattern analysis**: Examines conversation patterns to determine next speaker
- **Mention detection**: Handles @ mentions for explicit agent selection
- **Expertise matching**: Matches conversation needs to agent capabilities
- **Default handling**: Falls back to lead agent when unclear

### 6. ConversationStore (`infrastructure/ConversationStore.ts`)

Provides persistent storage for conversations and teams:

**Capabilities:**
- **Conversation persistence**: Stores messages with 30-day retention
- **Team storage**: Persists team formations
- **Token optimization**: Automatically optimizes stored conversations
- **Thread safety**: Ensures consistent state across concurrent operations

**Storage Structure:**
```
.tenex/conversations/
├── {conversationId}/
│   ├── messages.json     # Conversation messages
│   ├── metadata.json     # Conversation metadata
│   └── optimized.json    # Token-optimized version
└── teams.json           # All team formations
```

## Team Formation Process

1. **Event Received**: EventRouter receives a new event
2. **Team Check**: Checks if existing team handles this conversation
3. **Team Formation** (if no existing team):
   - TeamOrchestrator analyzes the event and available agents
   - Selects appropriate lead agent based on task requirements
   - Determines team members needed for the task
   - Creates conversation plan
4. **Team Creation**: Team entity created and persisted
5. **Agent Initialization**: All team agents are initialized with tools
6. **Event Handling**: TeamLead begins processing the event

## Conversation Flow

1. **User Message**: User sends a message (kind 11/1111 event)
2. **Router Processing**: EventRouter extracts conversation ID and context
3. **Team Handling**: Existing or new team receives the event
4. **Turn Decision**: TeamLead uses TurnManager to decide responder
5. **Response Generation**: Selected agent generates response
6. **Tool Execution**: Any tool calls are executed
7. **Response Publishing**: Response published as Nostr event
8. **State Updates**: Conversation and team state updated

## Tool Integration

Each agent can have a specific set of tools:

- **Tool Registry**: Each agent gets its own tool registry instance
- **Agent-specific tools**: 
  - `remember_lesson`: Enabled if agent has eventId
  - `find_agent`: Enabled for orchestrator agents
  - `update_spec`: Only for default agent
- **Tool execution**: Handled during response generation
- **Error handling**: Failed tool calls are reported in response

## Error Handling

The system includes comprehensive error handling:

- **AgentNotFoundError**: When requested agent doesn't exist
- **ConversationNotFoundError**: When conversation can't be loaded
- **TeamFormationError**: When team formation fails
- **ToolExecutionError**: When tool calls fail

All errors are logged and gracefully handled to prevent system crashes.

## Performance Considerations

1. **Team Caching**: TeamLead instances are cached in memory
2. **Conversation Optimization**: Old conversations are token-optimized
3. **Lazy Loading**: Agents are only initialized when needed
4. **Concurrent Processing**: Multiple conversations handled in parallel

## Extension Points

The system is designed for extensibility:

1. **Custom Agents**: Add new agent types by extending Agent class
2. **Turn Strategies**: Implement custom turn-taking logic
3. **Tool Integration**: Register new tools through ToolRegistry
4. **Storage Backends**: ConversationStore interface allows different implementations
5. **Team Formation**: Customize team formation logic in TeamOrchestrator

## Best Practices

1. **Agent Design**:
   - Keep agents focused on specific expertise
   - Provide clear role and instruction definitions
   - Enable only necessary tools for each agent

2. **Team Formation**:
   - Prefer smaller, focused teams over large ones
   - Select lead agents based on primary task requirements
   - Include specialists only when needed

3. **Conversation Management**:
   - Use conversation IDs consistently
   - Implement proper cleanup for old conversations
   - Monitor token usage and optimize when needed

4. **Error Handling**:
   - Always handle agent initialization failures
   - Provide fallback behavior for tool failures
   - Log errors with appropriate context

## Common Patterns

### Single Agent Response
```typescript
// When only one agent is needed
const team = Team.create(conversationId, "default", ["default"], "Single agent task");
```

### Multi-Agent Collaboration
```typescript
// For complex tasks requiring multiple experts
const team = Team.create(
    conversationId, 
    "planner",
    ["planner", "code", "debug"],
    "Multi-phase implementation with planning, coding, and testing"
);
```

### Agent Summoning via P-tags
```typescript
// TeamLead detects p-tags and ensures mentioned agents participate
if (event.tags.some(tag => tag[0] === "p")) {
    // Add mentioned agents to active participants
}
```

This specification provides a comprehensive understanding of the TENEX Agent System architecture, enabling developers and AI agents to effectively work with and extend the system.