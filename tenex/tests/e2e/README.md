# E2E Test Guide

## Overview

The E2E tests validate the complete TENEX workflow including:
- Project creation and initialization
- Multi-agent orchestration
- Task execution and collaboration
- Real-time communication via Nostr

## Running E2E Tests

### Prerequisites

1. **Local Nostr Relay (Recommended)**
   
   To avoid rate limiting and proof-of-work requirements from public relays, it's recommended to run a local Nostr relay:
   
   ```bash
   # Using nostr-rs-relay (example)
   docker run -p 8080:8080 scsibug/nostr-rs-relay
   ```

2. **Environment Configuration**
   
   Set the test relay URLs:
   ```bash
   export TEST_RELAYS="wss://localhost:8080"
   ```
   
   Or use multiple relays:
   ```bash
   export TEST_RELAYS="wss://localhost:8080,wss://localhost:8081"
   ```

### Running Tests

```bash
# Run all e2e tests
cd tenex
bun test tests/e2e/

# Run specific test file
bun test tests/e2e/complete-workflow.test.ts

# Run with debug output
DEBUG=true bun test tests/e2e/
```

## Common Issues

### Rate Limiting Errors

If you see errors like:
- `rate-limited: you are noting too much`
- `pow: 28 bits needed`
- `NDKPublishError: Not enough relays received the event`

**Solution**: Use a local relay instead of public ones (see Prerequisites above).

### Test Timeouts

The e2e tests have a 120-second timeout. If tests are timing out:

1. Increase the timeout in the test file
2. Check that all processes are starting correctly
3. Ensure the local relay is running and accessible

### Process Management

The tests spawn multiple processes (daemon, project run). If tests fail to clean up:

```bash
# Kill any lingering tenex processes
pkill -f tenex
```

## Test Structure

Each e2e test follows this pattern:

1. **Setup**: Create test directory, generate keys, connect to Nostr
2. **Project Creation**: Publish project event to Nostr
3. **Daemon Start**: Launch daemon with whitelist
4. **Interaction**: Create tasks/chats, trigger agent actions
5. **Verification**: Check for expected events and responses
6. **Cleanup**: Stop processes, disconnect from Nostr

## Writing New E2E Tests

When adding new e2e tests:

1. Use the `publishWithRetry` helper for all event publishing
2. Add appropriate timeouts for async operations
3. Clean up all spawned processes in `afterAll`
4. Use descriptive console.log statements for debugging
5. Consider network delays and retry logic

## Debugging Tips

1. **Enable Debug Logging**:
   ```bash
   DEBUG=true bun test tests/e2e/
   ```

2. **Check Process Output**:
   Tests capture stdout/stderr from spawned processes. Check the logs for errors.

3. **Verify Nostr Events**:
   Use `fetchProjectStatusEvents` and similar helpers to verify events are published.

4. **Increase Timeouts**:
   If operations are slow, increase the timeout values in test files.