# Learn Tool Implementation Summary

## What Was Implemented

Based on Gemini's excellent feedback, I've implemented the following enhancements to the learn tool:

### 1. Enhanced Event Structure ✅
The `NDKAgentLesson` events now include:
- **Project tag** (`a` tag) - Scopes lessons to the specific project
- **Phase tag** - Records which phase the lesson was learned in
- **Keyword tags** (`t` tags) - Enables keyword-based retrieval
- **Agent reference** (`e` tag) - Links to the agent that created the lesson

### 2. Keywords Parameter ✅
- Added optional `keywords` parameter to the learn tool
- Agents can specify relevant keywords like `['typescript', 'async']` or `['git', 'rebase']`
- Keywords are normalized to lowercase and stored as `t` tags

### 3. Updated Learn Directive ✅
- Added guidance about deduplication consideration
- Emphasized including keywords for better retrieval
- Maintained the focus on concise, actionable lessons

### 4. Basic Retrieval Placeholder ✅
- Created `retrieved-lessons` fragment that provides guidance about the lesson system
- Added to `AgentExecutor` prompt building pipeline
- Note: Full async retrieval would require architectural changes to the prompt system

## Example Usage

```typescript
// Agent discovers a pattern and records it
await learn({
    title: "TypeScript async iteration gotcha",
    lesson: "Using for-await-of with non-async iterables throws runtime error. Always check if Symbol.asyncIterator exists before using for-await-of. Use regular for-of loop for synchronous iterables.",
    keywords: ["typescript", "async", "iteration", "for-await-of"]
});
```

## Event Structure Example

```json
{
    "kind": 4129,
    "content": "Using for-await-of with non-async iterables throws runtime error...",
    "tags": [
        ["title", "TypeScript async iteration gotcha"],
        ["e", "agent-event-id"],
        ["a", "31990:project-pubkey:project-name"],
        ["phase", "execute"],
        ["t", "typescript"],
        ["t", "async"],
        ["t", "iteration"],
        ["t", "for-await-of"]
    ]
}
```

## Future Enhancements (Per Gemini's Roadmap)

### 1. Async Lesson Retrieval
The current prompt fragment system is synchronous. To implement full retrieval:
- Option A: Pre-fetch lessons before prompt building in `AgentExecutor`
- Option B: Create a `retrieve_lessons` tool that agents can call explicitly
- Option C: Modify the prompt system to support async fragments

### 2. Advanced Management Features
- **Batching**: Queue lessons and publish in batches to reduce noise
- **Archival**: Implement TTL or per-agent lesson limits
- **Validation**: User voting/endorsement system for high-value lessons

### 3. Retrieval Tool
Create a dedicated tool for searching lessons:
```typescript
await retrieve_lessons({
    keywords: ["git", "rebase"],
    limit: 5
});
```

## Technical Notes

1. **Direct NDK Usage**: Following the codebase pattern of using NDK directly without wrappers
2. **Project Scoping**: Lessons are scoped to projects via the `a` tag, enabling cross-agent learning within a project
3. **Synchronous Limitation**: The prompt fragment system is currently synchronous, limiting real-time retrieval

## Impact

This implementation creates the foundation for a learning system where:
- Agents can record important discoveries and corrections
- Lessons are properly scoped to projects and tagged for retrieval
- Future agents can benefit from past experiences
- The system can evolve to include more sophisticated retrieval and management

The learn tool is now available to all agents by default, encouraging a culture of continuous improvement and knowledge sharing within the multi-agent system.