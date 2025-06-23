# TENEX E2E Testing Framework

An LLM-friendly end-to-end testing framework for TENEX that enables autonomous testing of the complete system workflow.

## Features

- **Zero Manual Intervention**: Tests run completely autonomously
- **Complete Isolation**: Each test run is hermetic and reproducible
- **LLM-Optimized API**: Declarative, typed, and self-documenting
- **Extensible**: Easy to add new test scenarios without modifying core

## Installation

```bash
# From the e2e-framework directory
bun install
bun run build
```

## Usage

### Using the CLI

```bash
# List available scenarios
bun run cli list

# Run a specific scenario
bun run cli run file-creation --api-key YOUR_API_KEY

# Run all scenarios
bun run cli run --api-key YOUR_API_KEY

# Use different LLM provider
bun run cli run --provider anthropic --model claude-3 --api-key YOUR_KEY

# Use specific Nostr identity (nsec)
bun run cli run brainstorming --nsec nsec1yourprivatekeyhere --api-key YOUR_KEY

# Or via environment variable
export TENEX_E2E_NSEC=nsec1yourprivatekeyhere
bun run cli run simple-brainstorming --api-key YOUR_KEY
```

### Writing Tests

```typescript
import { FileCreationScenario } from '@tenex/e2e-framework';

test('file creation', async () => {
  const scenario = new FileCreationScenario({
    llmConfig: {
      provider: 'openai',
      model: 'gpt-4',
      apiKey: process.env.OPENAI_API_KEY
    }
  });
  
  const result = await scenario.execute();
  expect(result.success).toBe(true);
});
```

### Creating Custom Scenarios

```typescript
import { BaseScenario } from '@tenex/e2e-framework';

export class MyScenario extends BaseScenario {
  name = 'My Test Scenario';
  description = 'Tests custom functionality';
  
  async run(): Promise<void> {
    // Create project
    const project = await this.orchestrator.createProject({
      name: 'test-project',
      agents: ['coder']
    });
    
    // Start conversation
    const conversation = await project.startConversation({
      message: 'Create a hello.js file'
    });
    
    // Wait for file
    await project.waitForFile('hello.js');
    
    // Assert content
    const content = await project.readFile('hello.js');
    expect(content).toContain('console.log');
  }
}
```

## Available Scenarios

- **file-creation**: Tests basic file creation by coder agent
- **multi-agent**: Tests collaboration between architect and coder agents  
- **build-mode**: Tests complex build mode activation and multi-file creation
- **error-handling**: Tests agent error handling and security refusals
- **brainstorming**: Tests realistic brainstorming with LLM-simulated user
- **phase-transition**: Tests chat -> planning -> building phase transitions
- **simple-brainstorming**: Tests brainstorming without external LLM APIs

## API Reference

### Orchestrator
Main entry point for test coordination.

### Project
Represents a TENEX project with methods for file operations and conversations.

### Conversation
Manages conversation flow with message sending and reply waiting.

### Assertions
Helper functions for common test assertions:
- `assertFileContains`
- `assertFileMatches`
- `assertReplyContains`
- `assertConversationCompletes`

## Requirements

- Bun runtime (>=1.0.0)
- Running TENEX daemon
- Valid LLM API credentials
- Access to Nostr relays