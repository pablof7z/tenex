# TENEX Testability Analysis

This document provides a comprehensive analysis of the testability of the main TENEX components and identifies what should be tested and how.

## Overview

The TENEX project consists of four main components:
1. **CLI Tool** (`cli/`) - Command-line interface for project and agent management
2. **MCP Server** (`mcp/`) - Model Context Protocol server for AI integration
3. **Shared Libraries** (`shared/`) - Common code between components
4. **Web Client** (`web-client/`) - React-based web interface

## Current Testing Status

### Existing Tests
- **Web Client**: Has Playwright E2E tests for UI flows
  - Project creation flows
  - Task creation flows
  - Thread interactions
- **Other Components**: No unit or integration tests found

## Component-by-Component Analysis

### 1. CLI Tool (`cli/`)

#### Highly Testable Units (Pure Functions)

**Cost Calculator** (`src/utils/agents/llm/costCalculator.ts`)
- Pure functions for calculating LLM costs
- No side effects, easy to unit test
- Test cases: Various models, token counts, edge cases

**Claude Output Parser** (`src/utils/claudeOutputParser.ts`)
- Parser logic can be tested with mock Claude outputs
- EventEmitter behavior testable with listeners
- Test cases: Different message types, malformed JSON, buffer handling

**Conversation Optimizer** (`src/utils/agents/ConversationOptimizer.ts`)
- Token estimation and context window optimization
- Pure calculation functions
- Test cases: Different message sizes, optimization strategies

**Agent System Prompt Generation** (`src/utils/agents/Agent.ts`)
- `getSystemPrompt()` method is pure
- Test cases: Different agent configurations, rule combinations

#### Components Requiring Mocking

**Agent Manager** (`src/utils/agents/AgentManager.ts`)
- File system operations (needs fs mocking)
- Agent creation and loading
- Test cases: Loading agents, creating new agents, error handling

**Conversation Storage** (`src/utils/agents/ConversationStorage.ts`)
- File system operations
- Event deduplication logic
- Test cases: Save/load conversations, cleanup, deduplication

**LLM Providers** (`src/utils/agents/llm/*Provider.ts`)
- HTTP requests to external APIs
- Mock API responses needed
- Test cases: Successful responses, errors, retries, caching

**Commands** (`src/commands/*`)
- Complex orchestration requiring multiple mocks
- File system, Nostr operations, console output
- Integration tests more suitable than unit tests

#### Testing Approach for CLI
```typescript
// Example unit test structure
describe('CostCalculator', () => {
  test('calculates GPT-4 costs correctly', () => {
    const cost = calculateCost('gpt-4', 1000, 500);
    expect(cost).toBe(0.045); // $0.03 + $0.015
  });
});

// Example integration test with mocks
describe('AgentManager', () => {
  beforeEach(() => {
    jest.mock('fs/promises');
  });
  
  test('loads agents from config', async () => {
    // Mock file system
    // Test loading logic
  });
});
```

### 2. MCP Server (`mcp/`)

#### Testable Components

**Git Utilities** (`lib/git.ts`)
- Git operations with simple-git
- Mock git commands
- Test cases: Commit creation, hash validation, reset operations

**Agent Configuration** (`lib/agents.ts`)
- Configuration loading and management
- Mock file system and Nostr client
- Test cases: Loading config, publishing status updates

#### Testing Approach for MCP
```typescript
// Mock simple-git
jest.mock('simple-git', () => ({
  simpleGit: jest.fn(() => ({
    checkIsRepo: jest.fn(),
    status: jest.fn(),
    commit: jest.fn(),
    // ... other methods
  }))
}));
```

### 3. Shared Libraries (`shared/`)

#### Highly Testable Units

**Agent Utilities** (`src/agents/utils.ts`)
- `toKebabCase()` - pure string transformation
- `generateAgentAvatarUrl()` - pure URL generation
- `createAgentProfile()` - pure data transformation
- Test cases: Various name formats, edge cases

**Project Utilities** (`src/projects.ts`)
- `extractProjectIdentifierFromTag()` - pure string parsing
- Project metadata creation
- Test cases: Tag parsing, metadata generation

#### Components Requiring Mocking

**Nostr Operations** (`src/nostr.ts`)
- NDK client operations
- Mock NDK for testing
- Test cases: Event publishing, fetching

**File System Operations** (`src/fs/tenex.ts`)
- Directory creation, file operations
- Mock fs module
- Test cases: Directory structure creation, error handling

### 4. Web Client (`web-client/`)

#### Current Testing
- Playwright E2E tests already exist
- Good coverage of user flows

#### Additional Testing Opportunities

**Custom Hooks** (`src/hooks/*`)
- Mock NDK hooks and Nostr subscriptions
- Test state management logic
- Test cases: Data fetching, error states, updates

**Utility Functions**
- Time formatting (`useTimeFormat.ts`)
- Project status calculations
- Pure functions easy to test

#### Testing Approach for Web Client
```typescript
// Testing custom hooks
import { renderHook } from '@testing-library/react-hooks';
import { useProject } from './useProject';

test('useProject fetches project data', async () => {
  // Mock NDK subscription
  const { result, waitForNextUpdate } = renderHook(() => 
    useProject('project-id')
  );
  
  await waitForNextUpdate();
  expect(result.current.project).toBeDefined();
});
```

## Recommended Testing Strategy

### 1. Start with Pure Functions (High ROI)
- Cost calculator
- String utilities (kebab case, etc.)
- Conversation optimization
- Agent profile generation
- Time formatting

### 2. Add Unit Tests for Core Business Logic
- Agent system prompt generation
- Conversation management (with mocked storage)
- Git operations (with mocked git)
- Event parsing and handling

### 3. Integration Tests for Commands
- Mock file system and external services
- Test complete command flows
- Focus on error handling and edge cases

### 4. Mock External Dependencies
- **File System**: Use `memfs` or jest mocks
- **Nostr/NDK**: Create mock NDK client
- **HTTP Requests**: Use `nock` or MSW
- **Git**: Mock simple-git methods

### 5. Test Utilities Setup
```json
// Suggested test dependencies
{
  "devDependencies": {
    "@jest/globals": "^29.7.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1",
    "@types/jest": "^29.5.8",
    "memfs": "^4.6.0",
    "nock": "^13.3.8",
    "msw": "^2.0.0"
  }
}
```

### 6. Testing Infrastructure

**Jest Configuration** (`jest.config.js`):
```javascript
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

## Priority Testing Areas

### High Priority (Core Business Logic)
1. Agent conversation management
2. LLM cost calculations
3. Git operations for MCP
4. Project initialization logic
5. Agent profile generation

### Medium Priority (Supporting Features)
1. File system operations
2. Configuration management
3. Event parsing and handling
4. Custom React hooks
5. Conversation optimization

### Low Priority (UI/Integration)
1. Command orchestration (covered by E2E)
2. UI components (covered by E2E)
3. External API integrations

## Conclusion

The TENEX codebase has good separation of concerns that makes many components testable. The main challenges are:
1. Heavy reliance on external services (Nostr, LLMs, Git)
2. File system operations throughout
3. Complex command orchestration

With proper mocking strategies and focusing on pure functions first, the codebase can achieve good test coverage and confidence. Start with high-value, low-complexity tests and gradually add integration tests for more complex flows.