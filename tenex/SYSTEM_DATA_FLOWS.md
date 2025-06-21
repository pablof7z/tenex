# TENEX System Data Flows

## Overview

This document details the key data flows within the TENEX system, showing how information moves between modules and how different types of data are processed, transformed, and persisted.

## 1. New Conversation Flow

### Flow Description
When a user creates a new conversation, the data flows through multiple stages of processing:

```
User Input → Nostr Event → Event Detection → Conversation Creation → Phase Routing → Agent Assignment → Response Generation → Publishing
```

### Detailed Data Flow

#### 1.1 User Input Processing
**Source**: User via Nostr client  
**Destination**: EventMonitor  
**Data Format**: 
```json
{
  "kind": 11,
  "content": "User's request text",
  "tags": [
    ["a", "kind:pubkey:identifier"],
    ["title", "Conversation Title"]
  ],
  "pubkey": "user_pubkey",
  "sig": "event_signature"
}
```

#### 1.2 Event Detection & Routing
**Source**: EventMonitor  
**Destination**: ConversationRouter  
**Processing**: 
- Extract project identifier from 'a' tag
- Validate event structure
- Check if project is already running

**Code Reference**: `src/daemon/EventMonitor.ts:51-98`

#### 1.3 Conversation Creation
**Source**: ConversationRouter  
**Destination**: ConversationManager  
**Data Transformation**:
```typescript
// Input: NDKEvent
// Output: ConversationState
{
  id: event.id,
  title: extractTitle(event),
  phase: "chat", // Always starts in chat
  history: [event],
  currentAgent: undefined,
  phaseStartedAt: Date.now(),
  metadata: {
    summary: event.content,
  }
}
```

**Code Reference**: `src/conversations/ConversationManager.ts:27-53`

#### 1.4 Phase Determination
**Source**: ConversationRouter  
**Destination**: RoutingLLM  
**Process**:
1. Analyze user intent from event content
2. Consider available agents
3. Apply business rules

**Data Flow**:
```typescript
// Input to RoutingLLM
{
  event: NDKEvent,
  availableAgents: Agent[],
  conversationHistory: []
}

// Output from RoutingLLM
{
  phase: "chat" | "plan" | "execute" | "review",
  reasoning: string,
  confidence?: number,
  nextAgent?: string
}
```

**Code Reference**: `src/routing/ConversationRouter.ts:35-79`

#### 1.5 Phase Initialization
**Source**: ConversationRouter  
**Destination**: PhaseInitializerFactory  
**Process**:
- Select appropriate phase initializer
- Execute phase-specific setup logic
- Prepare initial context

**Code Reference**: `src/phases/PhaseInitializerFactory.ts:27-34`

## 2. Agent Execution Flow

### Flow Description
How agents process conversation context and generate responses:

```
Agent Assignment → Context Preparation → Prompt Building → LLM Invocation → Response Processing → Tool Execution → Publishing
```

### Detailed Data Flow

#### 2.1 Context Preparation
**Source**: ConversationRouter  
**Destination**: AgentExecutor  
**Data Structure**:
```typescript
{
  agent: Agent,
  conversation: ConversationState,
  phase: Phase,
  lastUserMessage?: string,
  projectContext?: any
}
```

#### 2.2 Prompt Construction
**Source**: AgentExecutor  
**Destination**: PromptBuilder  
**Process**: Assemble prompt from fragments
- Agent identity and instructions
- Conversation history
- Phase-specific context
- Available tools
- Project information

**Fragment Assembly**:
```typescript
// Fragments loaded from different sources
{
  identity: "You are an AI assistant specialized in...",
  context: "Current conversation: ...",  
  tools: "Available tools: ...",
  instructions: "Your role is to...",
  format: "Respond in this format: ..."
}
```

**Code Reference**: `src/prompts/core/PromptBuilder.ts`

#### 2.3 LLM Invocation
**Source**: AgentExecutor  
**Destination**: LLMService  
**Request Format**:
```typescript
{
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ],
  model: agent.llmConfig,
  temperature: 0.7,
  max_tokens: 4000
}
```

**Response Format**:
```typescript
{
  content: "LLM response text",
  usage: {
    prompt_tokens: 1234,
    completion_tokens: 567,
    total_tokens: 1801
  },
  model: "gpt-4",
  cost_usd: 0.0234
}
```

#### 2.4 Tool Detection & Execution
**Source**: AgentExecutor  
**Destination**: ToolExecutionManager  
**Process**:
1. Parse LLM response for tool calls
2. Execute detected tools
3. Integrate tool results

**Tool Call Detection**:
```typescript
// Detected from LLM response
{
  toolCalls: [
    {
      name: "claude_code",
      parameters: {
        prompt: "Implementation request",
        phase: "plan"
      }
    }
  ]
}
```

**Code Reference**: `src/tools/execution/ToolDetector.ts`

## 3. Phase Transition Flow

### Flow Description
How conversations transition between phases:

```
Completion Check → Business Rules → Phase Validation → Context Preparation → State Update → Re-initialization
```

### Detailed Data Flow

#### 3.1 Transition Trigger
**Sources**: 
- User explicit request (phase tag in event)
- Agent completion signal
- Routing LLM decision

**Data**: 
```typescript
{
  conversationId: string,
  currentPhase: Phase,
  requestedPhase: Phase,
  trigger: "user" | "agent" | "automatic"
}
```

#### 3.2 Validation & Business Rules
**Source**: ConversationRouter  
**Process**: `routingDomainFunctions.ts`
- Check transition validity
- Apply business constraints (e.g., git branch locking for execute phase)
- Verify completion criteria

**Code Reference**: `src/routing/routingDomainFunctions.ts`

#### 3.3 Context Compaction
**Source**: ConversationManager  
**Process**: Extract relevant information for new phase
```typescript
// Chat → Plan transition
{
  context: "User Request:\n{userMessages}\n\nCreate detailed implementation plan",
  summary: extractedRequirements,
  metadata: previousPhaseResults
}
```

**Code Reference**: `src/conversations/ConversationManager.ts:142-166`

## 4. Tool Integration Flow

### 4.1 Claude Code Integration

**Flow**: `Phase Initialization → Process Spawn → Stream Processing → Event Publishing`

**Data Flow**:
```typescript
// Input to ClaudeCodeExecutor
{
  prompt: string,
  projectPath: string,
  projectContext: ProjectContext,
  conversationRootEvent: NDKEvent,
  phase: "plan" | "execute"
}

// Stream processing
{
  type: "assistant" | "tool_use" | "result",
  message: {
    content: [...],
    role: "assistant"
  },
  session_id: string
}

// Published events
{
  kind: 1,
  content: "🤖 Claude Code: {message}",
  tags: [
    ["claude-session-id", sessionId],
    ["claude-message-type", messageType],
    ["e", taskEventId]
  ]
}
```

**Code Reference**: `src/tools/ClaudeCodeExecutor.ts:40-305`

## 5. Persistence Flow

### 5.1 Conversation Persistence

**Trigger**: Every state change  
**Destination**: FileSystemAdapter  
**Process**:
1. Serialize conversation state
2. Write to `.tenex/conversations/{id}.json`
3. Update metadata index

**Data Format**:
```json
{
  "id": "conversation_id",
  "title": "Conversation Title",
  "phase": "current_phase",
  "history": [...], // NDKEvent array
  "metadata": {
    "summary": "...",
    "chat_summary": "...",
    "plan_summary": "..."
  },
  "createdAt": 1234567890,
  "updatedAt": 1234567890
}
```

### 5.2 Agent Registry Persistence

**Trigger**: Agent creation/modification  
**Destination**: `.tenex/agents.json`  
**Format**:
```json
{
  "agent-name": {
    "nsec": "nsec1...",
    "file": "agent-name.json",
    "pubkey": "agent_pubkey",
    "llmConfig": "deepseek"
  }
}
```

**Code Reference**: `src/agents/AgentRegistry.ts:184-187`

## 6. Configuration Data Flow

### 6.1 LLM Configuration Loading

**Source**: `llms.json`  
**Destination**: LLMService via ConfigManager  
**Format**:
```json
{
  "default": {
    "provider": "openai", 
    "model": "gpt-4",
    "apiKey": "${OPENAI_API_KEY}"
  },
  "deepseek": {
    "provider": "deepseek",
    "model": "deepseek-chat",
    "apiKey": "${DEEPSEEK_API_KEY}"
  }
}
```

### 6.2 Agent Configuration Loading

**Sources**: 
- Global: `~/.tenex/agents.json`
- Project: `.tenex/agents.json`

**Merge Strategy**: Project configs override global configs

**Code Reference**: `src/agents/AgentRegistry.ts:66-91`

## 7. Error Handling Data Flow

### 7.1 LLM Failure Recovery

**Flow**: `LLM Error → Retry Logic → Fallback → User Notification`

**Error Context Preservation**:
```typescript
{
  originalRequest: LLMRequest,
  error: Error,
  retryCount: number,
  fallbackUsed: boolean,
  conversationId: string
}
```

### 7.2 Tool Execution Errors

**Flow**: `Tool Error → Context Capture → Agent Notification → User Feedback`

**Error Information**:
```typescript
{
  toolName: string,
  parameters: any,
  error: string,
  stackTrace?: string,
  recoverySuggestions: string[]
}
```

## Data Flow Optimization Insights

### 1. **Streaming Integration**
- Claude Code results are streamed and published in real-time
- Reduces perceived latency for long-running operations
- Provides progress feedback to users

### 2. **Context Management**
- Conversation history is compacted during phase transitions
- Prevents context window overflow in LLM calls
- Maintains essential information while reducing noise

### 3. **Caching Strategy**
- Prompt fragments are cached after first load
- Agent configurations are cached in memory
- LLM responses include usage metadata for cost tracking

### 4. **Event Ordering**
- All events are timestamped for chronological processing
- Conversation history maintains strict ordering
- Phase transitions are atomic operations

### 5. **Failure Recovery**
- All state changes are persisted immediately
- System can recover from interruptions
- Error context is preserved for debugging

This data flow architecture ensures robust, scalable operation while maintaining data consistency and providing clear audit trails for all system operations.