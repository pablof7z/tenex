# Orchestrator Testing Guide

## Testing Philosophy

Every component in the orchestration system must be tested at three levels:
1. **Unit Tests**: Test individual methods with all dependencies mocked
2. **Integration Tests**: Test module interactions with real implementations
3. **End-to-End Tests**: Test complete user flows with real Nostr events

## Test Structure

```
tenex/src/core/
├── orchestration/
│   └── __tests__/
│       ├── unit/
│       │   ├── TeamOrchestrator.test.ts
│       │   ├── TeamFormationAnalyzer.test.ts
│       │   └── strategies/
│       ├── integration/
│       │   ├── orchestration.integration.test.ts
│       │   └── team-formation.integration.test.ts
│       └── fixtures/
│           ├── agents.ts
│           ├── events.ts
│           └── teams.ts
```

## Unit Test Examples

### Testing TeamOrchestrator

```typescript
// TeamOrchestrator.test.ts
import { TeamOrchestratorImpl } from '../TeamOrchestrator';
import { TeamFormationError } from '../errors';
import { createMockAnalyzer, createMockLLMProvider } from './mocks';
import { 
  createTestEvent, 
  createTestAgents, 
  createTestContext 
} from './fixtures';

describe('TeamOrchestrator', () => {
  let orchestrator: TeamOrchestratorImpl;
  let mockAnalyzer: jest.Mocked<TeamFormationAnalyzer>;
  let mockLLMProvider: jest.Mocked<LLMProvider>;
  let mockLogger: jest.Mocked<Logger>;
  
  beforeEach(() => {
    mockAnalyzer = createMockAnalyzer();
    mockLLMProvider = createMockLLMProvider();
    mockLogger = createMockLogger();
    
    orchestrator = new TeamOrchestratorImpl(
      mockAnalyzer,
      mockLLMProvider,
      mockLogger,
      defaultTestConfig
    );
  });
  
  describe('analyzeAndFormTeam', () => {
    it('should form a team with appropriate members based on analysis', async () => {
      // Arrange
      const event = createTestEvent('Build a search feature with autocomplete');
      const availableAgents = createTestAgents([
        { name: 'frontend-expert', role: 'UI/UX specialist' },
        { name: 'backend-engineer', role: 'API developer' },
        { name: 'database-admin', role: 'Query optimization' }
      ]);
      
      mockAnalyzer.analyzeRequest.mockResolvedValue({
        requestType: 'feature implementation',
        requiredCapabilities: ['frontend', 'backend', 'database'],
        estimatedComplexity: 7,
        suggestedStrategy: OrchestrationStrategy.HIERARCHICAL,
        reasoning: 'Complex feature requiring frontend UI, backend API, and efficient queries'
      });
      
      mockLLMProvider.complete.mockResolvedValue({
        content: JSON.stringify({
          team: {
            lead: 'frontend-expert',
            members: ['frontend-expert', 'backend-engineer', 'database-admin'],
            reasoning: 'Frontend lead since user-facing feature'
          }
        })
      });
      
      // Act
      const team = await orchestrator.analyzeAndFormTeam(
        event,
        availableAgents,
        createTestContext()
      );
      
      // Assert
      expect(team).toMatchObject({
        lead: 'frontend-expert',
        members: expect.arrayContaining([
          'frontend-expert',
          'backend-engineer',
          'database-admin'
        ]),
        strategy: OrchestrationStrategy.HIERARCHICAL,
        taskDefinition: expect.objectContaining({
          description: expect.stringContaining('search feature'),
          requiresGreenLight: true
        })
      });
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Team formed',
        expect.objectContaining({
          teamSize: 3,
          lead: 'frontend-expert',
          strategy: 'hierarchical'
        })
      );
    });
    
    it('should throw TeamFormationError when no suitable agents available', async () => {
      // Arrange
      const event = createTestEvent('Implement quantum encryption');
      const availableAgents = createTestAgents([
        { name: 'frontend-expert', role: 'UI/UX specialist' },
        { name: 'backend-engineer', role: 'API developer' }
      ]);
      
      mockAnalyzer.analyzeRequest.mockResolvedValue({
        requestType: 'security feature',
        requiredCapabilities: ['quantum-computing', 'cryptography'],
        estimatedComplexity: 10,
        suggestedStrategy: OrchestrationStrategy.PHASED_DELIVERY,
        reasoning: 'Requires specialized quantum knowledge'
      });
      
      // Act & Assert
      await expect(
        orchestrator.analyzeAndFormTeam(event, availableAgents, createTestContext())
      ).rejects.toThrow(TeamFormationError);
      
      await expect(
        orchestrator.analyzeAndFormTeam(event, availableAgents, createTestContext())
      ).rejects.toThrow('No suitable agents found');
    });
    
    it('should handle LLM failure gracefully', async () => {
      // Arrange
      const event = createTestEvent('Fix the bug');
      mockAnalyzer.analyzeRequest.mockRejectedValue(
        new Error('LLM service unavailable')
      );
      
      // Act & Assert
      await expect(
        orchestrator.analyzeAndFormTeam(event, new Map(), createTestContext())
      ).rejects.toThrow('LLM service unavailable');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Team formation failed',
        expect.objectContaining({
          error: 'LLM service unavailable'
        })
      );
    });
  });
});
```

### Testing SupervisionSystem

```typescript
// SupervisionSystem.test.ts
describe('SupervisionSystem', () => {
  let supervisionSystem: SupervisionSystemImpl;
  let mockMilestoneTracker: jest.Mocked<MilestoneTracker>;
  let mockDecisionMaker: jest.Mocked<SupervisorDecisionMaker>;
  
  beforeEach(() => {
    mockMilestoneTracker = createMockMilestoneTracker();
    mockDecisionMaker = createMockDecisionMaker();
    
    supervisionSystem = new SupervisionSystemImpl(
      mockMilestoneTracker,
      mockDecisionMaker,
      new ComplexToolsRegistry(['claude_code', 'database_migration'])
    );
  });
  
  describe('shouldSupervise', () => {
    it('should require supervision for complex tools', () => {
      const milestone: Milestone = {
        id: 'test-123',
        type: 'tool_completion',
        agentName: 'backend-engineer',
        toolName: 'claude_code',
        timestamp: Date.now(),
        context: {}
      };
      
      expect(supervisionSystem.shouldSupervise(milestone)).toBe(true);
    });
    
    it('should not require supervision for simple tools', () => {
      const milestone: Milestone = {
        id: 'test-456',
        type: 'tool_completion',
        agentName: 'backend-engineer',
        toolName: 'read_file',
        timestamp: Date.now(),
        context: {}
      };
      
      expect(supervisionSystem.shouldSupervise(milestone)).toBe(false);
    });
    
    it('should respect explicit supervision requests', () => {
      const milestone: Milestone = {
        id: 'test-789',
        type: 'checkpoint',
        agentName: 'frontend-expert',
        timestamp: Date.now(),
        context: {},
        explicitSupervisionRequest: true
      };
      
      expect(supervisionSystem.shouldSupervise(milestone)).toBe(true);
    });
  });
  
  describe('requestSupervision', () => {
    it('should approve good work', async () => {
      const milestone = createTestMilestone('claude_code', {
        output: 'Successfully implemented search feature'
      });
      
      const supervisor = createMockAgent('team-lead');
      
      mockDecisionMaker.makeDecision.mockResolvedValue({
        action: 'approve',
        confidence: 0.9,
        notes: 'Implementation looks good'
      });
      
      const decision = await supervisionSystem.requestSupervision(
        milestone,
        supervisor
      );
      
      expect(decision.action).toBe('approve');
      expect(mockMilestoneTracker.record).toHaveBeenCalledWith(
        milestone,
        decision
      );
    });
    
    it('should intervene when issues detected', async () => {
      const milestone = createTestMilestone('claude_code', {
        output: 'Deleted important files'
      });
      
      mockDecisionMaker.makeDecision.mockResolvedValue({
        action: 'intervene',
        feedback: 'Stop! You are deleting critical files',
        suggestions: ['Restore deleted files', 'Review the requirements'],
        confidence: 0.95
      });
      
      const decision = await supervisionSystem.requestSupervision(
        milestone,
        createMockAgent('team-lead')
      );
      
      expect(decision.action).toBe('intervene');
      expect(decision.feedback).toContain('deleting critical files');
    });
  });
});
```

### Testing ReflectionSystem

```typescript
// ReflectionSystem.test.ts
describe('ReflectionSystem', () => {
  let reflectionSystem: ReflectionSystemImpl;
  let mockDetector: jest.Mocked<CorrectionDetector>;
  let mockLessonGenerator: jest.Mocked<LessonGenerator>;
  let mockLessonPublisher: jest.Mocked<LessonPublisher>;
  
  describe('checkForReflection', () => {
    it('should trigger reflection on user correction', async () => {
      const event = createTestEvent("No, that's wrong. The API should use POST not GET");
      const conversation = createTestConversation({
        team: createTestTeam(['backend-engineer', 'frontend-expert'])
      });
      
      mockDetector.isCorrection.mockResolvedValue({
        isCorrection: true,
        confidence: 0.85,
        issues: ['Wrong HTTP method used']
      });
      
      const trigger = await reflectionSystem.checkForReflection(
        event,
        conversation
      );
      
      expect(trigger).toMatchObject({
        triggerEvent: event,
        conversation,
        team: expect.objectContaining({
          members: ['backend-engineer', 'frontend-expert']
        }),
        detectedIssues: ['Wrong HTTP method used']
      });
    });
    
    it('should not trigger on normal conversation', async () => {
      const event = createTestEvent("Great work! Now let's add authentication");
      
      mockDetector.isCorrection.mockResolvedValue({
        isCorrection: false,
        confidence: 0.1
      });
      
      const trigger = await reflectionSystem.checkForReflection(
        event,
        createTestConversation()
      );
      
      expect(trigger).toBeNull();
    });
  });
  
  describe('orchestrateReflection', () => {
    it('should generate and deduplicate lessons', async () => {
      const trigger = createTestReflectionTrigger();
      
      mockLessonGenerator.generateLessons.mockResolvedValue([
        {
          agentName: 'backend-engineer',
          ndkAgentEventId: 'ndk-backend-123',
          lesson: 'Always use proper HTTP methods: POST for creation',
          confidence: 0.9,
          context: {}
        },
        {
          agentName: 'frontend-expert',
          ndkAgentEventId: 'ndk-frontend-456',
          lesson: 'Verify API requirements before implementation',
          confidence: 0.8,
          context: {}
        }
      ]);
      
      mockLessonGenerator.deduplicateLessons.mockImplementation(
        async (lessons) => lessons // No duplicates
      );
      
      const result = await reflectionSystem.orchestrateReflection(trigger);
      
      expect(result.lessonsGenerated).toBe(2);
      expect(mockLessonPublisher.publishLesson).toHaveBeenCalledTimes(2);
    });
  });
});
```

## Integration Test Examples

```typescript
// orchestration.integration.test.ts
describe('Orchestration Integration', () => {
  let coordinator: OrchestrationCoordinator;
  let conversationStorage: ConversationStorage;
  let testDb: Database;
  
  beforeAll(async () => {
    testDb = await createTestDatabase();
  });
  
  beforeEach(async () => {
    await testDb.clear();
    conversationStorage = new ConversationStorageImpl(testDb);
    
    // Use real implementations with test configuration
    const testLLM = new TestLLMProvider(); // Returns predictable responses
    
    coordinator = new OrchestrationCoordinator(
      new TeamOrchestratorImpl(
        new TeamFormationAnalyzerImpl(testLLM, new PromptBuilder()),
        testLLM,
        new ConsoleLogger(),
        testOrchestrationConfig
      ),
      new SupervisionSystemImpl(
        new MilestoneTrackerImpl(testDb),
        new SupervisorDecisionMakerImpl(testLLM),
        new ComplexToolsRegistry(testComplexTools)
      ),
      new ReflectionSystemImpl(
        new CorrectionDetectorImpl(testLLM),
        new LessonGeneratorImpl(testLLM),
        new MockLessonPublisher(), // Don't publish to real Nostr
        conversationStorage
      ),
      new GreenLightSystemImpl(
        new ReviewCoordinatorImpl(),
        new ReviewAggregatorImpl()
      ),
      conversationStorage
    );
  });
  
  it('should handle complete team formation flow', async () => {
    // Create a user event
    const event = createTestNDKEvent({
      content: 'Build a user authentication system',
      kind: 11
    });
    
    const context: EventContext = {
      conversationId: 'conv-123',
      hasPTags: false,
      availableAgents: new Map([
        ['security-expert', { 
          name: 'security-expert',
          role: 'Security and authentication specialist',
          instructions: 'Focus on secure implementations'
        }],
        ['backend-engineer', {
          name: 'backend-engineer',
          role: 'Backend API developer',
          instructions: 'Build scalable APIs'
        }],
        ['database-admin', {
          name: 'database-admin',
          role: 'Database design and optimization',
          instructions: 'Design efficient schemas'
        }]
      ]),
      projectContext: {
        title: 'Test Project',
        repository: 'https://github.com/test/project'
      }
    };
    
    // Process the event
    await coordinator.handleUserEvent(event, context);
    
    // Verify team was formed and saved
    const conversation = await conversationStorage.getConversation('conv-123');
    const team = conversation.getMetadata('team');
    
    expect(team).toBeDefined();
    expect(team.members).toContain('security-expert');
    expect(team.lead).toBe('security-expert'); // Security should lead auth
    expect(team.taskDefinition).toMatchObject({
      description: expect.stringContaining('authentication'),
      requiresGreenLight: true,
      successCriteria: expect.arrayContaining([
        expect.stringContaining('secure')
      ])
    });
  });
  
  it('should handle supervision flow', async () => {
    // Setup a team with supervisor
    const team = createTestTeam(['developer', 'team-lead']);
    const conversation = createTestConversation({ team });
    await conversationStorage.saveConversation(conversation);
    
    // Developer completes complex operation
    const milestone: Milestone = {
      id: 'milestone-123',
      type: 'tool_completion',
      agentName: 'developer',
      toolName: 'claude_code',
      output: 'Implemented new feature',
      timestamp: Date.now(),
      context: {}
    };
    
    // Supervisor reviews
    const supervisor = createTestAgent('team-lead');
    const decision = await coordinator.supervisionSystem
      .requestSupervision(milestone, supervisor);
    
    expect(decision).toBeDefined();
    expect(['approve', 'intervene', 'abort']).toContain(decision.action);
  });
});
```

## End-to-End Test Examples

```typescript
// e2e/team-orchestration.e2e.test.ts
describe('Team Orchestration E2E', () => {
  let testEnv: TestEnvironment;
  
  beforeAll(async () => {
    testEnv = await setupE2EEnvironment({
      agents: ['frontend', 'backend', 'tester'],
      llmConfig: 'test-model'
    });
  });
  
  afterAll(async () => {
    await testEnv.cleanup();
  });
  
  it('should orchestrate team for feature request', async () => {
    // User publishes request
    const requestEvent = await testEnv.publishUserEvent(
      'Add a shopping cart feature to the website'
    );
    
    // Wait for team formation and first response
    const firstResponse = await testEnv.waitForEvent({
      kinds: [1111],
      '#e': [requestEvent.id],
      timeout: 30000
    });
    
    // Verify team announcement
    expect(firstResponse.content).toMatch(
      /I'll work on this with|team|collaborate/i
    );
    
    // Verify conversation has team
    const conversation = await testEnv.getConversation(requestEvent.id);
    expect(conversation.metadata.team).toBeDefined();
    expect(conversation.metadata.team.members.length).toBeGreaterThan(1);
    
    // Verify multiple agents are participating
    const responses = await testEnv.waitForEvents({
      kinds: [1111],
      '#e': [requestEvent.id],
      limit: 5,
      timeout: 60000
    });
    
    const uniqueAuthors = new Set(responses.map(r => r.pubkey));
    expect(uniqueAuthors.size).toBeGreaterThan(1);
  });
  
  it('should trigger reflection on correction', async () => {
    // Setup: Team implements something
    const { conversation, team } = await testEnv.simulateTeamWork(
      'Add user login',
      ['backend-engineer', 'security-expert']
    );
    
    // User provides correction
    const correctionEvent = await testEnv.publishUserEvent(
      "That's not secure - you're storing passwords in plain text!",
      { replyTo: conversation.id }
    );
    
    // Wait for reflection to complete
    await testEnv.waitForCondition(
      () => testEnv.getLessonEvents(team.members),
      lessons => lessons.length > 0,
      60000
    );
    
    // Verify lessons were created
    const lessons = await testEnv.getLessonEvents(team.members);
    expect(lessons.length).toBeGreaterThan(0);
    expect(lessons[0].kind).toBe(4124);
    expect(lessons[0].content).toMatch(/password|security|hash/i);
  });
  
  it('should handle green light review process', async () => {
    // Setup: Team completes feature
    const { conversation, team } = await testEnv.simulateTeamWork(
      'Implement search functionality',
      ['frontend-expert', 'backend-engineer', 'database-admin']
    );
    
    // Team lead initiates review
    const reviewRequest = await testEnv.publishAgentEvent(
      team.lead,
      'Implementation complete. Initiating review process.',
      { replyTo: conversation.id }
    );
    
    // Wait for review responses
    const reviews = await testEnv.waitForEvents({
      kinds: [1111],
      '#e': [reviewRequest.id],
      authors: team.members,
      timeout: 300000 // 5 minutes
    });
    
    // Verify all reviewers responded
    expect(reviews.length).toBe(team.members.length - 1); // Minus lead
    
    // Check for green lights
    const greenLights = reviews.filter(r => 
      r.content.includes('✅') || r.content.match(/green light/i)
    );
    
    expect(greenLights.length).toBeGreaterThan(0);
  });
});
```

## Test Utilities

```typescript
// test-utils/factories.ts
export function createTestTeam(members: string[], overrides?: Partial<Team>): Team {
  return {
    id: generateTestId(),
    conversationId: generateTestId(),
    lead: members[0],
    members,
    strategy: OrchestrationStrategy.HIERARCHICAL,
    formation: {
      timestamp: Date.now(),
      reasoning: 'Test team formation',
      requestAnalysis: createTestAnalysis()
    },
    ...overrides
  };
}

export function createTestAgent(name: string): Agent {
  const agent = new Agent(
    name,
    `nsec1test${name}`,
    '/test/project',
    new TestConversationStorage(),
    new TestToolRegistry()
  );
  
  agent.setConfig({
    name,
    description: `Test ${name} agent`,
    role: `${name} role`,
    instructions: `${name} instructions`
  });
  
  return agent;
}

// test-utils/assertions.ts
export function expectTeamToBeValid(team: Team): void {
  expect(team.id).toBeTruthy();
  expect(team.conversationId).toBeTruthy();
  expect(team.members).toContain(team.lead);
  expect(team.members.length).toBeGreaterThan(0);
  expect(Object.values(OrchestrationStrategy)).toContain(team.strategy);
}

export function expectSupervisionDecisionToBeValid(
  decision: SupervisionDecision
): void {
  expect(['approve', 'intervene', 'abort']).toContain(decision.action);
  expect(decision.confidence).toBeGreaterThan(0);
  expect(decision.confidence).toBeLessThanOrEqual(1);
  
  if (decision.action === 'intervene') {
    expect(decision.feedback).toBeTruthy();
  }
}
```

## Testing Best Practices

1. **Test Data Builders**: Use the builder pattern for complex test data
2. **Deterministic Tests**: Use seeded random values and fixed timestamps
3. **Test Isolation**: Each test should be completely independent
4. **Clear Assertions**: Test one behavior per test case
5. **Meaningful Names**: Test names should describe the scenario and expected outcome
6. **Performance Tests**: Include tests that verify performance budgets
7. **Error Scenarios**: Test error paths as thoroughly as happy paths

## Performance Testing

```typescript
// performance/orchestration.perf.test.ts
describe('Orchestration Performance', () => {
  it('should form team within performance budget', async () => {
    const start = Date.now();
    
    await orchestrator.analyzeAndFormTeam(
      testEvent,
      largeAgentSet, // 20+ agents
      testContext
    );
    
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(PERFORMANCE_BUDGETS.teamFormation.p95);
  });
  
  it('should handle concurrent team formations', async () => {
    const requests = Array.from({ length: 10 }, (_, i) => 
      createTestEvent(`Request ${i}`)
    );
    
    const start = Date.now();
    
    await Promise.all(
      requests.map(event => 
        orchestrator.analyzeAndFormTeam(event, testAgents, testContext)
      )
    );
    
    const duration = Date.now() - start;
    const avgDuration = duration / requests.length;
    
    expect(avgDuration).toBeLessThan(PERFORMANCE_BUDGETS.teamFormation.p50);
  });
});
```