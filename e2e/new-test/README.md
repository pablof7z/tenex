# TENEX E2E Test Suite

This directory contains end-to-end tests for the TENEX system that simulate real user interactions.

## Tests

### full-user-flow.ts
A comprehensive test that:
1. Sets up a test environment with LLM credentials
2. Starts the TENEX daemon
3. Creates a new project via CLI
4. Starts the project orchestration
5. Connects to the project via chat interface
6. Creates a thread and sends messages to agents
7. Monitors agent responses and system behavior
8. Cleans up all processes and saves logs

### simple-test.ts
A simplified test that validates basic project creation flow.

## Running the Tests

```bash
# Run the full user flow test
bun run full-user-flow.ts

# Run the simple test
bun run simple-test.ts
```

## Test Configuration

The tests use real OpenRouter credentials for LLM interactions:
- Provider: openrouter
- Model: deepseek/deepseek-chat-v3-0324

## Test Workspace

Each test run creates an isolated workspace in `test-workspace/run-{timestamp}/` containing:
- `.tenex/` - Global configuration including LLM credentials
- `projects/` - Created test projects
- `logs/` - Process output logs for debugging

## Key Features

- **Real Process Spawning**: Tests spawn actual `tenex` and `cli-client` processes
- **Interactive CLI Control**: Simulates user input through stdin/stdout
- **Event Monitoring**: Tracks Nostr events and agent interactions
- **Comprehensive Logging**: All process outputs are captured for debugging
- **Automatic Cleanup**: Processes are terminated and logs archived after tests

## Current Status

The E2E test successfully demonstrates:
- ✅ Daemon startup with credential configuration
- ✅ Project creation and initialization
- ✅ Project orchestration startup
- ✅ CLI chat interface connection
- ✅ Thread creation and agent messaging
- ✅ Agent response generation via LLM
- ✅ End-to-end event flow through Nostr

## Future Improvements

- Add tests for agent tool execution (file creation, etc.)
- Test multi-agent conversations
- Test error scenarios and recovery
- Add performance benchmarks
- Test different LLM providers