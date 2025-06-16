# Orchestrator Implementation Notes

## Critical Implementation Details

### 1. No Fallback Philosophy

**IMPORTANT**: The system must fail fast and clearly when orchestration cannot proceed. This is a deliberate design choice to:
- Prevent silent degradation of service
- Force proper error handling at the user interface level
- Make issues immediately visible during development
- Ensure the system operates as designed or not at all

```typescript
// WRONG - Do not do this:
try {
  team = await orchestrator.formTeam(event);
} catch (error) {
  // DO NOT fallback to default agent
  team = { lead: 'default', members: ['default'] }; // NO!
}

// CORRECT - Let errors propagate:
const team = await orchestrator.formTeam(event); // Throws on failure
// Handle error at UI level with clear user messaging
```

### 2. Dependency Injection Pattern

Every module MUST use constructor injection for ALL dependencies:

```typescript
// CORRECT pattern for all modules:
export class TeamOrchestratorImpl implements TeamOrchestrator {
  constructor(
    private readonly analyzer: TeamFormationAnalyzer,
    private readonly llmProvider: LLMProvider,
    private readonly logger: Logger,
    private readonly config: OrchestrationConfig
  ) {
    // Validate required dependencies
    if (!analyzer) throw new Error('TeamFormationAnalyzer is required');
    if (!llmProvider) throw new Error('LLMProvider is required');
    if (!logger) throw new Error('Logger is required');
    if (!config) throw new Error('OrchestrationConfig is required');
  }
}
```

### 3. Event-Driven Boundaries

Modules communicate through well-defined events, not direct method calls between systems:

```typescript
// Event bus for loose coupling
export interface OrchestrationEvent {
  type: OrchestrationEventType;
  timestamp: number;
  data: any;
}

export enum OrchestrationEventType {
  TEAM_FORMED = 'team_formed',
  SUPERVISION_REQUESTED = 'supervision_requested',
  REFLECTION_TRIGGERED = 'reflection_triggered',
  REVIEW_INITIATED = 'review_initiated'
}

// Example usage:
class OrchestrationEventBus {
  private handlers = new Map<OrchestrationEventType, Set<EventHandler>>();
  
  emit(event: OrchestrationEvent): void {
    const handlers = this.handlers.get(event.type);
    handlers?.forEach(handler => handler(event));
  }
  
  on(type: OrchestrationEventType, handler: EventHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
  }
}
```

### 4. Testing Boundaries

Each module must be testable at three levels:

#### Unit Tests (Isolated)
```typescript
// Mock ALL external dependencies
const mockAnalyzer = {
  analyzeRequest: jest.fn().mockResolvedValue(mockAnalysis)
};

const orchestrator = new TeamOrchestratorImpl(
  mockAnalyzer,
  mockLLMProvider,
  mockLogger,
  testConfig
);
```

#### Integration Tests (Module Interactions)
```typescript
// Use real implementations with test doubles for external services
const orchestrator = new TeamOrchestratorImpl(
  new TeamFormationAnalyzerImpl(testLLMProvider),
  testLLMProvider,
  new ConsoleLogger(),
  testConfig
);
```

#### E2E Tests (Full System)
```typescript
// Real Nostr events, real LLM calls (with test models)
const result = await publishAndWaitForTeamFormation(
  realNDK,
  realProject,
  'Implement search feature'
);
```

### 5. LLM Integration Patterns

**Critical**: The orchestrator should be LLM-agnostic. Use a provider pattern:

```typescript
export interface LLMProvider {
  complete(prompt: string, config?: LLMConfig): Promise<LLMResponse>;
  stream(prompt: string, config?: LLMConfig): AsyncGenerator<string>;
}

// Implementation can switch between providers:
class AnthropicLLMProvider implements LLMProvider { }
class OpenAILLMProvider implements LLMProvider { }
class LocalLLMProvider implements LLMProvider { } // For testing
```

### 6. State Management

**Important**: Orchestration state lives in conversation metadata, not in memory:

```typescript
// Conversation metadata structure:
interface ConversationMetadata {
  team?: Team;
  supervisionHistory?: SupervisionEvent[];
  reflectionTriggers?: ReflectionTrigger[];
  greenLightStatus?: ReviewStatus;
}

// Always persist state immediately:
conversation.setMetadata('team', team);
await conversationStorage.saveConversation(conversation);
```

### 7. Error Handling Hierarchy

Define clear error types for each module:

```typescript
// Base error for all orchestration errors
export abstract class OrchestrationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly recoverable: boolean
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

// Specific errors with clear semantics
export class NoSuitableAgentsError extends OrchestrationError {
  constructor(
    public readonly requiredCapabilities: string[],
    public readonly availableAgents: string[]
  ) {
    super(
      `No agents found with required capabilities: ${requiredCapabilities.join(', ')}`,
      'NO_SUITABLE_AGENTS',
      false // Not recoverable
    );
  }
}
```

### 8. Prompt Engineering Guidelines

Store prompts as separate, versioned templates:

```typescript
// prompts/orchestration/team-formation.v1.md
export const TEAM_FORMATION_PROMPT_V1 = `
You are analyzing a user request to determine optimal team composition.

## Available Agents
{{#each agents}}
- **{{name}}**: {{description}}
  Role: {{role}}
  Capabilities: {{instructions}}
{{/each}}

## User Request
{{request}}

## Analysis Required
1. What type of work is needed?
2. What specific capabilities are required?
3. Complexity assessment (1-10)
4. Which agents should form the team?
5. Who should lead and why?
6. What coordination strategy should they follow?

Provide structured JSON response.
`;
```

### 9. Performance Boundaries

Set explicit performance budgets:

```typescript
export const PERFORMANCE_BUDGETS = {
  teamFormation: {
    p50: 3000,  // 3 seconds median
    p95: 8000,  // 8 seconds 95th percentile
    max: 15000  // 15 seconds absolute max
  },
  supervision: {
    p50: 2000,
    p95: 5000,
    max: 10000
  },
  reflection: {
    p50: 5000,
    p95: 15000,
    max: 30000
  }
};

// Enforce with timeouts:
const team = await withTimeout(
  orchestrator.formTeam(event),
  PERFORMANCE_BUDGETS.teamFormation.max,
  new TeamFormationTimeoutError()
);
```

### 10. Module Initialization Order

Critical initialization sequence:

```typescript
// 1. Core infrastructure
const logger = new Logger(config.logging);
const eventBus = new OrchestrationEventBus();
const conversationStorage = new ConversationStorageImpl(db);

// 2. LLM providers
const llmProvider = new LLMProviderFactory().create(config.llm);

// 3. Analysis components
const analyzer = new TeamFormationAnalyzerImpl(llmProvider, promptBuilder);

// 4. Core systems (order matters!)
const orchestrator = new TeamOrchestratorImpl(analyzer, llmProvider, logger);
const supervisionSystem = new SupervisionSystemImpl(...);
const reflectionSystem = new ReflectionSystemImpl(...);
const greenLightSystem = new GreenLightSystemImpl(...);

// 5. Integration layer (depends on all systems)
const coordinator = new OrchestrationCoordinator(
  orchestrator,
  supervisionSystem,
  reflectionSystem,
  greenLightSystem,
  conversationStorage
);

// 6. Wire into existing system
const enhancedEventHandler = new TeamAwareAgentEventHandler(
  existingDependencies,
  coordinator
);
```

### 11. Feature Flags

Use feature flags for gradual rollout:

```typescript
export interface OrchestrationFeatureFlags {
  enableTeamFormation: boolean;
  enableSupervision: boolean;
  enableReflection: boolean;
  enableGreenLight: boolean;
  enabledProjects?: string[];  // Specific project IDs
}

// Check before using features:
if (featureFlags.enableTeamFormation && 
    (!featureFlags.enabledProjects || 
     featureFlags.enabledProjects.includes(projectId))) {
  await coordinator.handleUserEvent(event, context);
} else {
  // Use existing behavior
  await legacyHandler.handle(event);
}
```

### 12. Observability

Build in comprehensive logging and metrics:

```typescript
// Structured logging for every decision
logger.info('Team formation started', {
  eventId: event.id,
  conversationId,
  availableAgents: agents.size,
  requestLength: event.content.length
});

// Metrics for monitoring
metrics.increment('orchestration.team_formation.started');
metrics.timing('orchestration.team_formation.duration', duration);
metrics.gauge('orchestration.team_formation.team_size', team.members.length);

// Distributed tracing
const span = tracer.startSpan('orchestration.form_team');
try {
  const team = await orchestrator.formTeam(event);
  span.setTag('team.size', team.members.length);
  span.setTag('team.strategy', team.strategy);
  return team;
} finally {
  span.finish();
}
```

### 13. Data Migration

For existing conversations without teams:

```typescript
class TeamMigration {
  async migrateConversation(conversation: Conversation): Promise<void> {
    // Don't create teams retroactively
    // Mark as legacy
    conversation.setMetadata('orchestration_version', 'legacy');
    conversation.setMetadata('migration_checked', Date.now());
    await this.storage.save(conversation);
  }
}
```

### 14. Critical Integration Points

These are the ONLY places where the orchestration system touches existing code:

1. **AgentEventHandler Constructor** - Add optional `orchestrationCoordinator` parameter
2. **AgentEventHandler.determineRespondingAgents** - Add orchestration check when no agents selected
3. **ConversationStorage** - Extend metadata schema to store team information
4. **Agent.executeTool** - Add supervision hooks (if supervision is implemented)

```typescript
// Integration in AgentEventHandler.determineRespondingAgents:
// ORCHESTRATION_INTEGRATION: Team formation check
if (agentsToRespond.length === 0 && !isFromAgent && this.orchestrationCoordinator) {
  const team = await this.orchestrationCoordinator.formTeamForEvent(
    event,
    conversationId,
    await this.getAllAvailableAgents()
  );
  // Handle team formation...
}
```

### 15. Configuration Validation

Validate all configuration at startup:

```typescript
export class ConfigValidator {
  validate(config: OrchestrationConfig): ValidationResult {
    const errors: string[] = [];
    
    // Validate LLM configs exist
    if (!this.llmConfigs.has(config.orchestrator.llmConfig)) {
      errors.push(`LLM config '${config.orchestrator.llmConfig}' not found`);
    }
    
    // Validate complex tools are known
    for (const tool of config.supervision.complexTools) {
      if (!this.knownTools.has(tool)) {
        errors.push(`Unknown complex tool: ${tool}`);
      }
    }
    
    // Validate strategies
    const validStrategies = Object.values(OrchestrationStrategy);
    for (const strategy of Object.values(config.orchestrator.strategies)) {
      if (!validStrategies.includes(strategy)) {
        errors.push(`Invalid strategy: ${strategy}`);
      }
    }
    
    if (errors.length > 0) {
      throw new ConfigurationError(errors);
    }
    
    return { valid: true };
  }
}
```

## Common Pitfalls to Avoid

1. **Don't Share State Between Requests**
   - Each orchestration should be stateless
   - All state lives in conversation metadata

2. **Don't Assume Agent Availability**
   - Agents might be added/removed during conversation
   - Always check current availability

3. **Don't Block on Supervision**
   - Use timeouts for all supervision requests
   - Allow work to continue if supervisor doesn't respond

4. **Don't Over-Engineer Team Selection**
   - Let the LLM do the reasoning
   - Don't hard-code agent selection rules

5. **Don't Ignore Performance**
   - Monitor LLM call latency
   - Cache where appropriate
   - Use smaller models for simple decisions

## Development Checklist

- [x] All modules use constructor dependency injection
- [x] No circular dependencies between modules
- [x] Every public method has at least one test
- [ ] Integration tests cover happy path and error cases
- [ ] E2E tests verify actual Nostr event flow
- [ ] Performance budgets defined and monitored
- [ ] Feature flags control rollout
- [x] Metrics and logging implemented
- [x] Error handling is explicit (no silent failures)
- [ ] Configuration is validated at startup
- [ ] Documentation updated with implementation

## Implementation Progress

### Phase 1: Core Infrastructure (In Progress)

1. **Core types and interfaces** ✅
   - Created `types.ts` with all core types (Team, RequestAnalysis, TaskDefinition, etc.)
   - Created `errors.ts` with specific error types (TeamFormationError, SupervisionAbortError, etc.)
   - Created `supervision/types.ts` for supervision types
   - Fixed all TypeScript issues (no `any` types, proper type definitions)

2. **TeamOrchestrator** ✅
   - Created interface and implementation (`TeamOrchestrator.ts`, `TeamOrchestratorImpl`)
   - Full TDD with 3 passing tests
   - Proper dependency injection with validation
   - Error handling without fallbacks (fails fast as designed)
   - Logging at key points (team formation success/failure)
   - Generates unique team IDs
   - Validates team has members before returning

3. **TeamFormationAnalyzer** ✅
   - Interface created (`TeamFormationAnalyzer.ts`)
   - Implementation completed (`TeamFormationAnalyzerImpl.ts`)
   - Full TDD with 5 passing tests
   - Validates LLM response structure
   - Maps strategy strings to enums
   - Proper error messages for parse failures

4. **PromptBuilder** ✅
   - Interface created (`PromptBuilder.ts`)
   - Implementation completed (`PromptBuilderImpl.ts`)
   - Full TDD with 5 passing tests
   - Handles project context inclusion
   - Detects conversation context from event tags
   - Provides clear JSON format instructions
   - Includes all strategy options

### Code Quality

- All files pass biome linting
- No circular dependencies
- Constructor dependency injection throughout
- Comprehensive test coverage (13 tests, all passing)
- Clear separation of concerns

5. **OrchestrationCoordinator** ✅
   - Interface created with `OrchestrationResult` type
   - Implementation completed (`OrchestrationCoordinator.ts`)
   - Full TDD with 7 passing tests
   - Handles team formation flow
   - Saves teams to conversation metadata
   - Checks for existing teams
   - Respects p-tag logic (no team formation with mentions)

### Test Coverage Summary

- Total tests: 20 (all passing)
- Unit tests: 13
- Integration tests: 7
- All modules have 100% method coverage

6. **Adapters and Factory** ✅
   - Created `LLMProviderAdapter` to bridge orchestration and agent LLM interfaces
   - Created `ConsoleLoggerAdapter` for logging
   - Created `createOrchestrationCoordinator` factory function
   - Proper dependency injection throughout
   - All files pass biome linting

### Architecture Summary

The orchestration system is now complete with:
- **Core Components**: TeamOrchestrator, TeamFormationAnalyzer, PromptBuilder
- **Integration Layer**: OrchestrationCoordinator
- **Adapters**: LLM and Logger adapters to bridge with existing system
- **Factory**: Clean factory function for dependency injection

### File Structure
```
tenex/src/core/orchestration/
├── types.ts                    # Core types and interfaces
├── errors.ts                   # Custom error types
├── TeamOrchestrator.ts         # Main orchestration logic
├── TeamFormationAnalyzer.ts    # Request analysis
├── PromptBuilder.ts            # Prompt generation
├── adapters/
│   ├── LLMProviderAdapter.ts   # LLM interface adapter
│   └── ConsoleLoggerAdapter.ts # Logger adapter
├── integration/
│   └── OrchestrationCoordinator.ts # Coordination layer
├── supervision/
│   └── types.ts               # Supervision types (for future)
└── OrchestrationFactory.ts    # Factory function

tenex/src/core/orchestration/__tests__/
├── unit/
│   ├── TeamOrchestrator.test.ts
│   ├── TeamFormationAnalyzer.test.ts
│   └── PromptBuilder.test.ts
└── integration/
    └── OrchestrationCoordinator.test.ts
```

### Next Steps

1. Integrate with existing `AgentEventHandler`
2. Create the `TeamAwareAgentEventHandler` that extends the current one
3. Wire up the orchestrator in the project initialization
4. Add integration tests with real components