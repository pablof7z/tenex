# TENEX Dead Code and Duplication Analysis

## Executive Summary

This analysis identifies dead code, duplications, and areas for cleanup in the TENEX codebase. The main findings include:

1. **Multiple implementations of NDK initialization**
2. **Compiled TypeScript artifacts that should be gitignored**
3. **Empty directories that were previously used**
4. **TODO/FIXME comments indicating incomplete work**
5. **Potential duplicate utility functions**
6. **Files marked as deleted in git status but still present**

## Dead Code Findings

### 1. Empty Directories
- `/shared/src/agents/` - Empty directory, previously contained agent-related utilities

### 2. Deleted Files Still in Git Status
The following files are marked as deleted (`D`) in git status but their compiled artifacts still exist:
- `shared/src/agents/index.ts`
- `shared/src/agents/utils.ts`
- `shared/src/config/ndk.ts`
- `shared/src/nostr.ts`
- `shared/src/projects.ts`

### 3. Compiled TypeScript Artifacts
Large number of `.d.ts`, `.js`, `.js.map`, and `.d.ts.map` files in:
- `/packages/types/dist/`
- `/packages/types/src/` (contains compiled files that shouldn't be in src)
- `/shared/dist/`

These should be added to `.gitignore` as they are build artifacts.

## Code Duplications

### 1. NDK Initialization Functions
Found 3 different implementations of `getNDK()`:

**File: `/cli-client/src/ndk-setup.ts`**
- Returns Promise<NDK>
- Manages singleton instance
- Accepts config with nsec and relays
- Has shutdown function

**File: `/mcp/ndk.ts`**
- Returns NDK (not Promise)
- Uses global instance
- Has separate initNDK function
- More detailed logging

**File: `/cli/src/nostr/ndkClient.ts`**
- Returns Promise<NDK>
- Manages singleton instance
- No signer configuration
- Simpler implementation

### 2. Common Utility Functions
The following functions appear multiple times (3+ occurrences):
- `writeTextFile` / `writeTextFileSync`
- `readTextFile` / `readTextFileSync`
- `writeJsonFile` / `writeJsonFileSync`
- `readJsonFile` / `readJsonFileSync`
- `writeProjectMetadata`
- `readProjectMetadata`
- Various logging functions (`logError`, `logWarning`, `logInfo`, etc.)

### 3. Duplicate Time Formatting
Multiple implementations for time formatting found in:
- `/web-client/src/hooks/useTimeFormat.ts`
- Various components use inline time formatting logic

## TODO/FIXME Comments

### Critical TODOs:
1. **`/web-client/src/components/tasks/TaskOverview.tsx:87`**
   ```
   // TODO: Replace with useTimeFormat hook
   ```

2. **`/cli/src/commands/run/EventHandler.ts:189`**
   ```
   // TODO: Update title, description, etc. in metadata.json if changed
   ```

3. **`/web-client/src/hooks/useBackendStatus.ts:12`**
   ```
   // TODO: This needs to be updated to track project-specific status events
   ```

## Recommendations

### Immediate Actions:
1. **Update .gitignore** to exclude:
   ```
   packages/types/dist/
   packages/types/src/**/*.js
   packages/types/src/**/*.js.map
   packages/types/src/**/*.d.ts
   packages/types/src/**/*.d.ts.map
   shared/dist/
   ```

2. **Consolidate NDK initialization**:
   - Create a single shared NDK utility in `@tenex/shared`
   - Remove duplicate implementations
   - Standardize on Promise-based API

3. **Remove empty directories**:
   - `/shared/src/agents/`

4. **Clean up git status**:
   - Remove tracked compiled files
   - Ensure deleted source files are properly removed

### Medium-term Actions:
1. **Consolidate utility functions**:
   - Move all file I/O utilities to a single location
   - Create a shared logging utility
   - Standardize time formatting functions

2. **Address TODO comments**:
   - Implement useTimeFormat hook replacement
   - Update metadata.json handling in EventHandler
   - Fix backend status tracking for projects

3. **Type consolidation**:
   - Review duplicate type definitions across packages
   - Ensure single source of truth for core types

### Long-term Actions:
1. **Establish code quality standards**:
   - Set up pre-commit hooks to prevent compiled files
   - Add linting rules for TODO/FIXME comments
   - Regular dead code analysis

2. **Documentation**:
   - Document why certain utilities exist in multiple places
   - Create architecture decision records (ADRs) for major patterns

## Files to Review for Potential Removal

1. Test setup files that might be outdated:
   - `/web-client/src/test/setup.ts`
   - Various test utilities that might not be used

2. Example/demo files:
   - `/cli/src/utils/fs/example.ts`
   - `/web-client/src/components/AgentDiscoveryExample.tsx`

3. Files with large commented sections (239 files found with comments)

## Conclusion

The codebase shows signs of rapid evolution with some technical debt accumulation. The main issues are:
- Build artifacts in version control
- Multiple implementations of core utilities
- Incomplete refactorings (TODO comments)
- Empty directories from previous structures

Addressing these issues will improve maintainability and reduce confusion for developers working on the project.