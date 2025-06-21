# TENEX E2E Test Suite

This directory contains end-to-end tests for the TENEX system, testing the full user flow from account creation to agent interaction.

## Test Files

### `web-client-full-flow.ts` ⭐ COMPLETE E2E TEST
A comprehensive E2E test that validates the entire TENEX workflow from web client to built application:

1. **Account Creation/Login**: Creates a new Nostr account through the web UI
2. **Credential Setup**: Configures LLM credentials in both web client and daemon
3. **Daemon Integration**: Starts daemon with proper whitelist and .tenex/llms.json configuration
4. **Project Creation**: Creates a new project through the web interface
5. **Full Conversation Flow**: Guides the conversation through all TENEX phases:
   - **CHAT**: Gathering requirements for a simple web application
   - **PLAN**: Waiting for architectural plan creation
   - **EXECUTE**: Monitoring code generation and file creation
   - **REVIEW**: Verifying implementation validation
6. **Built Application**: Verifies actual files are created in the projects directory

#### Running the Web Client Test

```bash
# Normal run - test will start web client if needed
bun run e2e/web-client-full-flow.ts

# Debug mode - keeps browser open for manual exploration
bun run e2e/web-client-full-flow.ts --debug
```

The test will:
- Set up a clean workspace with daemon LLM configuration
- Launch web client if not already running
- Create/login to account and configure credentials
- Start daemon with proper whitelist
- Create project and guide through full conversation
- Verify the application is built in projects directory
- Save comprehensive logs, screenshots, and phase transitions

### Existing Tests

- `create-project.ts` - Tests project creation via CLI
- `agent-interaction.ts` - Tests agent communication
- `status-event-validation.ts` - Tests status event handling
- `new-test/full-user-flow.ts` - CLI-based E2E test

## Test Configuration

The tests use real credentials for OpenRouter:
```javascript
llmConfig: {
    provider: "openrouter",
    model: "deepseek/deepseek-chat-v3-0324",
    apiKey: "sk-or-v1-...", // Real API key
    baseUrl: "https://openrouter.ai/api/v1"
}
```

## Test Output

Each test run creates a timestamped workspace directory:
```
e2e/test-workspace/
└── web-run-[timestamp]/
    ├── logs/
    │   ├── daemon-output.log
    │   ├── daemon-errors.log
    │   └── web-client-output.log
    ├── projects/
    └── *.png (screenshots)
```

## Requirements

- Bun runtime
- Playwright (installed via npm/bun)
- Working TENEX installation
- Web client dependencies installed

## Tips for Running Tests

1. **Clean State**: Each test creates its own workspace, so tests don't interfere
2. **Debugging**: Screenshots are saved at key points for debugging failures
3. **Timeouts**: Adjust timeouts if running on slower systems
4. **Headless Mode**: Set `headless: true` in browser launch for CI environments