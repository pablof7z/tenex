# Agent Discovery Workflow

This document describes the complete workflow for discovering and adding new AI agents to a TENEX project.

## Overview

The agent discovery system allows the default agent to search for specialized AI agents when users request capabilities beyond its expertise. The system leverages Nostr's decentralized network to find NDKAgent events (kind 4199) and presents them to users for selection.

## Architecture

### 1. Tool System (`find_agent`)

The `findAgent.ts` tool is exclusively available to the default agent and provides:
- **Search capabilities**: Find agents by capabilities, specialization, or keywords
- **Scoring algorithm**: Ranks agents based on relevance to search criteria
- **Rich response format**: Returns data formatted for web client rendering

### 2. Tool Execution Flow

```
User Request → Default Agent → find_agent tool → NDK Search → Score & Filter → Format Response
```

### 3. Response Handling

The tool returns a special `renderInChat` property that flows through the system:

1. **Tool Result** → Contains `renderInChat` with type and data
2. **ToolExecutor** → Extracts and passes through `renderInChat`
3. **ToolEnabledProvider** → Stores `renderInChat` for later retrieval
4. **AgentResponseGenerator** → Adds `renderInChat` to final response
5. **AgentEventHandler** → Publishes event with special formatting

### 4. Event Structure

When an agent discovery response is published:
```json
{
  "kind": 1111,  // Thread reply
  "content": "{\"type\":\"agent_discovery\",\"data\":{\"query\":{...},\"agentEventIds\":[\"event-id-1\",\"event-id-2\"],\"message\":\"Found 2 agents...\"},\"content\":\"...\"}",
  "tags": [
    ["render-type", "agent_discovery"],
    ["a", "31933:pubkey:project-id"],
    // ... other tags
  ]
}
```

The `agentEventIds` array contains the event IDs of NDKAgent events (kind 4199) that the web client should fetch directly from Nostr relays.

## Usage

### For Users

1. **Request specialized help**: "I need help designing a microservices architecture"
2. **View agent suggestions**: The default agent presents discovered agents
3. **Select agents**: Choose which agents to add to the project
4. **Authorization**: Sign the NDKProject event to add agent tags

### For the Default Agent

The default agent's system prompt includes detailed instructions:

```markdown
### When to use find_agent:
- User requests a task requiring specialized skills
- User asks about available agents
- A specialized agent would provide better assistance

### How to use find_agent:
- General search: find_agent({})
- Capability search: find_agent({ capabilities: "security audit" })
- Specialization: find_agent({ specialization: "React" })
- Keywords: find_agent({ keywords: "performance optimization" })
```

## Implementation Details

### Tool Registration

```typescript
// In AgentOrchestrator.ts
this.toolManager.enableFindAgentTool(name);

// In ToolManager.ts
enableFindAgentTool(agentName: string): void {
    if (agentName === "default") {
        const agentRegistry = this.agentRegistries.get(agentName);
        if (agentRegistry) {
            agentRegistry.register(findAgentTool);
        }
    }
}
```

### Agent Scoring Algorithm

The tool scores agents based on:
- **Capabilities match**: 10 points per matching word
- **Specialization match**: 8 points per matching word
- **Keyword match**: 5 points per matching word
- **Description length**: Bonus points for detailed descriptions

### Web Client Integration

The web client should:
1. Check for `render-type` tag with value "agent_discovery"
2. Parse the JSON content to extract `agentEventIds`
3. Fetch NDKAgent events (kind 4199) using the provided event IDs
4. Render an `AgentDiscoveryCard` component with the fetched agent data
5. Display individual agents using `AgentCard` components
6. Provide UI for users to select and add agents to the project

## Security Considerations

1. **Agent verification**: Only the default agent can use find_agent
2. **User authorization**: Only users can sign events to add agents
3. **NDK integration**: All agent searches go through authenticated NDK

## Future Enhancements

1. **Reputation system**: Weight agents by community trust scores
2. **Capability matching**: More sophisticated NLP-based matching
3. **Agent recommendations**: Suggest agents based on project context
4. **Batch operations**: Add multiple agents in one transaction

## Testing

The system includes comprehensive unit tests:
- Tool definition validation
- Agent filtering and scoring
- Error handling
- Response formatting
- Access control

Run tests with: `bun test src/utils/agents/tools/__tests__/findAgent.test.ts`

## Troubleshooting

### Common Issues

1. **"Only the default agent can search"**: Ensure the agent name is exactly "default"
2. **"NDK client not available"**: Check that NDK is properly initialized
3. **No agents found**: Verify NDK is connected to relays with agent events

### Debug Logging

Enable debug logs to trace the discovery process:
```bash
DEBUG=tenex:* tenex run
```

## Related Documentation

- [Tool System README](./README.md)
- [Agent Configuration](../AgentConfigurationManager.ts)
- [NDKAgent Specification](../../../../SPEC.md#ndkagent-event-structure-kind-4199)