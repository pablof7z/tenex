# TENEX Logging Guide

## Overview

The TENEX system has comprehensive logging throughout all components using the `@tenex/shared/logger` module and structured event IDs for distributed tracing.

## Structured Event IDs for Distributed Tracing

The TENEX system uses structured event IDs to enable tracing of requests across all distributed components. Every log entry includes contextual IDs that allow you to follow a single conversation or request through the entire system.

### Core Event IDs

1. **conversationId** - The Nostr event ID of the conversation being processed
2. **executionId** - Unique ID for each execution/request (format: `prefix_timestamp_random`)
3. **agentExecutionId** - ID for tracking a specific agent's execution
4. **parentExecutionId** - Links nested operations to their parent
5. **rootExecutionId** - The original execution that started the chain

### Specialized Event IDs

- **phaseExecutionId** - Tracks execution within a specific phase (chat, plan, etc.)
- **toolExecutionId** - Tracks individual tool executions
- **routingDecisionId** - Tracks routing decisions made by the system

### Event ID Format

All event IDs follow the pattern: `prefix_timestamp_random`
- **prefix**: Describes the type (e.g., `exec`, `agent_name`, `tool_name`, `phase_name`)
- **timestamp**: Base-36 encoded timestamp
- **random**: 8-byte hex random value

Example: `agent_assistant_lz5k8w9_a1b2c3d4e5f6g7h8`

### Using Tracing Context

```typescript
import { createTracingContext, createTracingLogger } from "@/tracing";

// Create initial context for a conversation
const tracingContext = createTracingContext(conversationId);
const logger = createTracingLogger(tracingContext, "conversation");

// Log with automatic context
logger.startOperation("processing message");
logger.info("Message processed", { messageType: "user" });
logger.completeOperation("processing message");

// Create child context for nested operations
const agentContext = createAgentExecutionContext(tracingContext, "assistant");
const agentLogger = createTracingLogger(agentContext, "agent");
agentLogger.info("Agent starting execution");
```

## Log Levels

1. **debug** - Detailed information for debugging
2. **info** - General informational messages
3. **warn** - Warning messages
4. **error** - Error messages

## Setting Log Level

```bash
# Via environment variable
LOG_LEVEL=debug tenex project run

# In code
process.env.LOG_LEVEL = 'debug';
```

## Component Logging

### 1. **LLM Service** (`src/llm/LLMService.ts`)
- Logs all LLM requests with model, duration, token counts
- Logs errors with full context
- Example:
  ```
  [INFO] LLM completion successful { configName: 'default', model: 'deepseek/deepseek-chat', duration: 1234, promptTokens: 150, completionTokens: 200 }
  ```

### 2. **Agent Registry** (`src/agents/AgentRegistry.ts`)
- Logs agent creation and loading
- Logs registry operations
- Example:
  ```
  [INFO] Created new agent "test-assistant" with nsec
  [INFO] Loaded agent registry with 3 agents
  ```

### 3. **Routing LLM** (`src/routing/RoutingLLM.ts`)
- Logs routing decisions with confidence scores
- Logs phase transitions
- Logs fallback routing attempts
- Example:
  ```
  [INFO] Routed new conversation { phase: 'chat', confidence: 0.85 }
  [WARN] Failed to parse routing decision, using fallback
  ```

### 4. **Conversation Manager** (`src/conversations/ConversationManager.ts`)
- Logs conversation creation
- Logs phase transitions
- Example:
  ```
  [INFO] Created new conversation: Building a Todo App { id: 'abc123...' }
  [INFO] Conversation abc123 transitioned from chat to plan
  ```

### 5. **Event Handler** (`src/commands/run/EventHandler.ts`)
- Visual event logs with emojis
- Detailed event information
- Example:
  ```
  📥 Event received: abc123...
  [10:23:45] New Conversation received
  From:    npub1abc...
  🗣️  New conversation started: Building a Todo App
  ```

### 6. **Nostr Publisher** (`src/nostr/ConversationPublisher.ts`)
- Logs all published events
- Logs metadata tags
- Example:
  ```
  [INFO] Published agent response { id: 'def456', nextAgent: 'npub1xyz...', hasLLMMetadata: true }
  [INFO] Published phase transition { id: 'ghi789', from: 'chat', to: 'plan' }
  ```

## Testing with Enhanced Logging

### 1. Run the test script:
```bash
bun test-conversation-system.ts
```

### 2. Enable debug logging:
```bash
LOG_LEVEL=debug bun test-conversation-system.ts
```

### 3. Watch logs in real-time:
```bash
# In one terminal
tenex project run

# In another terminal
tail -f ~/.tenex/logs/tenex.log
```

## Debugging Tips

### 1. **Trace LLM Calls**
Set `LOG_LEVEL=debug` to see:
- Full prompts sent to LLMs
- Raw responses
- Token usage and costs

### 2. **Track Event Flow**
Look for these patterns:
```
📥 Event received: [event-id]
→ Routing decision
→ Phase initialization
→ Agent response
→ Published event
```

### 3. **Monitor Agent Activity**
```bash
# Filter logs for specific agent
grep "agent-name" ~/.tenex/logs/tenex.log
```

### 4. **Check Conversation State**
The ConversationManager logs all state changes:
- Phase transitions
- Agent handoffs
- Metadata updates

## Common Log Patterns

### Successful Conversation Start with Tracing:
```
[INFO] Created new conversation: [title] { 
  conversationId: 'abc123...',
  executionId: 'exec_lz5k8w9_a1b2c3d4',
  rootExecutionId: 'exec_lz5k8w9_a1b2c3d4'
}
[DEBUG] LLM completion request { 
  conversationId: 'abc123...',
  executionId: 'exec_lz5k8wa_b2c3d4e5',
  parentExecutionId: 'exec_lz5k8w9_a1b2c3d4',
  configName: 'default',
  model: '...'
}
[INFO] Routed new conversation { 
  conversationId: 'abc123...',
  executionId: 'exec_lz5k8wb_c3d4e5f6',
  routingDecisionId: 'routing_lz5k8wb_c3d4e5f6',
  phase: 'chat',
  confidence: 0.9
}
[INFO] Published project response { 
  conversationId: 'abc123...',
  executionId: 'exec_lz5k8wc_d4e5f6g7',
  eventId: 'def456...'
}
```

### Agent Handoff with Tracing:
```
[INFO] Conversation abc123 transitioned from chat to plan {
  conversationId: 'abc123...',
  executionId: 'exec_lz5k8wd_e5f6g7h8',
  phaseExecutionId: 'phase_plan_lz5k8wd_e5f6g7h8',
  event: 'state_transition',
  fromState: 'chat',
  toState: 'plan'
}
[DEBUG] Selecting agent for phase: plan {
  conversationId: 'abc123...',
  executionId: 'exec_lz5k8we_f6g7h8i9',
  phase: 'plan'
}
[INFO] Published agent response { 
  conversationId: 'abc123...',
  executionId: 'exec_lz5k8wf_g7h8i9j0',
  agentExecutionId: 'agent_planner_lz5k8wf_g7h8i9j0',
  nextAgent: '[expert-pubkey]',
  event: 'event_published'
}
```

### Error Handling with Tracing:
```
[ERROR] LLM completion failed { 
  conversationId: 'abc123...',
  executionId: 'exec_lz5k8wg_h8i9j0k1',
  error: '...',
  configName: '...',
  model: '...',
  event: 'operation_failed',
  duration: 5234
}
[WARN] Failed to parse routing decision, using fallback {
  conversationId: 'abc123...',
  executionId: 'exec_lz5k8wh_i9j0k1l2',
  routingDecisionId: 'routing_lz5k8wh_i9j0k1l2'
}
[INFO] Fallback routing succeeded { 
  conversationId: 'abc123...',
  executionId: 'exec_lz5k8wi_j0k1l2m3',
  phase: 'chat',
  event: 'operation_complete'
}
```

### Tool Execution Tracing:
```
[INFO] Starting tool execution {
  conversationId: 'abc123...',
  executionId: 'exec_lz5k8wj_k1l2m3n4',
  toolExecutionId: 'tool_claude-code_lz5k8wj_k1l2m3n4',
  agentExecutionId: 'agent_assistant_lz5k8wi_j0k1l2m3',
  tool: 'claude-code',
  event: 'operation_start'
}
[INFO] Tool execution completed {
  conversationId: 'abc123...',
  executionId: 'exec_lz5k8wj_k1l2m3n4',
  toolExecutionId: 'tool_claude-code_lz5k8wj_k1l2m3n4',
  tool: 'claude-code',
  event: 'operation_complete',
  duration: 3421
}
```

## Log File Locations

- **Development**: Console output
- **Production**: `~/.tenex/logs/tenex.log`
- **Per-project**: `.tenex/logs/` (if configured)

## Performance Monitoring

The logs include timing information with full tracing context:
- LLM response times
- Token counts  
- Cost tracking (when available)
- Operation durations
- Request genealogy (parent/child relationships)

Example:
```
[INFO] LLM completion successful { 
  conversationId: 'abc123...',
  executionId: 'exec_lz5k8wk_l2m3n4o5',
  parentExecutionId: 'exec_lz5k8wj_k1l2m3n4',
  rootExecutionId: 'exec_lz5k8w9_a1b2c3d4',
  duration: 1523,  // milliseconds
  promptTokens: 245,
  completionTokens: 189,
  cost: 0.0023     // USD
}
```

## Tracing Requests Across the System

With structured event IDs, you can trace a single request through all components:

1. **Find all logs for a conversation:**
   ```bash
   grep "conversationId: 'abc123'" ~/.tenex/logs/tenex.log
   ```

2. **Trace a specific execution path:**
   ```bash
   grep "rootExecutionId: 'exec_lz5k8w9_a1b2c3d4'" ~/.tenex/logs/tenex.log
   ```

3. **Follow an agent's execution:**
   ```bash
   grep "agentExecutionId: 'agent_assistant_lz5k8wi_j0k1l2m3'" ~/.tenex/logs/tenex.log
   ```

4. **Analyze operation durations:**
   ```bash
   grep "event: 'operation_complete'" ~/.tenex/logs/tenex.log | grep "conversationId: 'abc123'"
   ```

## Best Practices for Tracing

1. **Always create a tracing context** at the entry point of your operation
2. **Use child contexts** for nested operations to maintain the execution hierarchy
3. **Log operation starts and completions** to measure durations
4. **Include relevant metadata** in your logs for better filtering
5. **Use specialized loggers** (TracingLogger) to ensure consistent context