# TENEX Implementation Plan

## Global Context

### Project Runtime
The project is loaded once at startup and made available globally:
```typescript
// src/runtime/ProjectContext.ts
interface ProjectContext {
  projectEvent: NDKEvent
  projectSigner: NDKPrivateKeySigner
  agents: Map<string, Agent>
  projectPath: string
  title: string
  repository?: string
}

// Available via singleton or dependency injection
const projectContext = getProjectContext()
```

## Phase 1: Core Infrastructure

### 1.1 LLM Integration Layer
```typescript
// src/core/llm/MultiLLMService.ts
interface LLMService {
  complete(configName: string, messages: Message[]): Promise<LLMResponse>
  stream(configName: string, messages: Message[]): AsyncGenerator<StreamChunk>
}

// LLMResponse includes usage data for metadata tags
interface LLMResponse {
  content: string
  model: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  cost?: number
}

// src/core/llm/LLMServiceFactory.ts
interface LLMServiceFactory {
  createService(configService: ConfigurationService): MultiLLMService
  getEngine(provider: string): Engine
}
```

### 1.2 Agent Registry System
```typescript
// src/agents/AgentRegistry.ts
interface AgentRegistry {
  loadFromProject(projectPath: string): Promise<void>
  ensureAgent(name: string, config: AgentConfig): Promise<Agent>
  getAgent(name: string): Agent | undefined
  getAgentByPubkey(pubkey: string): Agent | undefined
}

// src/agents/Agent.ts
interface Agent {
  name: string
  pubkey: string
  signer: NDKPrivateKeySigner
  role: string
  expertise: string
  llmConfig: string
  tools: string[]
}
```

### 1.3 Phase Management
```typescript
// src/phases/PhaseManager.ts
interface PhaseManager {
  getCurrentPhase(conversationId: string): Phase
  transitionTo(conversationId: string, phase: Phase): Promise<void>
  getCompletionCriteria(phase: Phase): CompletionCriteria
}

// src/phases/types.ts
type Phase = 'chat' | 'plan' | 'execute' | 'review'
interface PhaseTransition {
  from: Phase
  to: Phase
  context: string // Compacted context
  timestamp: number
}
```

## Phase 2: Routing System

### 2.1 Routing LLM
```typescript
// src/routing/RoutingLLM.ts
interface RoutingLLM {
  routeNewConversation(event: NDKEvent): Promise<RoutingDecision>
  routeNextAction(conversation: Conversation): Promise<RoutingDecision>
  handleRoutingFailure(event: NDKEvent): Promise<RoutingDecision>
}

// src/routing/types.ts
interface RoutingDecision {
  phase: Phase
  nextAgent: string // pubkey
  reasoning?: string
}
```

### 2.2 Modular Prompt System
```typescript
// src/prompts/templates/routing.ts
export class RoutingPromptBuilder {
  static newConversation(args: RoutingPromptArgs): string {
    return new PromptBuilder()
      .add('base-context', { content: 'You are a routing system...' })
      .add('phase-descriptions', {})
      .add('agent-list', { agents, format: 'simple' })
      .add('json-response', { schema })
      .build();
  }
}

// src/prompts/fragments/common.ts
export const agentListFragment: PromptFragment<AgentListArgs> = {
  id: 'agent-list',
  template: ({ agents, format }) => {
    // Reusable agent list formatting
  }
};

// Usage across the system:
const prompt = new PromptBuilder()
  .add('agent-list', { agents: availableAgents })
  .add('tool-list', { tools: agentTools })
  .build();
```

### 2.3 Conversation Manager
```typescript
// src/conversations/ConversationManager.ts
interface ConversationManager {
  createConversation(event: NDKEvent): Promise<Conversation>
  getConversation(id: string): Conversation | undefined
  updatePhase(id: string, phase: Phase): Promise<void>
  compactHistory(id: string, targetPhase: Phase): Promise<string>
}

// src/conversations/types.ts
interface Conversation {
  id: string
  title: string
  phase: Phase
  history: NDKEvent[]
  currentAgent?: string
  metadata: Record<string, any>
}
```

## Phase 3: Event Processing

### 3.1 Phase Initialization System
```typescript
// src/phases/PhaseInitializer.ts
interface PhaseInitializer {
  initializePhase(
    phase: Phase,
    conversation: Conversation,
    projectContext: ProjectContext
  ): Promise<PhaseInitResult>
}

interface PhaseInitResult {
  action: 'publish' | 'execute_tool' | 'handoff'
  content?: string
  toolCall?: ToolCall
  nextAgent?: string
}

// src/phases/initializers/ChatPhaseInitializer.ts
class ChatPhaseInitializer {
  async initialize(conversation: Conversation): Promise<PhaseInitResult> {
    // Uses project nsec to reply to user
    return {
      action: 'publish',
      content: 'Hello! Let me understand what you want to build...'
    }
  }
}

// src/phases/initializers/PlanPhaseInitializer.ts
class PlanPhaseInitializer {
  async initialize(conversation: Conversation): Promise<PhaseInitResult> {
    // Triggers Claude Code CLI
    return {
      action: 'execute_tool',
      toolCall: {
        tool: 'claude',
        args: { prompt: buildPlanningPrompt(conversation) }
      }
    }
  }
}
```

### 3.2 Enhanced Event Handler
```typescript
// src/events/ConversationEventHandler.ts
class ConversationEventHandler extends EventHandler {
  private routingLLM: RoutingLLM
  private conversationManager: ConversationManager
  private agentRegistry: AgentRegistry
  private phaseInitializer: PhaseInitializer
  
  async handleConversation(event: NDKEvent): Promise<void>
  private async routeToAgent(pubkey: string, event: NDKEvent): Promise<void>
  private async publishResponse(response: AgentResponse): Promise<void>
}
```

### 3.3 Nostr Publisher
```typescript
// src/nostr/ConversationPublisher.ts
class ConversationPublisher {
  constructor(
    private projectContext: ProjectContext,
    private ndk: NDK
  ) {}

  async publishAgentResponse(
    eventToReply: NDKEvent,
    content: string,
    nextAgent: string,
    llmMetadata?: LLMMetadata
  ): Promise<NDKEvent> {
    const reply = eventToReply.reply()
    
    // Remove existing p-tags and add next responder
    reply.tags = reply.tags.filter(tag => tag[0] !== 'p')
    reply.tag(['p', nextAgent])
    
    // Tag the project
    reply.tag(this.projectContext.projectEvent)
    
    // Add LLM metadata if present
    if (llmMetadata) {
      reply.tag(['llm-model', llmMetadata.model])
      reply.tag(['llm-cost-usd', llmMetadata.cost.toString()])
      reply.tag(['llm-prompt-tokens', llmMetadata.promptTokens.toString()])
      reply.tag(['llm-completion-tokens', llmMetadata.completionTokens.toString()])
      reply.tag(['llm-total-tokens', llmMetadata.totalTokens.toString()])
      if (llmMetadata.systemPromptHash) {
        reply.tag(['llm-system-prompt', llmMetadata.systemPromptHash])
      }
      if (llmMetadata.userPromptHash) {
        reply.tag(['llm-user-prompt', llmMetadata.userPromptHash])
      }
    }
    
    reply.content = content
    await reply.publish()
    return reply
  }
  
  async publishPhaseTransition(
    conversation: Conversation,
    newPhase: Phase,
    context: string
  ): Promise<NDKEvent>
}

interface LLMMetadata {
  model: string
  cost: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  systemPromptHash?: string
  userPromptHash?: string
}
```

## Phase 4: Agent Execution

### 4.1 Agent Executor
```typescript
// src/agents/AgentExecutor.ts
interface AgentExecutor {
  execute(agent: Agent, event: NDKEvent, context: AgentContext): Promise<AgentResponse>
  handleToolCalls(agent: Agent, toolCalls: ToolCall[]): Promise<ToolResult[]>
}

// src/agents/types.ts
interface AgentContext {
  conversation: Conversation
  phase: Phase
  phaseHistory: NDKEvent[]
  availableAgents: AgentSummary[]
}

interface AgentResponse {
  content: string
  nextAction: NextAction
  toolCalls?: ToolCall[]
}

interface NextAction {
  type: 'handoff' | 'phase_transition' | 'complete' | 'human_input'
  target?: string // agent pubkey or phase name
  reasoning?: string
}
```

### 4.2 Tool Integration
```typescript
// src/tools/ToolManager.ts
interface ToolManager {
  registerTool(name: string, tool: Tool): void
  executeTool(name: string, args: any): Promise<ToolResult>
  getToolsForAgent(agent: Agent): Tool[]
}

// src/tools/claude/ClaudeCodeTool.ts
class ClaudeCodeTool implements Tool {
  async execute(args: ClaudeCodeArgs): Promise<ToolResult>
  private parseClaudeOutput(output: string): ClaudeCodeMessage[]
}
```

## Phase 5: Feedback System

### 5.1 Feedback Coordinator
```typescript
// src/feedback/FeedbackCoordinator.ts
interface FeedbackCoordinator {
  requestFeedback(
    mainAgent: Agent,
    output: string,
    expertDomain: string
  ): Promise<FeedbackResponse>
  
  selectExperts(domain: string): Agent[]
  consolidateFeedback(responses: FeedbackResponse[]): string
}

// src/feedback/types.ts
interface FeedbackResponse {
  agent: string
  feedback: string
  confidence: number
  suggestions?: string[]
}
```

## Phase 6: Git Integration

### 6.1 Execution Manager
```typescript
// src/execution/ExecutionManager.ts
interface ExecutionManager {
  canStartExecution(): Promise<boolean>
  createWorkBranch(conversation: Conversation): Promise<string>
  suspendWork(branchName: string, reason: string): Promise<void>
  completeWork(branchName: string): Promise<void>
}
```

## Implementation Order

### Week 1: Foundation
1. LLM Service with multi-llm-ts integration
2. Basic Agent Registry and Agent types
3. Update EventHandler to recognize kind:11 conversations

### Week 2: Routing
1. RoutingLLM with prompt templates
2. Conversation Manager with state persistence
3. Phase Manager with transition logic

### Week 3: Agent System
1. Agent Executor with LLM integration
2. NostrPublisher for conversation events
3. Basic tool integration (Claude Code wrapper)

### Week 4: Advanced Features
1. Feedback Coordinator
2. Git-based Execution Manager
3. Context compaction for phase transitions

### Week 5: Testing & Polish
1. Integration tests for full conversation flow
2. Error handling and recovery
3. Performance optimization

## Module Directory Structure
```
tenex/src/
├── core/llm/
│   ├── MultiLLMService.ts
│   ├── LLMServiceFactory.ts
│   └── types.ts
├── agents/
│   ├── AgentRegistry.ts
│   ├── AgentExecutor.ts
│   ├── Agent.ts
│   └── types.ts
├── routing/
│   ├── RoutingLLM.ts
│   ├── FallbackRouter.ts
│   └── types.ts
├── prompts/
│   ├── core/
│   │   ├── PromptBuilder.ts
│   │   ├── FragmentRegistry.ts
│   │   └── types.ts
│   ├── fragments/
│   │   ├── common.ts
│   │   ├── generic.ts
│   │   ├── context.ts
│   │   └── agent-specific.ts
│   ├── templates/
│   │   ├── routing.ts
│   │   ├── phases.ts
│   │   └── agent.ts
│   └── index.ts
├── conversations/
│   ├── ConversationManager.ts
│   ├── ContextCompactor.ts
│   └── types.ts
├── phases/
│   ├── PhaseManager.ts
│   ├── CompletionCriteria.ts
│   └── types.ts
├── events/
│   ├── ConversationEventHandler.ts
│   └── types.ts
├── nostr/
│   ├── ConversationPublisher.ts
│   └── types.ts
├── tools/
│   ├── ToolManager.ts
│   ├── claude/
│   │   └── ClaudeCodeTool.ts
│   └── types.ts
├── feedback/
│   ├── FeedbackCoordinator.ts
│   └── types.ts
└── execution/
    ├── ExecutionManager.ts
    └── types.ts
```

## Key Design Decisions

1. **Stateless Agents**: Each agent interaction is stateless, context provided per request
2. **Event-Driven**: All communication through Nostr events with proper tagging
3. **Phase Isolation**: Each phase has its own context, compacted during transitions
4. **Tool Abstraction**: Tools are registered and executed through a common interface
5. **Fallback Routing**: Secondary routing mechanism for LLM instruction failures
6. **Git Gating**: Only one execution phase at a time, enforced through branch management

## Testing Strategy

### Unit Tests
- LLM Service configuration loading
- Agent Registry CRUD operations
- Phase transition logic
- Tool execution parsing

### Integration Tests
- Full conversation flow from kind:11 to completion
- Multi-agent feedback loops
- Git branch management during execution
- Error recovery scenarios

### E2E Tests
- Complete project development workflow
- Parallel conversation handling
- System restart recovery