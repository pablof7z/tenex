# Fix for "claude_code" Agent Error

## Problem
The TeamOrchestrator was sometimes returning "claude_code" as a team lead, causing the error:
```
AgentError: Team lead 'claude_code' not found in available agents
```

## Root Cause
The LLM was hallucinating "claude_code" as an agent name when it should only be treated as a tool. This happened due to:
1. LLM training bias associating "claude_code" with coding tasks
2. Semantic confusion between tool names and agent names

## Solution Applied

### 1. Strengthened Team Orchestrator Prompt
Added explicit instructions to prevent agent name hallucination:

```typescript
CRITICAL: You MUST only select agents from the "Available Agents" list provided. Never invent agent names or use tool names as agent names.
```

Also improved the JSON structure comments:
```typescript
"lead": "agent_name", // MUST be an exact name from the Available Agents list
"members": ["agent1"] // For single agent, or ["agent1", "agent2", ...] for multiple - MUST be exact names from Available Agents
```

### 2. Enhanced Error Messages
Improved validation error messages to provide more context:

```typescript
throw new TeamFormationError(
  `Team lead '${response.team.lead}' not found in available agents: [${availableAgentNames.join(", ")}]. This usually indicates the LLM hallucinated an agent name that doesn't exist.`
);
```

### 3. Added Debug Logging
Added debug logging to help troubleshoot future issues:

```typescript
orchestrationLogger.debug(
  `Validating team formation - Available agents: ${availableAgentNames.join(", ")}`
);
orchestrationLogger.debug(
  `Proposed team lead: ${response.team.lead}, Proposed members: ${response.team.members.join(", ")}`
);
```

## Key Points

1. **claude_code is a TOOL, not an AGENT** - It should never appear in agent configurations
2. **The validation system works correctly** - It properly catches invalid agent names
3. **This is an LLM behavior issue** - The model sometimes hallucinates agent names
4. **The prompts now explicitly prevent this** - Clearer instructions should reduce occurrences

## Testing
- All existing TeamOrchestrator tests still pass
- The validation correctly catches hallucinated agent names
- Error messages are now more informative for debugging

## Files Modified
- `tenex/src/prompts/team-orchestrator.ts` - Strengthened prompt instructions
- `tenex/src/agents/application/TeamOrchestrator.ts` - Enhanced error messages and debug logging