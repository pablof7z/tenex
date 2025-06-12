# TENEX Testing Guidelines

This document outlines the testing strategy, standards, and best practices for the TENEX project.

## Table of Contents

1. [Overview](#overview)
2. [Testing Philosophy](#testing-philosophy)
3. [Testing Stack](#testing-stack)
4. [Test Organization](#test-organization)
5. [Writing Tests](#writing-tests)
6. [Mocking Strategy](#mocking-strategy)
7. [Testing by Component](#testing-by-component)
8. [Running Tests](#running-tests)
9. [Coverage Requirements](#coverage-requirements)
10. [CI/CD Integration](#cicd-integration)

## Overview

TENEX uses a comprehensive testing strategy that includes:
- Unit tests for individual functions and classes
- Integration tests for component interactions
- E2E tests for critical user workflows (web client only)

## Testing Philosophy

1. **Test Behavior, Not Implementation**: Focus on what the code does, not how it does it
2. **Fast and Reliable**: Tests should run quickly and produce consistent results
3. **Maintainable**: Tests should be easy to understand and update
4. **Isolated**: Each test should be independent and not rely on external state
5. **Comprehensive**: Cover edge cases, error paths, and happy paths

## Testing Stack

### Primary Testing Framework
- **Bun Test Runner**: Native to our runtime, fast, and TypeScript-ready
  ```bash
  bun test
  ```

### Testing Libraries
- **Bun built-in test utilities**: For assertions and test structure
- **Playwright**: For E2E testing (web client only)
- **memfs**: For mocking file system operations
- **nock/MSW**: For mocking HTTP requests

## Test Organization

### File Structure
```
component/
├── src/
│   ├── utils/
│   │   ├── calculator.ts
│   │   └── calculator.test.ts    # Unit test alongside source
│   └── services/
│       ├── api.ts
│       └── api.test.ts
└── tests/
    ├── integration/              # Integration tests
    └── e2e/                     # End-to-end tests
```

### Naming Conventions
- Test files: `*.test.ts` or `*.spec.ts`
- Test suites: Use `describe()` blocks with clear descriptions
- Test cases: Start with "should" or use behavior descriptions

```typescript
describe('CostCalculator', () => {
  describe('calculateCost', () => {
    test('should calculate costs for Claude 3 Opus correctly', () => {
      // test implementation
    });

    test('returns zero cost for zero tokens', () => {
      // test implementation
    });
  });
});
```

## Writing Tests

### Test Structure (AAA Pattern)
```typescript
test('should process valid agent configuration', () => {
  // Arrange
  const config = {
    name: 'test-agent',
    model: 'claude-3-opus-20240229'
  };

  // Act
  const result = processAgentConfig(config);

  // Assert
  expect(result.success).toBe(true);
  expect(result.agent.name).toBe('test-agent');
});
```

### Testing Async Code
```typescript
test('should fetch project from Nostr', async () => {
  const projectId = 'test-project';
  
  const project = await fetchProject(projectId);
  
  expect(project).toBeDefined();
  expect(project.id).toBe(projectId);
});
```

### Testing Errors
```typescript
test('should throw error for invalid configuration', () => {
  const invalidConfig = { name: '' };
  
  expect(() => {
    validateConfig(invalidConfig);
  }).toThrow('Configuration name is required');
});
```

## Mocking Strategy

### File System Operations
```typescript
import { vol } from 'memfs';

beforeEach(() => {
  vol.reset();
  vol.fromJSON({
    '/project/.tenex/agents.json': JSON.stringify({ default: 'nsec1...' }),
    '/project/.tenex/metadata.json': JSON.stringify({ title: 'Test Project' })
  });
});
```

### Nostr/NDK Operations
```typescript
// Mock NDK client
const mockNDK = {
  connect: vi.fn().mockResolvedValue(undefined),
  fetchEvent: vi.fn().mockResolvedValue(mockEvent),
  publish: vi.fn().mockResolvedValue({ id: 'event123' })
};

// Use in tests
beforeEach(() => {
  vi.mock('@nostr-dev-kit/ndk', () => ({
    NDK: vi.fn(() => mockNDK)
  }));
});
```

### External APIs
```typescript
import nock from 'nock';

test('should handle API responses', async () => {
  nock('https://api.openai.com')
    .post('/v1/chat/completions')
    .reply(200, { choices: [{ message: { content: 'Test response' } }] });

  const response = await callOpenAI('Test prompt');
  expect(response).toBe('Test response');
});
```

## Testing by Component

### CLI Tool (`cli/`)

#### Priority Test Areas
1. **Pure Functions**
   ```typescript
   // cli/src/utils/agents/llm/costCalculator.test.ts
   import { calculateCost } from './costCalculator';

   test('calculates token costs accurately', () => {
     const result = calculateCost('gpt-4', 1000, 500);
     expect(result.totalCost).toBeCloseTo(0.045, 3);
   });
   ```

2. **Command Handlers**
   ```typescript
   // cli/src/commands/agent/publish.test.ts
   test('publishes agent with all parameters', async () => {
     const result = await publishCommand.run({
       title: 'Test Agent',
       description: 'Test Description'
     });
     
     expect(result.success).toBe(true);
     expect(mockNDK.publish).toHaveBeenCalledWith(
       expect.objectContaining({ kind: 31500 })
     );
   });
   ```

3. **Agent Manager**
   ```typescript
   // cli/src/utils/agents/AgentManager.test.ts
   test('loads agents from configuration', async () => {
     const manager = new AgentManager('/test/project');
     await manager.loadAgents();
     
     expect(manager.agents).toHaveLength(2);
     expect(manager.getAgent('default')).toBeDefined();
   });
   ```

### MCP Server (`mcp/`)

#### Priority Test Areas
1. **Git Operations**
   ```typescript
   // mcp/lib/git.test.ts
   test('commits with proper message format', async () => {
     const mockGit = {
       add: vi.fn().mockResolvedValue(undefined),
       commit: vi.fn().mockResolvedValue({ commit: 'abc123' })
     };

     await commitChanges(mockGit, 'Test commit', 'task-123');
     
     expect(mockGit.commit).toHaveBeenCalledWith(
       expect.stringContaining('[task-123]')
     );
   });
   ```

2. **Tool Handlers**
   ```typescript
   // mcp/tools/publish.test.ts
   test('publishes status update with correct format', async () => {
     const result = await publishStatusUpdate({
       content: 'Building project',
       taskId: 'task-123',
       confidence: 85
     });

     expect(result.success).toBe(true);
     expect(result.eventId).toBeDefined();
   });
   ```

### Shared Libraries (`shared/`)

#### Priority Test Areas
1. **Type Guards**
   ```typescript
   // shared/src/types/guards.test.ts
   test('validates project event structure', () => {
     const validEvent = {
       kind: 31933,
       tags: [['d', 'project-id'], ['title', 'Test Project']],
       content: 'Project description'
     };

     expect(isProjectEvent(validEvent)).toBe(true);
     expect(isProjectEvent({ kind: 1 })).toBe(false);
   });
   ```

2. **Utility Functions**
   ```typescript
   // shared/src/agents/utils.test.ts
   test('generates agent profile correctly', () => {
     const profile = generateAgentProfile('Test Agent', 'project-123');
     
     expect(profile.name).toBe('Test Agent @ project-123');
     expect(profile.about).toContain('AI assistant');
   });
   ```

### Web Client (`web-client/`)

Continue using Playwright for E2E tests, but add unit tests for:

1. **Custom Hooks**
   ```typescript
   // web-client/src/hooks/useProject.test.ts
   import { renderHook } from '@testing-library/react-hooks';
   import { useProject } from './useProject';

   test('fetches project data', async () => {
     const { result, waitForNextUpdate } = renderHook(() => 
       useProject('project-123')
     );

     await waitForNextUpdate();

     expect(result.current.project).toBeDefined();
     expect(result.current.loading).toBe(false);
   });
   ```

2. **Utility Functions**
   ```typescript
   // web-client/src/utils/format.test.ts
   test('formats timestamps correctly', () => {
     const timestamp = 1704067200; // 2024-01-01 00:00:00 UTC
     expect(formatTime(timestamp)).toBe('Jan 1, 2024');
   });
   ```

## Running Tests

### All Tests
```bash
# Run all tests in a component
cd cli && bun test

# Run tests in watch mode
bun test --watch

# Run tests with coverage
bun test --coverage
```

### Specific Tests
```bash
# Run a specific test file
bun test src/utils/calculator.test.ts

# Run tests matching a pattern
bun test --testNamePattern="calculateCost"
```

### E2E Tests (Web Client)
```bash
cd web-client

# Run all E2E tests
bun run test

# Run with UI mode for debugging
bun run test:ui

# Run a specific test
bun run test tests/create-project.spec.ts
```

## Coverage Requirements

### Minimum Coverage Targets
- **Overall**: 70%
- **Critical Paths**: 90%
  - Payment calculations
  - Agent message handling
  - Project initialization
  - Git operations

### Coverage Reports
```bash
# Generate coverage report
bun test --coverage

# View coverage in browser
open coverage/index.html
```

### Excluding from Coverage
```typescript
/* c8 ignore start */
// Code that doesn't need testing (e.g., debug logging)
/* c8 ignore stop */
```

## CI/CD Integration

### GitHub Actions Workflow
```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        component: [cli, mcp, shared, tenexd, web-client]
    
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      
      - name: Install dependencies
        run: cd ${{ matrix.component }} && bun install
      
      - name: Run tests
        run: cd ${{ matrix.component }} && bun test --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          directory: ./${{ matrix.component }}/coverage
```

### Pre-commit Hooks
```bash
# .husky/pre-commit
#!/bin/sh
bun test --bail
```

## Best Practices

### DO's
- ✅ Write tests before fixing bugs
- ✅ Keep tests focused and independent
- ✅ Use descriptive test names
- ✅ Mock external dependencies
- ✅ Test edge cases and error conditions
- ✅ Clean up after tests (restore mocks, clear state)

### DON'Ts
- ❌ Don't test implementation details
- ❌ Don't use real network calls in unit tests
- ❌ Don't rely on test execution order
- ❌ Don't ignore flaky tests
- ❌ Don't commit `.only()` or `.skip()` tests
- ❌ Don't mock everything - some integration is valuable

## Getting Started

1. **Set up your environment**
   ```bash
   # Install Bun if not already installed
   curl -fsSL https://bun.sh/install | bash
   ```

2. **Run existing tests to ensure they pass**
   ```bash
   cd cli && bun test
   cd ../web-client && bun run test
   ```

3. **Write your first test**
   - Find a pure function without tests
   - Create a `.test.ts` file next to it
   - Write tests following the examples above

4. **Submit PR with tests**
   - All new features must include tests
   - Bug fixes should include regression tests
   - Coverage should not decrease

## Resources

- [Bun Test Documentation](https://bun.sh/docs/cli/test)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

---

*Last Updated: January 2025*