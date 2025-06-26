# Lesson Retrieval System - Feedback Request

## Current Implementation Status

I've implemented the learn tool with the following enhancements based on your previous feedback:
- ✅ Project-scoped lessons via `a` tags
- ✅ Phase context via `phase` tags  
- ✅ Keyword tags (`t`) for retrieval
- ✅ Optional keywords parameter in the tool
- ✅ Learn directive with deduplication guidance

## Proposed Lesson Retrieval Architecture

The user has proposed a specific architecture for lesson retrieval:

### 1. **Project Context Enhancement**
Add to the project context:
```typescript
interface ProjectContext {
    // ... existing fields
    agentLessons: Map<string, NDKAgentLesson[]>; // agent-pubkey -> lessons
}
```

### 2. **Startup Subscription**
Once all agent pubkeys are loaded, start a subscription:
```typescript
const subscription = ndk.subscribe([{
    kinds: NDKAgentLesson.kinds,
    authors: Array.from(agents.keys()), // all agent pubkeys
    "#a": [project.tagId()] // scoped to this project
}]);
```

### 3. **Dynamic Application via Fragment**
Create a new lessons fragment that:
- Reads from `projectContext.agentLessons`
- Filters lessons relevant to the current agent
- Injects them into the agent's prompt

## Implementation Questions

### 1. **Subscription Management**
- Should the subscription be managed in `ProjectManager` or `ProjectContext`?
- How should we handle lesson updates during runtime (new lessons published while agents are running)?
- Should we maintain separate subscriptions per agent or one global subscription?

### 2. **Lesson Filtering & Relevance**
With all lessons loaded at startup, how should we determine relevance?
- **Option A**: Show all lessons from the same agent
- **Option B**: Show all lessons from all agents (cross-agent learning)
- **Option C**: Filter by phase match (show lessons from same/similar phases)
- **Option D**: Basic keyword matching from conversation context
- **Option E**: Combination of the above with scoring

### 3. **Memory Management**
- Should we limit the number of lessons per agent (e.g., most recent 50)?
- Should older lessons be pruned from memory?
- How to handle projects with thousands of lessons?

### 4. **Fragment Design**
For the lessons fragment:
```typescript
interface AgentLessonsArgs {
    agent: Agent;
    agentLessons: Map<string, NDKAgentLesson[]>;
    phase: Phase;
    conversation?: Conversation;
}

export const agentLessonsFragment: PromptFragment<AgentLessonsArgs> = {
    id: "agent-lessons",
    priority: 24, // Before learn-tool-directive
    template: ({ agent, agentLessons, phase }) => {
        // How to filter and format lessons?
    }
};
```

### 5. **Lesson Presentation**
How should lessons be formatted in the prompt?
- Show all relevant lessons with full content?
- Summarize if too many lessons?
- Group by category/keyword?
- Priority ordering (most recent, most relevant, most used)?

## Technical Considerations

### 1. **Startup Performance**
- Loading all lessons at startup could delay initialization
- Should we implement progressive loading?
- Cache lessons locally for faster subsequent starts?

### 2. **Real-time Updates**
- New lessons published during runtime should be added to the Map
- Should existing agents get access to new lessons mid-conversation?
- How to notify agents of particularly relevant new lessons?

### 3. **Cross-Project Learning**
- Current design scopes to project via `#a` tag
- Should we support importing lessons from other projects?
- Template/starter lessons for new projects?

## Proposed Implementation Plan

1. **Extend ProjectContext** with `agentLessons: Map<string, NDKAgentLesson[]>`
2. **Add lesson subscription** in ProjectManager after agents are loaded
3. **Create agentLessonsFragment** that filters and formats lessons
4. **Update AgentExecutor** to pass agentLessons to the fragment
5. **Handle subscription updates** to add new lessons to the Map

## Alternative Approaches

### A. **Lazy Loading**
Instead of loading all at startup, fetch relevant lessons on-demand when building prompts. Trade-off: Higher latency per agent execution.

### B. **Lesson Index Service**
Create a separate service that maintains a searchable index of lessons, similar to how a search engine works. More complex but more scalable.

### C. **Hierarchical Loading**
Load only lesson metadata at startup, fetch full content when needed. Reduces memory usage but adds complexity.

## Your Feedback

1. Is the proposed Map<agent-pubkey, lessons[]> structure optimal, or should we consider a different data structure?
2. What's the best strategy for determining lesson relevance given we'll have all lessons in memory?
3. How should we handle the subscription lifecycle and updates?
4. Should we implement any lesson ranking/scoring system?
5. Any concerns about memory usage or performance with this approach?

The goal is to make lessons immediately available to agents while keeping the system performant and the prompts focused on the most relevant knowledge.