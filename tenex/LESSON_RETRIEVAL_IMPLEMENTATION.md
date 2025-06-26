# Lesson Retrieval System Implementation

## Summary

I've successfully implemented the lesson retrieval system based on Gemini's feedback and your specifications. The system loads all agent lessons at startup and makes them available in agent prompts.

## What Was Implemented

### 1. Extended ProjectContext ✅
- Added `agentLessons: Map<string, NDKAgentLesson[]>` to store lessons by agent pubkey
- Implemented `addLesson()` method with automatic 50-lesson limit per agent
- Added helper methods: `getLessonsForAgent()` and `getAllLessons()`

### 2. Lesson Subscription in SubscriptionManager ✅
- Added `subscribeToAgentLessons()` method that subscribes to all agent lessons
- Filters by:
  - `kinds: NDKAgentLesson.kinds` (4129)
  - `authors: [all agent pubkeys]`
  - `#a: [project.tagId()]` - scoped to current project
- Real-time updates: New lessons are automatically added to the Map
- Maintains 50-lesson limit per agent (older lessons are evicted)

### 3. Updated Retrieved Lessons Fragment ✅
- Filters and formats lessons for the prompt:
  - Shows top 3 lessons from the current agent
  - Shows top 2 lessons from other agents
  - Maximum 5 lessons total to conserve tokens
- Formats as concise summaries (title + first sentence)
- Indicates phase and whether lesson is from another agent

### 4. AgentExecutor Integration ✅
- Passes `projectCtx.agentLessons` to the retrieved-lessons fragment
- Lessons are now automatically included in every agent's system prompt

## Architecture Flow

```
1. Startup: SubscriptionManager starts lesson subscription
                    ↓
2. Events: NDKAgentLesson events received from Nostr
                    ↓
3. Storage: Lessons added to ProjectContext.agentLessons Map
                    ↓
4. Prompts: AgentExecutor passes lessons to retrieved-lessons fragment
                    ↓
5. Execution: Agents see relevant lessons in their system prompt
```

## Example Prompt Output

```markdown
## Key Lessons Learned

Review these lessons from past experiences to guide your actions:

- **TypeScript async iteration gotcha** (execute phase): Using for-await-of with non-async iterables throws runtime error.
- **Git rebase conflict resolution** (execute phase): Always create a backup branch before interactive rebase.
- **React performance optimization** (review phase) [from another agent]: Memoize expensive computations in render methods.

Remember to use the `learn` tool when you discover new insights or patterns.
```

## Future Enhancements (Per Gemini's Feedback)

### 1. **Local File Cache** (Low Priority)
- Cache lessons to `.tenex/cache/lessons.jsonl`
- Load from cache on startup for faster initialization
- Subscribe only for lessons created after cache timestamp

### 2. **Advanced Filtering**
- Keyword matching from conversation context
- Phase-based prioritization
- Relevance scoring system

### 3. **Lesson Management Tools**
- Export/import lessons between projects
- Manual lesson curation interface
- Lesson analytics and usage tracking

## Technical Notes

1. **Memory Management**: Automatic 50-lesson limit prevents unbounded growth
2. **Real-time Updates**: New lessons appear in subsequent agent turns
3. **Cross-agent Learning**: All agents benefit from lessons learned by others
4. **Project Scoping**: Lessons are isolated per project via `#a` tags

The system is now live and agents will automatically:
- See relevant past lessons in their prompts
- Record new lessons with the `learn` tool
- Benefit from cross-agent knowledge sharing within the project