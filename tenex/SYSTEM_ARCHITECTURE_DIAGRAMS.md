# TENEX System Architecture Diagrams

## 1. Module Integration Overview

```mermaid
graph TB
    subgraph "CLI Layer"
        CLI[TENEX CLI<br/>commands/*] --> |commands| CMD{Command Router}
        CMD --> |daemon| DAEMON[Daemon Command]
        CMD --> |project| PROJECT[Project Commands]
        CMD --> |setup| SETUP[Setup Commands]
        CMD --> |debug| DEBUG[Debug Commands]
    end

    subgraph "Core Event System"
        DAEMON --> |monitors| EM[EventMonitor<br/>daemon/EventMonitor]
        EM --> |receives| NOSTR[(Nostr Network<br/>NDK)]
        EM --> |triggers| PM[ProcessManager<br/>daemon/ProcessManager]
        PM --> |spawns| PROJMGR[ProjectManager<br/>daemon/ProjectManager]
    end

    subgraph "Conversation Flow"
        PROJMGR --> |routes to| CR[ConversationRouter<br/>routing/ConversationRouter]
        CR --> |manages| CM[ConversationManager<br/>conversations/ConversationManager]
        CR --> |uses| RL[RoutingLLM<br/>routing/RoutingLLM]
        CM --> |persists| FS[FileSystemAdapter<br/>conversations/persistence]
    end

    subgraph "Phase Management"
        CR --> |initializes| PIF[PhaseInitializerFactory<br/>phases/PhaseInitializerFactory]
        PIF --> |creates| PI1[ChatPhaseInitializer]
        PIF --> |creates| PI2[PlanPhaseInitializer] 
        PIF --> |creates| PI3[ExecutePhaseInitializer]
        PIF --> |creates| PI4[ReviewPhaseInitializer]
    end

    subgraph "Agent System"
        CR --> |executes via| AE[AgentExecutor<br/>agents/execution/AgentExecutor]
        AE --> |manages| AR[AgentRegistry<br/>agents/AgentRegistry]
        AE --> |builds prompts| APB[AgentPromptBuilder<br/>agents/execution/AgentPromptBuilder]
        AR --> |stores| AGENTFILE[(agents.json)]
    end

    subgraph "LLM Integration"
        AE --> |uses| LLM[LLMService<br/>llm/LLMService]
        RL --> |uses| LLM
        LLM --> |configured by| LLMCFG[ConfigManager<br/>llm/ConfigManager]
        LLM --> |delegates to| MLLM[MultiLLMService<br/>core/llm/MultiLLMService]
        LLMCFG --> |reads| LLMFILE[(llms.json)]
    end

    subgraph "Prompt System"
        APB --> |uses| PB[PromptBuilder<br/>prompts/core/PromptBuilder]
        PB --> |manages| FR[FragmentRegistry<br/>prompts/core/FragmentRegistry]
        FR --> |loads| FRAG[Fragment Files<br/>prompts/fragments/*]
        PB --> |uses| TEMP[Template Files<br/>prompts/templates/*]
    end

    subgraph "Tool Execution"
        AE --> |can execute| TEM[ToolExecutionManager<br/>tools/execution/ToolExecutionManager]
        TEM --> |detects| TD[ToolDetector<br/>tools/execution/ToolDetector]
        TEM --> |uses| TE[Tool Executors<br/>tools/execution/executors/*]
        PI2 --> |triggers| CCE[ClaudeCodeExecutor<br/>tools/ClaudeCodeExecutor]
        PI3 --> |triggers| CCE
    end

    subgraph "Publishing System"
        AE --> |publishes via| CP[ConversationPublisher<br/>nostr/ConversationPublisher]
        CR --> |publishes via| CP
        CCE --> |publishes via| CP
        CP --> |uses| NDK[NDKClient<br/>nostr/ndkClient]
        NDK --> |publishes to| NOSTR
    end

    subgraph "Runtime Context"
        CR --> |accesses| PC[ProjectContext<br/>runtime/ProjectContext]
        AE --> |accesses| PC
        PC --> |provides| PROJDATA[(Project Data<br/>agents, config, metadata)]
    end

    subgraph "Utilities & Support"
        CM --> |uses| UTILS[Utilities<br/>utils/*]
        AE --> |uses| UTILS
        UTILS --> |includes| PARSER[ClaudeParser<br/>utils/claude/ClaudeParser]
        UTILS --> |includes| RULES[RulesManager<br/>utils/RulesManager]
    end

    classDef cliLayer fill:#e1f5fe
    classDef eventSystem fill:#f3e5f5
    classDef conversation fill:#e8f5e8
    classDef phases fill:#fff3e0
    classDef agents fill:#fce4ec
    classDef llm fill:#f1f8e9
    classDef prompts fill:#e0f2f1
    classDef tools fill:#fff8e1
    classDef publishing fill:#e3f2fd
    classDef runtime fill:#fafafa
    classDef storage fill:#ffebee

    class CLI,CMD,DAEMON,PROJECT,SETUP,DEBUG cliLayer
    class EM,PM,PROJMGR,NOSTR eventSystem
    class CR,CM,RL,FS conversation
    class PIF,PI1,PI2,PI3,PI4 phases
    class AE,AR,APB,AGENTFILE agents
    class LLM,LLMCFG,MLLM,LLMFILE llm
    class PB,FR,FRAG,TEMP,APB prompts
    class TEM,TD,TE,CCE tools
    class CP,NDK publishing
    class PC,PROJDATA runtime
    class UTILS,PARSER,RULES,FS,AGENTFILE,LLMFILE,PROJDATA storage
```

## 2. Event Flow Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant Nostr as Nostr Network
    participant EM as EventMonitor
    participant CR as ConversationRouter
    participant CM as ConversationManager
    participant RL as RoutingLLM
    participant PI as PhaseInitializer
    participant AE as AgentExecutor
    participant LLM as LLMService
    participant CP as ConversationPublisher

    User->>+Nostr: Publish conversation event (kind:11)
    Nostr->>+EM: Event received
    EM->>+CR: Route new conversation
    CR->>+CM: Create conversation
    CM-->>-CR: Conversation created
    CR->>+RL: Route new conversation
    RL->>+LLM: Determine phase & agent
    LLM-->>-RL: Routing decision
    RL-->>-CR: Phase: "chat", Agent: project
    CR->>+PI: Initialize chat phase
    PI-->>-CR: Initialization result
    CR->>+AE: Execute project agent
    AE->>+LLM: Generate response
    LLM-->>-AE: Response content
    AE->>+CP: Publish response
    CP->>-Nostr: Response event published
    CR-->>-EM: Routing complete
    EM-->>-Nostr: Monitoring continues

    Note over User,CP: Phase Transition Example
    User->>+Nostr: Reply requesting plan
    Nostr->>+EM: Reply event received
    EM->>+CR: Route reply
    CR->>+CM: Add event to conversation
    CR->>+RL: Determine next action
    RL->>+LLM: Analyze for phase transition
    LLM-->>-RL: Transition to "plan" phase
    RL-->>-CR: Phase change decision
    CR->>+PI: Initialize plan phase
    PI->>+CCE: Trigger Claude Code
    CCE-->>-PI: Claude Code started
    PI-->>-CR: Initialization complete
    CR->>+CP: Publish phase transition
    CP->>-Nostr: Phase update published
```

## 3. Agent Lifecycle Diagram

```mermaid
stateDiagram-v2
    [*] --> AgentDiscovery: System startup
    
    state AgentDiscovery {
        [*] --> LoadRegistry: Load .tenex/agents.json
        LoadRegistry --> ParseConfigs: Parse agent configs
        ParseConfigs --> [*]
    }
    
    AgentDiscovery --> AgentCreation: Conversation requires agent
    
    state AgentCreation {
        [*] --> CheckRegistry: Agent needed
        CheckRegistry --> GenerateNsec: New agent
        CheckRegistry --> LoadExisting: Existing agent
        GenerateNsec --> CreateSigner: Generate nsec key
        LoadExisting --> CreateSigner: Load existing nsec
        CreateSigner --> RegisterAgent: Create NDKPrivateKeySigner
        RegisterAgent --> [*]: Agent ready
    }
    
    AgentCreation --> AgentExecution: Agent assigned to conversation
    
    state AgentExecution {
        [*] --> BuildPrompt: Agent executor called
        BuildPrompt --> CallLLM: Prompt built with fragments
        CallLLM --> ParseResponse: LLM response received
        ParseResponse --> ExecuteTools: Tools detected
        ParseResponse --> PublishResponse: No tools needed
        ExecuteTools --> PublishResponse: Tools executed
        PublishResponse --> [*]: Response published
    }
    
    AgentExecution --> AgentExecution: Continue conversation
    AgentExecution --> [*]: Conversation ends
```

## 4. Phase Transition State Machine

```mermaid
stateDiagram-v2
    [*] --> chat: New conversation
    
    chat --> plan: Requirements clear
    chat --> chat: More clarification needed
    
    plan --> execute: Plan approved
    plan --> chat: Need more requirements
    plan --> plan: Expert feedback needed
    
    execute --> review: Implementation complete
    execute --> plan: Implementation issues
    execute --> execute: Continue implementation
    
    review --> chat: Review complete / new request
    review --> execute: Issues found
    review --> chores: Cleanup needed
    review --> [*]: Task complete
    
    chores --> review: Cleanup complete
    chores --> execute: More work needed
    
    note right of chat
        Phase: chat
        Agent: Project (via nsec)
        Tools: None
        Purpose: Gather requirements
    end note
    
    note right of plan
        Phase: plan
        Agent: Claude Code
        Tools: Claude CLI
        Purpose: Create implementation plan
    end note
    
    note right of execute
        Phase: execute
        Agent: Claude Code
        Tools: Claude CLI + Git
        Purpose: Implement solution
    end note
    
    note right of review
        Phase: review
        Agent: Selected by routing
        Tools: Testing tools
        Purpose: Validate implementation
    end note
```

## 5. Tool Integration Architecture

```mermaid
graph TB
    subgraph "Tool Detection & Execution"
        AE[AgentExecutor] --> |checks response| TD[ToolDetector]
        TD --> |detects tools| TEM[ToolExecutionManager]
        TEM --> |delegates to| TE[Tool Executors]
    end

    subgraph "Tool Executors"
        TE --> FE[FileExecutor<br/>File operations]
        TE --> SE[ShellExecutor<br/>Shell commands]
        TE --> CCE[ClaudeCodeExecutor<br/>Claude CLI integration]
    end

    subgraph "Claude Code Integration"
        CCE --> |spawns| CLAUDE[Claude CLI Process]
        CCE --> |creates| TASK[NDKTask]
        CCE --> |parses| PARSER[ClaudeParser]
        CLAUDE --> |streams| PARSER
        PARSER --> |publishes| CP[ConversationPublisher]
    end

    subgraph "Tool Results"
        FE --> |results| AE
        SE --> |results| AE
        CCE --> |results| AE
        AE --> |incorporates| RESPONSE[Agent Response]
    end

    subgraph "Phase-Specific Tool Usage"
        PI2[PlanPhaseInitializer] --> |triggers| CCE
        PI3[ExecutePhaseInitializer] --> |triggers| CCE
        PI3 --> |manages| GIT[Git Branch Management]
    end

    classDef toolExecution fill:#fff8e1
    classDef claudeIntegration fill:#e8f5e8
    classDef phaseTools fill:#f3e5f5

    class TD,TEM,TE,AE toolExecution
    class CCE,CLAUDE,TASK,PARSER,CP claudeIntegration
    class PI2,PI3,GIT phaseTools
```

## 6. Data Flow Architecture

```mermaid
graph LR
    subgraph "Data Sources"
        USER[User Input<br/>Nostr Events]
        CONFIG[Configuration<br/>llms.json, agents.json]
        PROJECT[Project Files<br/>Code, docs, etc.]
    end

    subgraph "Data Processing"
        USER --> CM[ConversationManager<br/>State Management]
        CONFIG --> AR[AgentRegistry<br/>Agent Config]
        CONFIG --> LLM[LLMService<br/>Model Config]
        PROJECT --> PC[ProjectContext<br/>Project State]
    end

    subgraph "Data Transformation"
        CM --> RL[RoutingLLM<br/>Decision Making]
        AR --> AE[AgentExecutor<br/>Agent Coordination]
        PC --> PB[PromptBuilder<br/>Context Assembly]
        LLM --> MLLM[MultiLLMService<br/>Provider Abstraction]
    end

    subgraph "Data Output"
        RL --> DECISIONS[Routing Decisions<br/>Phase, Agent, Actions]
        AE --> RESPONSES[Agent Responses<br/>Text, Tool Results]
        PB --> PROMPTS[Structured Prompts<br/>System, User, Context]
        MLLM --> COMPLETIONS[LLM Completions<br/>Text, Function Calls]
    end

    subgraph "Data Persistence"
        CM --> FS1[Conversation Files<br/>.tenex/conversations/]
        AR --> FS2[Agent Registry<br/>.tenex/agents.json]
        PC --> FS3[Project Metadata<br/>.tenex/project.json]
        RESPONSES --> NOSTR[Nostr Events<br/>Distributed Storage]
    end

    classDef sources fill:#e1f5fe
    classDef processing fill:#e8f5e8
    classDef transformation fill:#fff3e0
    classDef output fill:#fce4ec
    classDef persistence fill:#f3e5f5

    class USER,CONFIG,PROJECT sources
    class CM,AR,LLM,PC processing
    class RL,AE,PB,MLLM transformation
    class DECISIONS,RESPONSES,PROMPTS,COMPLETIONS output
    class FS1,FS2,FS3,NOSTR persistence
```

## 7. System Boundaries and Integration Points

```mermaid
graph TB
    subgraph "External Systems"
        NOSTR_NET[Nostr Network<br/>Decentralized Communication]
        LLM_PROVIDERS[LLM Providers<br/>OpenAI, Anthropic, etc.]
        CLAUDE_CLI[Claude CLI<br/>External Tool]
        GIT_SYSTEM[Git System<br/>Version Control]
        FILE_SYSTEM[File System<br/>Local Storage]
    end

    subgraph "TENEX System Boundary" 
        subgraph "Integration Layer"
            NDK[NDK Client<br/>Nostr Integration]
            MULTI_LLM[MultiLLM Service<br/>Provider Integration]
            CCE[Claude Code Executor<br/>CLI Integration]
            FS_ADAPTER[FileSystem Adapter<br/>Storage Integration]
        end

        subgraph "Core System"
            ROUTER[Conversation Router<br/>Central Orchestration]
            AGENTS[Agent System<br/>AI Coordination]
            PHASES[Phase Management<br/>Workflow Control]
        end
    end

    subgraph "User Interfaces"
        CLI_CMD[CLI Commands<br/>User Interface]
        DEBUG_UI[Debug Interface<br/>Development Tools]
        DAEMON_SVC[Daemon Service<br/>Background Processing]
    end

    %% External connections
    NOSTR_NET <--> NDK
    LLM_PROVIDERS <--> MULTI_LLM
    CLAUDE_CLI <--> CCE
    GIT_SYSTEM <--> CCE
    FILE_SYSTEM <--> FS_ADAPTER

    %% Internal connections
    NDK --> ROUTER
    MULTI_LLM --> AGENTS
    CCE --> PHASES
    FS_ADAPTER --> ROUTER

    %% User interface connections
    CLI_CMD --> DAEMON_SVC
    DEBUG_UI --> AGENTS
    DAEMON_SVC --> ROUTER

    classDef external fill:#ffebee
    classDef integration fill:#e8f5e8
    classDef core fill:#e3f2fd
    classDef ui fill:#f3e5f5

    class NOSTR_NET,LLM_PROVIDERS,CLAUDE_CLI,GIT_SYSTEM,FILE_SYSTEM external
    class NDK,MULTI_LLM,CCE,FS_ADAPTER integration
    class ROUTER,AGENTS,PHASES core
    class CLI_CMD,DEBUG_UI,DAEMON_SVC ui
```

## Key Architectural Insights

### 1. **Event-Driven Architecture**
- All communication flows through Nostr events
- EventMonitor acts as the primary event ingress point
- ConversationRouter serves as the central orchestrator
- Events are published back to Nostr for distributed coordination

### 2. **Phase-Based Workflow**
- Conversations progress through defined phases: chat → plan → execute → review
- Each phase has specialized initialization logic
- Phase transitions are controlled by business rules and LLM decisions
- Phases can transition bidirectionally based on feedback

### 3. **Agent Orchestration**
- AgentRegistry manages agent lifecycle and configuration  
- AgentExecutor coordinates agent execution with LLM calls
- Agents are specialized by role (chat, planning, execution, review)
- Agent responses are published as Nostr events

### 4. **Modular LLM Integration**
- MultiLLMService provides provider abstraction
- Different agents can use different LLM configurations
- Prompt system uses modular fragments for flexible composition
- LLM responses are parsed for tool calls and structured output

### 5. **Tool Integration Strategy**
- Tools are detected from LLM responses and executed automatically
- ClaudeCodeExecutor provides deep integration with Claude CLI
- Tool results are incorporated back into agent responses
- Phase-specific tools (like git branching) are managed by phase initializers

### 6. **Persistent State Management**  
- Conversations are persisted locally with FileSystemAdapter
- Agent registry maintains nsec keys and configurations
- Project context provides global state across the system
- All state changes are reflected in Nostr events for coordination

This architecture enables a distributed, AI-coordinated development workflow where multiple agents collaborate through structured phases to accomplish complex software development tasks.