# TENEX Testing Guide

## Overview

The TENEX project uses a comprehensive testing strategy with unit tests, integration tests, and end-to-end tests to ensure reliability and maintainability.

## Test Structure

```
src/
├── agents/
│   └── __tests__/
│       ├── AgentRegistry.test.ts         # Unit tests
│       └── AgentExecutor.integration.test.ts  # Integration tests
├── conversations/
│   └── __tests__/
│       ├── ConversationManager.test.ts
│       └── ConversationManager.integration.test.ts
├── llm/
│   └── __tests__/
│       ├── LLMConfigManager.test.ts
│       └── LLMService.test.ts
├── routing/
│   └── __tests__/
│       └── RoutingLLM.test.ts
└── tools/
    └── execution/
        └── __tests__/
            ├── ToolDetector.test.ts
            └── ToolExecutionManager.test.ts

tests/
└── e2e/
    ├── conversation-flow.test.ts
    └── multi-agent.test.ts
```

## Running Tests

### All Tests
```bash
bun test
```

### Watch Mode
```bash
bun test:watch
```

### Coverage Report
```bash
bun test:coverage
```

### Specific Test Types
```bash
# Unit tests only
bun test:unit

# Integration tests only
bun test:integration

# E2E tests only
bun test:e2e
```

### Run Specific Test File
```bash
bun test src/agents/__tests__/AgentRegistry.test.ts
```

### Run Tests Matching Pattern
```bash
bun test --pattern "conversation"
```

## Writing Tests

### Unit Tests

Unit tests focus on testing individual components in isolation:

```typescript
import { describe, it, expect, beforeEach, mock } from "bun:test";
import { AgentRegistry } from "../AgentRegistry";

describe("AgentRegistry", () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry("/test/project");
  });

  it("should register a new agent", async () => {
    const agent = await registry.ensureAgent("test", {
      name: "TestAgent",
      role: "Tester",
      // ...
    });

    expect(agent.name).toBe("TestAgent");
  });
});
```

### Integration Tests

Integration tests verify that multiple components work together:

```typescript
describe("AgentExecutor Integration Tests", () => {
  it("should execute agent with real LLM service", async () => {
    // Set up real components
    const llmService = new LLMService(configManager);
    const executor = new AgentExecutor(llmService, publisher);
    
    // Test interaction between components
    const result = await executor.execute(context);
    
    expect(result.success).toBe(true);
  });
});
```

### E2E Tests

End-to-end tests simulate real user scenarios:

```typescript
describe("Complete Conversation Flow", () => {
  it("should handle full conversation lifecycle", async () => {
    // Initialize system
    const system = await initializeTenexSystem();
    
    // Simulate user conversation
    const conversation = await system.startConversation("Build a web app");
    
    // Verify all phases complete
    expect(conversation.phase).toBe("review");
  });
});
```

## Test Utilities

### Mocks

Pre-built mocks are available in `src/test-utils/mocks/`:

```typescript
import { 
  createMockNDK, 
  createMockLLMService,
  createMockAgent,
  createConversationEvent 
} from "@/test-utils/mocks";

const mockNDK = createMockNDK();
const mockLLM = createMockLLMService("Default response");
```

### Fixtures

Common test data in `src/test-utils/helpers/fixtures.ts`:

```typescript
import { 
  createTestAgent, 
  createTestConversation,
  TEST_PROJECT_PATH 
} from "@/test-utils/helpers/fixtures";
```

### Assertions

Custom assertions in `src/test-utils/helpers/assertions.ts`:

```typescript
import { 
  assertConversationState,
  assertAgent,
  assertContains 
} from "@/test-utils/helpers/assertions";
```

## Coverage Goals

- **Unit Tests**: >80% coverage for business logic
- **Integration Tests**: Cover all major component interactions
- **E2E Tests**: Cover critical user paths

## Best Practices

1. **Test Naming**: Use descriptive names that explain what is being tested
   ```typescript
   it("should route conversation to developer agent when code help is requested", ...)
   ```

2. **Test Organization**: Group related tests using `describe` blocks
   ```typescript
   describe("ConversationManager", () => {
     describe("createConversation", () => {
       it("should create new conversation", ...);
       it("should handle missing title", ...);
     });
   });
   ```

3. **Setup and Teardown**: Use `beforeEach`/`afterEach` for test isolation
   ```typescript
   beforeEach(() => {
     // Reset state
   });
   
   afterEach(async () => {
     // Clean up resources
     await cleanup();
   });
   ```

4. **Mock External Dependencies**: Always mock external services
   ```typescript
   jest.mock("@tenex/shared/fs");
   ```

5. **Test Error Cases**: Include negative test cases
   ```typescript
   it("should handle network errors gracefully", async () => {
     mockService.setThrowError(new Error("Network error"));
     await expect(action()).rejects.toThrow("Network error");
   });
   ```

6. **Async Testing**: Properly handle async operations
   ```typescript
   it("should save asynchronously", async () => {
     const result = await manager.save();
     expect(result).toBeDefined();
   });
   ```

## Debugging Tests

### Run Single Test
```bash
bun test -t "should create conversation"
```

### Debug with Console Output
```bash
LOG_LEVEL=debug bun test
```

### VS Code Debugging

Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Bun Test",
  "program": "${workspaceFolder}/node_modules/.bin/bun",
  "args": ["test", "${file}"],
  "cwd": "${workspaceFolder}/tenex",
  "console": "integratedTerminal"
}
```

## Continuous Integration

Tests run automatically on:
- Pull requests
- Commits to main branch
- Release tags

See `.github/workflows/test.yml` for CI configuration.

## Troubleshooting

### Common Issues

1. **File System Errors in Tests**
   - Ensure proper cleanup in `afterEach`
   - Use temp directories for file operations

2. **Async Timeout Errors**
   - Increase timeout for slow operations: `it("test", async () => {}, 10000)`
   - Check for unresolved promises

3. **Mock Not Working**
   - Ensure mock is set up before importing tested module
   - Clear mocks between tests: `jest.clearAllMocks()`

4. **Coverage Not Accurate**
   - Ensure all source files are included
   - Check `bunfig.toml` coverage configuration