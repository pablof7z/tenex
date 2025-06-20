# TENEX Logging Guide

## Overview

The TENEX system has comprehensive logging throughout all components using the `@tenex/shared/logger` module.

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

### Successful Conversation Start:
```
[INFO] Created new conversation: [title] { id: '...' }
[DEBUG] LLM completion request { configName: 'default', model: '...' }
[INFO] Routed new conversation { phase: 'chat', confidence: 0.9 }
[INFO] Published project response { id: '...' }
```

### Agent Handoff:
```
[INFO] Conversation [id] transitioned from chat to plan
[DEBUG] Selecting agent for phase: plan
[INFO] Published agent response { nextAgent: '[expert-pubkey]' }
```

### Error Handling:
```
[ERROR] LLM completion failed { error: '...', configName: '...', model: '...' }
[WARN] Failed to parse routing decision, using fallback
[INFO] Fallback routing succeeded { phase: 'chat' }
```

## Log File Locations

- **Development**: Console output
- **Production**: `~/.tenex/logs/tenex.log`
- **Per-project**: `.tenex/logs/` (if configured)

## Performance Monitoring

The logs include timing information:
- LLM response times
- Token counts
- Cost tracking (when available)

Example:
```
[INFO] LLM completion successful { 
  duration: 1523,  // milliseconds
  promptTokens: 245,
  completionTokens: 189,
  cost: 0.0023     // USD
}
```