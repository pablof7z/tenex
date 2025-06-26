# Learn Tool Implementation - Feedback Request

## Overview
I've implemented a new "learn" tool that allows agents to record lessons learned during execution. These lessons are persisted as `NDKAgentLesson` events in Nostr, creating a knowledge base that agents can reference in future conversations.

## Implementation Details

### 1. Tool Implementation (`/src/tools/implementations/learn.ts`)
- **Purpose**: Allows agents to record important lessons/insights
- **Parameters**: 
  - `title`: Brief description of the lesson
  - `lesson`: The key insight (max 3-5 sentences)
- **Functionality**:
  - Creates and publishes `NDKAgentLesson` events
  - Tags the agent's event ID when available
  - Uses the agent's signer for authentication

### 2. Prompt Directive (`/src/prompts/fragments/learn-tool.ts`)
The directive instructs agents to use the tool in three scenarios:
1. **Self-correction after drift** - When they discover they were on the wrong path
2. **User-driven correction** - When users point out errors or misconceptions
3. **Discovery of non-obvious patterns** - When finding better approaches than obvious ones

### 3. Integration Points
- Added to `DEFAULT_AGENT_TOOLS` (all agents have access)
- Integrated with the prompt fragment system
- Follows existing tool patterns and NDK usage conventions

## Questions for Review

1. **Tool Activation**: Should the learn tool be available to all agents by default, or should it be opt-in per agent?

2. **Lesson Quality**: The current directive emphasizes conciseness (max 3-5 sentences). Is this the right balance, or should we allow more detailed lessons?

3. **Event Structure**: The `NDKAgentLesson` event has:
   - `title` tag for categorization
   - `content` field for the lesson itself
   - `e` tag referencing the agent's event
   
   Are there other tags/fields that would be useful?

4. **Retrieval Strategy**: How should lessons be retrieved and incorporated into future agent prompts? Should we:
   - Load all lessons for an agent at startup?
   - Query lessons based on context/keywords?
   - Have a separate "lesson retrieval" tool?

5. **Lesson Management**: Should we implement:
   - Deduplication (prevent similar lessons)?
   - Lesson expiration/archival?
   - Lesson voting/validation by users?

6. **Privacy/Scope**: Currently lessons are public Nostr events. Should we:
   - Make them private to the project?
   - Allow configurable privacy levels?
   - Tag them with project context?

## Sample Usage

When an agent makes a mistake and corrects it:
```
Agent: I'll use a complex regex to parse this JSON...
[tries regex approach, fails]
Agent: I realize now that using JSON.parse() is the correct approach for parsing JSON data. Let me record this lesson.

[Calls learn tool with:]
title: "JSON parsing approach"
lesson: "Attempted to parse JSON with regex. This fails on nested structures and edge cases. Always use JSON.parse() for JSON data as it handles all valid JSON correctly."
```

## Technical Considerations

1. **Performance**: Each lesson creates a Nostr event. Should we batch lessons or limit frequency?

2. **Storage**: Lessons accumulate over time. Should we implement:
   - Max lessons per agent?
   - Lesson compression/summarization?
   - Archival strategies?

3. **Cross-agent learning**: Should lessons from one agent be available to others in the same project?

## Next Steps

Based on your feedback, I can:
1. Adjust the implementation (activation strategy, parameters, etc.)
2. Implement lesson retrieval mechanisms
3. Add lesson management features
4. Create tests for the new functionality

What aspects should we prioritize?