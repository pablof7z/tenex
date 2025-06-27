# PM Agent Tool Access Update

## Current vs New PM Tools

### Current PM Tools:
- readFile
- shell ❌ (remove)
- claudeCode ❌ (remove)
- analyze ✓
- switchPhase ❌ (being replaced by continue)
- handoff ❌ (being replaced by continue)
- generateInventory ✓
- learn ✓

### New PM Tools:
- readFile ✓
- analyze ✓
- continue ✓ (new, replaces switchPhase + handoff)
- generateInventory ✓
- learn ✓
- complete ✓

## Updated getDefaultToolsForAgent Function

```typescript
export function getDefaultToolsForAgent(isPMAgent: boolean, phase?: string): string[] {
    if (isPMAgent) {
        return [
            readFileTool.name,
            analyze.name,
            continueTool.name,  // new
            generateInventoryTool.name,
            learnTool.name,
            completeTool.name   // new
        ];
    }

    // Non-PM agents get default tools
    return [...DEFAULT_AGENT_TOOLS];
}
```

## Rationale

1. **No claude_code**: PM delegates all implementation to @executer
2. **No shell**: PM delegates all system operations to specialists
3. **Keep analyze**: PM needs to understand code/context for routing decisions
4. **Keep readFile**: PM needs to read files for context
5. **Keep generateInventory**: PM manages project organization
6. **Keep learn**: PM can learn from experiences