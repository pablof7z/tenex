# TENEX E2E Test Guide

This guide explains the end-to-end (E2E) testing strategy for the TENEX system.

## Overview

The E2E tests verify the complete workflow of TENEX, from project creation through multi-agent collaboration. These tests simulate real-world usage patterns and ensure all components work together correctly.

## Test Structure

### 1. **complete-workflow.test.ts**
Tests the full TENEX workflow from start to finish:
- Project creation via Nostr (simulating web client)
- Daemon startup and event monitoring
- Task creation and agent processing
- Multi-agent collaboration
- Error handling and recovery

### 2. **cli-client-integration.test.ts**
Tests the CLI client integration with the system:
- Project creation via cli-client
- Chat thread creation
- Agent responses and typing indicators
- Error handling for invalid inputs

### 3. **full-flow.test.ts** (existing)
Tests the basic project flow:
- Direct project creation via Nostr
- Daemon spawning project processes
- Chat and task handling

### 4. **error-scenarios.test.ts** (existing)
Tests error handling scenarios:
- Missing configuration files
- Invalid project structures

## Running E2E Tests

### Quick Start
```bash
cd tenex
./tests/e2e/run-e2e-tests.sh
```

### Individual Tests
```bash
# Run all e2e tests
bun test tests/e2e/*.test.ts

# Run specific test file
bun test tests/e2e/complete-workflow.test.ts

# Run with verbose output
bun test tests/e2e/*.test.ts --verbose
```

### Test Timeout
E2E tests have extended timeouts (60-120 seconds) to accommodate:
- Nostr event propagation delays
- Daemon initialization
- Agent processing time
- Multi-agent collaboration

## Test Environment

### Prerequisites
1. Bun runtime installed
2. Network connectivity (tests use real Nostr relays)
3. Write permissions in test directory

### Test Isolation
- Each test creates unique project identifiers with timestamps
- Test data is cleaned up after each run
- Separate NDK instances for test isolation

### Relays
Tests use public relays for realistic conditions:
- wss://relay.damus.io
- wss://nos.lol

## Key Test Patterns

### 1. Project Creation
```typescript
const projectEvent = new NDKArticle(ndk);
projectEvent.kind = EVENT_KINDS.PROJECT;
projectEvent.dTag = projectIdentifier;
projectEvent.title = "Test Project";
await projectEvent.sign();
await projectEvent.publish();
```

### 2. Daemon Management
```typescript
daemonProcess = spawn("bun", ["run", CLI_PATH, "daemon", "--whitelist", ownerPubkey]);
await waitForOutput(daemonProcess, "TENEX daemon is running", 15000);
```

### 3. Event Verification
```typescript
const events = await fetchProjectStatusEvents(projectNaddr);
expect(events.length).toBeGreaterThan(0);
```

### 4. Agent Interaction
```typescript
const chatEvents = await fetchChatEvents(projectNaddr);
const agentMessages = chatEvents.filter(event => event.pubkey !== ownerPubkey);
expect(agentMessages.length).toBeGreaterThan(0);
```

## Common Issues and Solutions

### Issue: Tests timeout
**Solution**: Increase timeout values or check network connectivity

### Issue: Daemon doesn't start
**Solution**: Check for port conflicts or existing daemon processes

### Issue: No agent responses
**Solution**: Verify whitelisted pubkeys and event propagation time

### Issue: Test cleanup fails
**Solution**: Manually remove test-e2e-temp directory

## Writing New E2E Tests

### Template Structure
```typescript
describe("Feature Name", () => {
    test("should do something", async () => {
        // 1. Setup - Create project/events
        // 2. Action - Trigger behavior
        // 3. Wait - Allow propagation/processing
        // 4. Verify - Check expected outcomes
        // 5. Cleanup - Handled by afterAll
    }, TEST_TIMEOUT);
});
```

### Best Practices
1. Use descriptive console.log statements
2. Allow sufficient wait times for Nostr propagation
3. Clean up resources in afterAll hooks
4. Use unique identifiers with timestamps
5. Verify both positive and negative cases

## Debugging E2E Tests

### Enable Verbose Logging
```bash
DEBUG=* bun test tests/e2e/complete-workflow.test.ts
```

### Inspect Process Output
Tests capture and log process output:
```typescript
[Process Output] Starting daemon...
[Process Output] TENEX daemon is running
```

### Check Test Artifacts
Failed tests may leave artifacts in:
- `test-e2e-temp/` - Temporary test files
- Process logs in console output

## CI/CD Integration

E2E tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run E2E Tests
  run: |
    cd tenex
    bun install
    bun test tests/e2e/*.test.ts
  timeout-minutes: 10
```

## Maintenance

### Regular Updates
- Update test relays if they become unreliable
- Adjust timeouts based on system performance
- Add new test cases for new features

### Performance Monitoring
- Track test execution times
- Identify slow tests for optimization
- Consider parallel execution for faster runs