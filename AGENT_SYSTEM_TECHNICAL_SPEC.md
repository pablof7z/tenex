# TENEX Agent System Technical Specification

## Overview

The TENEX Agent System is a Nostr-native, event-driven architecture for orchestrating multiple AI agents that collaborate on software development projects. The system enables agents with distinct identities, capabilities, and contexts to work together on conversations and tasks while maintaining project coherence through proper event tagging and relationships.

## Core Concepts

### Projects (kind 31933)

Every agent operates within the context of a project. Projects are NDKArticle events that establish:

- **d tag**: Unique project identifier used for all event tagging
- **title tag**: Human-readable project name
- **repo tag**: Git repository URL
- **agent tags**: List of agent IDs that can participate in the project
- **content**: Project description and documentation

All events produced by agents MUST include an "a" tag referencing the project: `["a", "31933:${projectPubkey}:${projectDTag}"]`

### Agents (kind 4199)

Agents are AI entities with distinct Nostr identities (nsec/npub pairs). Agent configurations are immutable NDKAgent events that define reusable agent personalities and capabilities:

- **title tag**: Agent name/identifier
- **description tag**: One-line description of agent purpose
- **role tag**: Agent's expertise and personality
- **instructions tag**: Detailed operational guidelines
- **version tag**: Configuration version number

Note: Agent definitions (kind 4199) are NOT project-specific. They define reusable agent templates that can be used across multiple projects.

#### Agent Usage in Projects

1. **Agent Selection**: Projects reference agent definitions by including their event IDs in the project's "agent" tags
2. **Local Instantiation**: When a project is initialized, the system:
   - Fetches referenced NDKAgent events (kind 4199) from Nostr
   - Caches them locally in `$project/.tenex/agents/<event-id>.json`
   - Creates project-specific agent instances with unique nsec/npub pairs
3. **Identity Creation**: Each project-specific agent instance has its own nsec/npub pair
4. **Profile Publication**: Agent instances MAY publish kind 0 (metadata) events with:
   - name: Agent identifier
   - about: Agent description from the NDKAgent definition
   - picture: Optional avatar

#### Agent Ownership Claims

Agent definitions (kind 4199) can publish ownership requests:
- **p tag**: References the human user who created/operates the project
- **Purpose**: Allows users to claim ownership of agent definitions
- **Trust**: Enables others to trust lessons and outputs from claimed agents
- **Note**: This is NOT a registration into projects - it's a trust mechanism for agent authorship

#### Agent Requests (kind 3199)

Agent instances publish ownership claim requests:
- **p tag**: MUST reference the pubkey that published the NDKProject event (project owner)
- **a tag**: MUST reference the project
- **content**: Request for the human to claim ownership/operation of this agent instance
- **Purpose**: Establish trust relationship between agent instance and project owner
- **Note**: This is an ownership claim request, NOT a request for help or assistance

### Living Documentation (kind 30023)

Project specifications and documentation are stored as replaceable NDKArticle events:

- **d tag**: Document identifier (e.g., "SPEC", "ARCHITECTURE")
- **title tag**: Document title
- **summary tag**: Description of latest changes
- **published_at tag**: Unix timestamp
- **a tag**: Project reference
- **content**: Full markdown documentation

Agents can read and update these documents to maintain current project state.

## Event Types and Flows

### Communication Events (kind 11/1111)

Messages between users and agents:

- **kind 11**: Root messages (conversations, comments, etc.)
- **kind 1111**: Generic replies (NIP-22) to any event type
  - **e tags**: Event relationships (root/reply) - automatically handled by NDK's .reply()
  - Can reply to: tasks (1934), threads (11), or any other event
- **p tags**: Participant mentions (summons specific agents)
- **a tag**: REQUIRED project reference

Note: All replies MUST use NDK's .reply() method which automatically handles proper tagging. Do NOT manually set kinds or add K tags. Only add the project tag via event.tag(projectEvent).

#### Context Management

Each conversation thread or task discussion maintains an independent context window containing:
- Complete message history for that specific context
- Participant list and their roles
- Context-specific state and metadata
- Optimized context for LLM token limits

### Task Events (kind 1934)

Structured work items for agents:

- **title tag**: Task title
- **content**: Detailed task description
- **a tag**: REQUIRED project reference

Note: Task events are immutable and don't have status or assignment tags. The default agent determines how to handle incoming tasks and may delegate or coordinate with other agents as needed.

#### Task Context Management

Each task maintains an independent context window containing:
- Task requirements and constraints
- Task-specific conversation history
- Progress updates and state changes
- Related code changes and artifacts

### Agent Communication Events

#### Typing Indicators (kind 24111/24112)

Real-time status during agent processing:

- **kind 24111**: Started processing
  - **e tag**: Thread or task being processed
  - **system-prompt tag**: LLM system prompt
  - **prompt tag**: User prompt being processed
  - **a tag**: Project reference

- **kind 24112**: Stopped processing
  - **e tag**: Thread or task reference
  - **content**: Optional status message
  - **a tag**: Project reference

#### Agent Lessons (kind 4124)

Knowledge persistence when agents learn from mistakes:

- **e tag**: References the NDKAgent definition event ID (kind 4199)
- **title tag**: Lesson summary
- **content**: Detailed lesson learned
- **a tag**: Project reference

Note: Lessons reference the agent definition (kind 4199) so they can be shared across projects using the same agent template.

### Project Status (kind 24010)

Heartbeat events published every 60 seconds by active agents:

- **content**: JSON object with status, timestamp, project title
- **a tag**: Project reference

## LLM Integration

### Message Construction

Agents construct LLM messages with:

1. **System Prompt**: 
   - Agent role and instructions
   - Project context and specifications
   - Available tools and their descriptions
   - Other agents in the system

2. **Context Messages**:
   - Relevant conversation/task history
   - Recent agent interactions
   - Project documentation excerpts
   - Learned lessons from past mistakes

3. **User Message**:
   - Current request or task
   - Referenced entities and context

### Tool Calling Protocol

Agents can execute tools through standardized protocols:

1. **Tool Discovery**: Each agent has a tool registry with available tools
2. **Tool Invocation**: LLM responses include structured tool calls
3. **Tool Execution**: System executes tools with proper sandboxing
4. **Result Integration**: Tool results are integrated into agent responses

Tool categories include:
- File system operations (read, write, edit)
- Code analysis and manipulation
- Project specification management
- Git operations
- Web fetching and searching
- Memory and learning operations

### Token Management

The system implements intelligent token optimization:

1. **Context Window Limits**: Each LLM has defined context window size
2. **Message Truncation**: Automatic removal of older messages when approaching limits
3. **Conversation Summarization**: Periodic summarization of long conversations
4. **Cost Tracking**: Token usage and costs tracked in event metadata

## Multi-Agent Orchestration

### Agent Selection

Agents are selected for participation based on:

1. **Explicit Mentions**: P-tags in events summon specific agents
2. **Task Assignment**: Tasks can be assigned to specific agents
3. **Capability Matching**: Agents with relevant expertise auto-selected
4. **Anti-Chatter Logic**: Prevents unnecessary agent-to-agent communication

### Coordination Patterns

1. **Sequential Processing**: Agents take turns responding to maintain coherence
2. **Parallel Execution**: Multiple agents can work on different tasks simultaneously
3. **Collaborative Problem-Solving**: Agents can reference each other's work
4. **Knowledge Sharing**: Agents access shared project documentation and lessons

### Event Publishing Rules

All agent-published events MUST:

1. Include project "a" tag
2. Reference appropriate parent events (e tags)
3. Include agent identity (signed with agent nsec)
4. Follow kind-specific tag requirements
5. Include comprehensive LLM metadata tags:
   - **system-prompt**: Full system prompt used
   - **user-prompt**: User prompt/message processed
   - **model**: LLM model identifier
   - **tokens-in**: Input token count
   - **tokens-out**: Output token count
   - **cost**: Total cost in USD (if available)
   - **provider**: LLM provider name
   - **temperature**: Temperature setting used
   - **max-tokens**: Max tokens limit set

For replies: MUST use NDK's .reply() method and only add the project tag manually.

## System Initialization

### Project Bootstrap

1. Load project event (kind 31933) from Nostr
2. Initialize project working directory with `.tenex/` structure
3. Fetch all referenced agent configurations (kind 4199) from project's "agent" tags
4. Cache agent definitions in `.tenex/agents/<event-id>.json`
5. Create project-specific agent instances with unique identities in `.tenex/agents.json`
6. Load project specifications (kind 30023)
7. Establish event subscriptions

### Agent Initialization

For each agent in the project:

1. Load agent configuration from cached NDKAgent event in `.tenex/agents/<event-id>.json`
2. Initialize agent identity using project-specific nsec/npub from `.tenex/agents.json`
3. Configure LLM provider and model from project's `llms.json`
4. Load agent-specific tool registry based on agent role
5. Restore conversation history if available
6. Subscribe to relevant event kinds

### Subscription Management

The system maintains real-time subscriptions to:

1. **Project Events**: Updates to project configuration
2. **Specification Events**: Changes to project documentation
3. **Thread Events**: New conversations and replies
4. **Task Events**: New tasks and status updates
5. **Agent Communications**: Typing indicators and lessons

Note: Agent configuration events (kind 4199) are immutable and don't require subscriptions.

## Event Processing Flow

### Incoming Event Handling

1. **Validation**: Verify project tag and event signature
2. **Deduplication**: Check if event was already processed
3. **Routing**: Route to appropriate processor by kind
4. **Context Creation**: Build or retrieve relevant context
5. **Agent Selection**: Determine which agents should respond
6. **Processing**: Generate responses via LLM
7. **Publishing**: Publish response events with proper tags

### Context Isolation

Each conversation thread and task maintains completely isolated context:

- No cross-contamination between threads
- Independent token optimization per context
- Separate conversation history
- Thread-specific participant tracking

## Security and Validation

### Event Validation

All events must be:
1. Tagged with valid project reference
2. Structured according to kind specifications
3. Within acceptable time windows (not future-dated)

Note: Event signatures are automatically validated by NDK - do NOT manually verify signatures.

### Agent Authorization

Agents can only:
1. Publish events for projects they're registered to
2. Update specifications if granted permission
3. Access conversations they're participating in
4. Execute tools within their registry

## Performance Considerations

### Caching Strategies

1. **LLM Prompt Caching**: Reuse common prompt prefixes
2. **Event Caching**: Local storage of frequently accessed events  
3. **Context Caching**: Optimize context window construction
4. **Tool Result Caching**: Cache deterministic tool outputs

### Scalability Patterns

1. **Horizontal Scaling**: Multiple agents work in parallel
2. **Context Pruning**: Automatic removal of old context
3. **Event Batching**: Batch related events for efficiency
4. **Lazy Loading**: Load agent configurations on demand

## Error Handling

### Failure Modes

1. **LLM Failures**: Retry with exponential backoff
2. **Tool Failures**: Graceful degradation with error messages
3. **Event Publishing Failures**: Queue and retry
4. **Context Overflow**: Automatic truncation with warning

### Recovery Mechanisms

1. **Conversation Recovery**: Restore from persistent storage
2. **Task Resumption**: Continue from last known state
3. **Agent Restart**: Reinitialize from configuration
4. **Project Resync**: Rebuild state from Nostr events