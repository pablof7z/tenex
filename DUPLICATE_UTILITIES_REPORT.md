# TENEX Duplicate Utility Functions Report

## Summary

This report identifies duplicate utility functions across the TENEX codebase that could be consolidated to improve maintainability and reduce code duplication.

## 1. File I/O Functions

### Primary Implementation
- **Location**: `shared/src/fs/filesystem.ts`
- **Functions**: 
  - `readJsonFile()`, `readJsonFileSync()`
  - `writeJsonFile()`, `writeJsonFileSync()`
  - `readTextFile()`, `readTextFileSync()`
  - `writeTextFile()`, `writeTextFileSync()`
  - Plus many other file system utilities

### Usage
These functions are properly imported from `@tenex/shared/fs` in most places:
- `cli/src/utils/agents/llm/LLMConfigManager.ts`
- `cli/src/utils/agents/core/AgentConfigManager.ts`
- `cli/src/utils/agents/ConversationStorage.ts`
- `cli/src/utils/RulesManager.ts`
- `cli/src/commands/run/ProjectDisplay.ts`
- `cli/src/commands/run/ProjectLoader.ts`

### Project Metadata Functions
- **Location**: `shared/src/fs/tenex.ts`
- **Functions**: 
  - `readProjectMetadata()`
  - `writeProjectMetadata()`
  - `getTenexPaths()`
  - Other .tenex directory utilities

**Status**: ✅ No duplication found - properly centralized in shared library

## 2. Logging Functions

### Primary Implementation
- **Location**: `shared/src/logger.ts`
- **Functions**:
  - `logError()`, `logInfo()`, `logSuccess()`, `logWarning()`, `logDebug()`
  - `AgentLogger` class for contextual logging
  - `logger` object for compatibility

### Secondary Implementation (MCP)
- **Location**: `mcp/lib/utils/log.ts`
- **Purpose**: File-based logging to `~/.tenex.log`
- **Different from shared logger**: This is for persistent file logging, not console output

### Direct Console Usage
Found extensive direct `console.log` usage in:
- `cli/src/commands/run/ProjectDisplay.ts` (32 instances)
- `cli/src/commands/run/EventHandler.ts` (32 instances)
- `cli/src/utils/agents/tools/claudeCode/tool-alternatives.ts` (20 instances)
- `cli/src/utils/claudeOutputParser.ts` (19 instances)
- `cli/src/utils/fs/example.ts` (17 instances)
- And many more files...

**Status**: ⚠️ Significant duplication - many files use `console.log` directly instead of the shared logger

### Recommendation
1. Replace all direct `console.log/error/warn` calls with appropriate logger functions
2. Use `AgentLogger` for agent-specific logging contexts
3. Keep MCP's file logger separate as it serves a different purpose

## 3. Time Formatting Functions

### Primary Implementation
- **Location**: `web-client/src/hooks/useTimeFormat.ts`
- **Hook**: `useTimeFormat()`
- **Features**:
  - Relative time formatting ("5m ago", "2h ago")
  - Absolute time formatting
  - Auto formatting based on time difference
  - Configurable options (24-hour, include time, etc.)

### Direct Date Formatting
Found 22 instances of direct date formatting in web-client, including:
- `web-client/src/components/documentation/DocumentationView.tsx`
- `web-client/src/components/tasks/TaskOverview.tsx`
- `web-client/src/components/tasks/TaskCard.tsx`
- `web-client/src/components/projects/ProjectList.tsx`
- `web-client/src/components/projects/ProjectDetail.tsx`
- And more...

**Status**: ⚠️ Moderate duplication - many components implement their own date formatting instead of using the hook

### Recommendation
1. Update all components to use `useTimeFormat` hook
2. Extend the hook if needed to cover all use cases
3. Consider creating a shared time formatting utility for non-React contexts

## 4. Other Observations

### Path Utilities
- Well centralized in `shared/src/fs/filesystem.ts` with `expandHome()` and `resolvePath()`

### Error Handling
- `getErrorMessage()` from `@tenex/types/utils` is used consistently

### Type Definitions
- Properly centralized in `@tenex/types` package

## Recommendations

1. **Immediate Actions**:
   - Create migration tasks to replace direct console usage with logger
   - Update web components to use `useTimeFormat` hook

2. **Medium Term**:
   - Create a style guide for utility usage
   - Add linting rules to prevent direct console usage
   - Consider creating a shared time formatting utility for non-React contexts

3. **Long Term**:
   - Regular code audits to prevent utility duplication
   - Improve developer documentation on available utilities

## Impact

Consolidating these utilities would:
- Reduce code size
- Improve maintainability
- Ensure consistent behavior across the codebase
- Make it easier to add features (like log levels, time format preferences)
- Reduce bugs from inconsistent implementations