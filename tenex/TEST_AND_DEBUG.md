# Testing and Debugging TENEX Conversation System

## Quick Start Testing

### 1. Test Script (Standalone)
```bash
# Run the comprehensive test
bun test-conversation-system.ts

# With debug logging
LOG_LEVEL=debug bun test-conversation-system.ts
```

### 2. CLI Test Command
```bash
# After building
npm run build

# Test with default message
./dist/cli.js test conversation

# Test with custom message
./dist/cli.js test conversation -m "I want to build a REST API" -t "API Project"

# With debug logging
./dist/cli.js test conversation --debug
```

## What Gets Tested

1. **LLM Configuration Loading**
   - Checks if llms.json exists
   - Validates configurations
   - Tests API connectivity

2. **Agent Registry**
   - Creates test agents
   - Generates nsec keys
   - Manages agent lifecycle

3. **Conversation Management**
   - Creates new conversations
   - Tracks conversation state
   - Manages phase transitions

4. **Routing System**
   - Routes new conversations to appropriate phase
   - Selects agents based on expertise
   - Handles fallback scenarios

5. **Prompt Generation**
   - Builds phase-specific prompts
   - Composes fragments correctly
   - Generates valid JSON schemas

6. **Nostr Publishing**
   - Creates properly formatted events
   - Manages p-tags correctly
   - Adds LLM metadata tags

## Debugging Tips

### 1. Enable Verbose Logging
```bash
# Set in environment
export LOG_LEVEL=debug

# Or in your shell profile
echo 'export LOG_LEVEL=debug' >> ~/.bashrc
```

### 2. Watch Specific Components
```bash
# LLM interactions
./dist/cli.js test conversation --debug 2>&1 | grep -E "(LLM|llm)"

# Routing decisions
./dist/cli.js test conversation --debug 2>&1 | grep -i "rout"

# Agent activity
./dist/cli.js test conversation --debug 2>&1 | grep -i "agent"
```

### 3. Test Individual Components

#### Test LLM Service
```typescript
// test-llm.ts
import { LLMConfigManager, LLMService } from './src/llm';
import { Message } from 'multi-llm-ts';

const manager = new LLMConfigManager('.');
await manager.loadConfigurations();
const service = new LLMService(manager);

const response = await service.complete('default', [
  new Message('user', 'Say hello')
]);
console.log(response);
```

#### Test Routing
```typescript
// test-routing.ts
import { RoutingLLM } from './src/routing';
// ... setup LLM service
const router = new RoutingLLM(llmService);
const decision = await router.routeNewConversation(event, agents);
```

### 4. Common Issues and Solutions

#### "llms.json not found"
Create `llms.json` in your project root:
```json
{
  "configurations": {
    "default": {
      "provider": "openrouter",
      "model": "meta-llama/llama-3.2-3b-instruct"
    }
  },
  "defaults": {
    "default": "default"
  },
  "credentials": {
    "openrouter": {
      "apiKey": "sk-or-v1-YOUR-KEY",
      "baseUrl": "https://openrouter.ai/api/v1"
    }
  }
}
```

#### "No agents found"
The test will create a default agent, or you can pre-create agents:
```bash
# Initialize a project first
./dist/cli.js project init

# This creates .tenex/agents.json
```

#### LLM Timeouts
Check your API key and network:
```bash
# Test API directly
curl https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer YOUR-API-KEY"
```

### 5. Inspect System State

#### Check Conversation State
```typescript
const conversations = conversationManager.getAllConversations();
console.log(JSON.stringify(conversations, null, 2));
```

#### Check Agent Registry
```typescript
const agents = agentRegistry.getAllAgents();
agents.forEach(agent => {
  console.log(`${agent.name}: ${agent.pubkey} (${agent.role})`);
});
```

#### Check Routing Decision Details
The routing system logs detailed decisions:
```
[INFO] Routed new conversation { 
  phase: 'chat', 
  confidence: 0.85,
  reasoning: 'User needs requirements clarification'
}
```

## Integration Testing

### Test Full Conversation Flow
```bash
# 1. Start daemon (in one terminal)
./dist/cli.js daemon start

# 2. Run project (in another terminal)
./dist/cli.js project run

# 3. Send test event (in third terminal)
./dist/cli.js test conversation -m "Build a chat app"

# 4. Watch logs
tail -f ~/.tenex/logs/tenex.log
```

### Test Phase Transitions
```typescript
// Simulate phase transition
await conversationManager.updatePhase(conversationId, 'plan');
const context = await conversationManager.compactHistory(conversationId, 'plan');
console.log('Transition context:', context);
```

## Performance Monitoring

The system logs performance metrics:

```
[INFO] LLM completion successful { 
  configName: 'default',
  model: 'deepseek/deepseek-chat',
  duration: 1234,        // milliseconds
  promptTokens: 150,
  completionTokens: 200
}
```

Monitor for:
- Response times > 5 seconds
- High token usage (> 1000 tokens)
- Failed routing decisions
- Repeated fallback routing

## Next Steps

1. **Add More Test Cases**
   - Test agent handoffs
   - Test phase completion criteria
   - Test error recovery

2. **Create Mock Mode**
   - Mock LLM responses for testing
   - Mock Nostr publishing
   - Deterministic test scenarios

3. **Add Metrics Collection**
   - Track success rates
   - Monitor response times
   - Count token usage