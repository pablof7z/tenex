# Comprehensive Test Plan for Tenex Backend Features

## 1. Execution Time Tracking Tests

### Unit Tests (`src/conversations/executionTime.test.ts`)
- **Basic Operations**
  - Test `startExecutionTime` creates correct structure
  - Test `stopExecutionTime` updates isActive flag
  - Test `getTotalExecutionTimeSeconds` calculates correctly
  - Test handling of undefined/null conversation objects

- **Edge Cases**
  - Multiple start/stop cycles accumulate time correctly
  - Overlapping sessions (start without stop) - should close previous session and start new one
  - Negative time values rejected (simulate via mocked Date.now())
  - Very large time values (>1 year) stored without overflow, flagged as suspicious
  - Boundary testing: reasonable execution times (1ms - 24 hours)

- **Crash Recovery**
  - Test stale session detection on startup
  - Test automatic closing of abandoned sessions
  - Test persistence across daemon restarts

### Integration Tests
- **AgentExecutor Integration**
  - Verify time tracking starts on execution begin
  - Verify time tracking stops on execution end
  - Verify time excludes user wait periods
  - Test handoff scenarios preserve timing
  - Test tool execution time included in total
  - Verify time tracking with multiple tool calls

- **Nostr Event Publishing**
  - Verify NET_TIME tag added to all event types:
    - Agent response events (kind 68001)
    - Tool execution events (kind 68002)
    - Phase transition events (kind 68003)
    - Handoff events (kind 68004)
  - Test tag format matches EXECUTION_TAGS.NET_TIME constant
  - Test tag value accuracy (matches getTotalExecutionTimeSeconds)
  - Verify persistence in conversation state

## 2. Learn Tool Tests

### Unit Tests (`src/tools/implementations/learn.test.ts`)
- **Parameter Validation**
  - Test required fields (title, lesson)
  - Test optional keywords array
  - Test schema validation errors
  - Test max length constraints:
    - Title: 1-100 characters
    - Lesson: 10-500 characters
    - Keywords: max 10, each 1-30 characters
  - Test keyword normalization (lowercase, trimmed)

- **Execution Logic**
  - Test successful lesson creation
  - Test missing agent signer handling
  - Test NDK unavailable scenario
  - Test event publishing failures

- **Event Creation**
  - Verify correct event structure
  - Test tag generation (project, phase, keywords)
  - Test execution time tag inclusion
  - Verify agent reference linking

### Integration Tests
- **ProjectContext Integration**
  - Test lesson storage in project context
  - Verify lesson retrieval by agent
  - Test cross-agent lesson visibility
  - Verify keyword indexing

- **Lesson Retrieval**
  - Test lesson appears in future prompts
  - Test keyword-based filtering:
    - Exact keyword match
    - Multiple keyword intersection
    - Case-insensitive matching
    - No matches returns empty set
  - Verify phase-specific retrieval
  - Test retrieval limits (max 10 lessons per prompt)

## 3. Lesson Metrics Tests

### Unit Tests (`src/utils/lessonMetrics.test.ts`)
- **Metric Calculations**
  - Test `calculateLessonMetrics` accuracy
  - Verify agent grouping logic
  - Test phase grouping logic
  - Verify keyword frequency counting
  - Test average length calculation

- **Edge Cases**
  - Empty lesson set handling
  - Malformed lesson data resilience:
    - Missing required fields (title, lesson)
    - Invalid tag structure
    - Non-string field types
    - Corrupted JSON
  - Missing metadata handling (agent name, phase)
  - Very large lesson sets performance (1000, 10000, 100000 lessons)
  - Measure calculation time, ensure < 100ms for 10k lessons

- **Logging Functions**
  - Test `logLessonMetrics` output format
  - Test `logLessonUsage` tracking
  - Test `logLessonCreationPattern` data

### Integration Tests
- **MetricsReporter**
  - Test periodic reporting schedule
  - Verify metrics accuracy over time
  - Test startup delay behavior
  - Verify graceful shutdown

## 4. Integration Tests Across Systems

### End-to-End Scenarios
1. **Complete Conversation Flow**
   - Start conversation → Track time → Learn lesson → Stop time → Report metrics
   - Verify all systems integrate correctly
   - Test data consistency across modules

2. **Crash Recovery Scenario**
   - Start conversation with active timing
   - Simulate crash
   - Restart and verify recovery
   - Check metrics accuracy post-recovery

3. **Multi-Agent Collaboration**
   - Agent A learns lesson
   - Handoff to Agent B
   - Verify B can access A's lessons
   - Verify timing continuity
   - Check metrics reflect both agents

4. **Phase Transitions**
   - Test lesson recording across phase changes
   - Verify phase-specific metrics
   - Test chores phase inventory updates

## 5. Performance Tests

- **High Volume** (Environment: 4GB RAM, 2 CPU cores)
  - Test with 1000+ lessons
  - Verify metrics calculation speed < 50ms
  - Test retrieval performance < 10ms
  - Memory usage stays under 500MB

- **Concurrent Operations**
  - Multiple agents learning simultaneously
  - Parallel conversation timing
  - Concurrent metric calculations

## 6. Error Handling & Resilience

- **Network Failures**
  - Test lesson publishing retry logic
  - Verify local caching during outages
  - Test metrics reporting fallbacks

- **Data Corruption**
  - Test recovery from corrupted lesson data:
    - Randomly modify JSON files on disk
    - Truncate files mid-write
    - Insert invalid UTF-8 sequences
  - Verify timing data validation
  - Test metrics calculation with bad data
  - Ensure system logs errors but continues operating

## Test Implementation Strategy

1. **Mocking Strategy**
   - Mock NDK for unit tests (avoid network calls)
   - Mock file system for persistence tests:
     - FileSystemAdapter read/write operations
     - Directory creation/deletion
   - Mock time functions (Date.now, setTimeout)
   - Mock LLM service to control outputs
   - Mock logger to verify error logging

2. **Test Data Fixtures**
   - Create sample conversations:
     - Different phases (ideation, planning, building)
     - Various durations (1s to 1hr)
     - With/without tool usage
   - Generate test lessons:
     - Programming topics (async, typescript, git)
     - Different agents (PM, dev-senior, reviewer)
     - Various keyword combinations
   - Edge case data sets:
     - Unicode characters in content
     - Very long/short content
     - Duplicate lessons

3. **Test Utilities**
   - Helper functions for creating test contexts
   - Time manipulation utilities
   - Assertion helpers for complex objects

4. **CI/CD Integration**
   - Run unit tests on every commit (must pass)
   - Integration tests on PR creation (must pass)
   - Performance tests weekly:
     - Alert if >10% degradation
     - Track average execution times
   - Metrics validation in staging:
     - Compare lesson counts pre/post deploy
     - Verify no data loss
     - Check metric calculation accuracy
   - Test coverage requirements:
     - Minimum 80% line coverage
     - 70% branch coverage
     - Critical paths 100% covered

## Test Prioritization

### Critical Path Tests (Must be implemented first)
1. **Execution Time Basic Operations** - Core functionality
2. **Learn Tool Parameter Validation** - Prevents bad data
3. **Crash Recovery for Active Sessions** - Data integrity
4. **Lesson Storage and Retrieval** - Core feature functionality
5. **NET_TIME Tag Publishing** - Observability requirement

### Secondary Priority
1. Integration tests across systems
2. Performance tests
3. Advanced error scenarios
4. Metrics reporting accuracy

## Test Execution Environment

- **Unit Tests**: Run in CI/CD environment (GitHub Actions)
- **Integration Tests**: Run in CI/CD with mocked external services
- **E2E Tests**: Staging environment with real Nostr relay
- **Performance Tests**: Dedicated performance testing environment