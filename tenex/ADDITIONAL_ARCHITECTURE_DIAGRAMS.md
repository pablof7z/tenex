# Additional TENEX Architecture Diagrams

## 1. Component Deployment View

```mermaid
C4Context
    title System Context Diagram for TENEX

    Person(user, "Developer", "Uses TENEX to coordinate AI development tasks")
    
    System(tenex, "TENEX CLI", "Agentic development coordination system")
    
    System_Ext(claude_cli, "Claude CLI", "External Claude Code tool")
    System_Ext(nostr, "Nostr Network", "Decentralized communication protocol")
    System_Ext(llm_providers, "LLM Providers", "OpenAI, Anthropic, DeepSeek, etc.")
    System_Ext(git, "Git", "Version control system")
    System_Ext(filesystem, "File System", "Local project files")

    Rel(user, tenex, "Uses", "CLI commands")
    Rel(tenex, claude_cli, "Executes", "Tool calls")
    Rel(tenex, nostr, "Publishes/Subscribes", "Events")
    Rel(tenex, llm_providers, "Requests", "AI completions")
    Rel(tenex, git, "Manages", "Branches & commits")
    Rel(tenex, filesystem, "Reads/Writes", "Project files")
```

## 2. Process Architecture

```mermaid
graph TB
    subgraph "Process Hierarchy"
        MAIN[TENEX Main Process<br/>CLI Entry Point]
        DAEMON[Daemon Process<br/>Event Monitoring]
        RUNNER[Project Runner Process<br/>Per-Project Instance]
        CLAUDE[Claude CLI Process<br/>Tool Execution]
    end

    subgraph "Process Communication"
        MAIN --> |spawns| DAEMON
        DAEMON --> |spawns| RUNNER
        RUNNER --> |spawns| CLAUDE
        
        DAEMON -.-> |monitors| NOSTR[(Nostr Events)]
        RUNNER -.-> |publishes| NOSTR
        CLAUDE -.-> |streams to| RUNNER
    end

    subgraph "Process Isolation"
        RUNNER --> |isolated per| PROJ1[Project 1<br/>Workspace]
        RUNNER --> |isolated per| PROJ2[Project 2<br/>Workspace]
        RUNNER --> |isolated per| PROJ3[Project N<br/>Workspace]
    end

    classDef process fill:#e3f2fd
    classDef communication fill:#f3e5f5
    classDef isolation fill:#e8f5e8

    class MAIN,DAEMON,RUNNER,CLAUDE process
    class NOSTR communication
    class PROJ1,PROJ2,PROJ3 isolation
```

## 3. Memory Architecture

```mermaid
graph TB
    subgraph "In-Memory State"
        CONV_CACHE[Conversation Cache<br/>Active conversations]
        AGENT_CACHE[Agent Cache<br/>Loaded agents]
        CONFIG_CACHE[Configuration Cache<br/>LLM configs, settings]
        PROMPT_CACHE[Prompt Fragment Cache<br/>Reusable components]
    end

    subgraph "Persistent Storage"
        CONV_FILES[Conversation Files<br/>.tenex/conversations/]
        AGENT_REGISTRY[Agent Registry<br/>.tenex/agents.json]
        LLM_CONFIG[LLM Configuration<br/>llms.json]
        PROJECT_STATE[Project State<br/>.tenex/project.json]
    end

    subgraph "External State"
        NOSTR_EVENTS[Nostr Events<br/>Distributed state]
        GIT_STATE[Git Repository<br/>Code state]
    end

    %% Loading relationships
    CONV_FILES --> |loads| CONV_CACHE
    AGENT_REGISTRY --> |loads| AGENT_CACHE
    LLM_CONFIG --> |loads| CONFIG_CACHE
    
    %% Persistence relationships  
    CONV_CACHE --> |saves| CONV_FILES
    AGENT_CACHE --> |saves| AGENT_REGISTRY
    
    %% External sync
    CONV_CACHE -.-> |publishes| NOSTR_EVENTS
    CONV_CACHE -.-> |commits| GIT_STATE

    classDef memory fill:#fff3e0
    classDef storage fill:#f3e5f5
    classDef external fill:#e8f5e8

    class CONV_CACHE,AGENT_CACHE,CONFIG_CACHE,PROMPT_CACHE memory
    class CONV_FILES,AGENT_REGISTRY,LLM_CONFIG,PROJECT_STATE storage
    class NOSTR_EVENTS,GIT_STATE external
```

## 4. Security Architecture

```mermaid
graph TB
    subgraph "Key Management"
        USER_NSEC[User Private Key<br/>~/.tenex/nsec]
        AGENT_KEYS[Agent Keys<br/>.tenex/agents.json]
        PROJECT_KEYS[Project Keys<br/>Generated per project]
    end

    subgraph "Authentication Flow"
        AUTH_CHECK[Authentication Check]
        SIG_VERIFY[Signature Verification]
        WHITELIST[Pubkey Whitelist]
    end

    subgraph "Authorization"
        PROJECT_AUTH[Project Authorization<br/>Agent can act on project]
        TOOL_AUTH[Tool Authorization<br/>Agent can use tools]
        PUBLISH_AUTH[Publishing Authorization<br/>Agent can publish events]
    end

    subgraph "Secure Communication"
        NOSTR_SIGS[Nostr Event Signatures<br/>All events signed]
        TLS[TLS/HTTPS<br/>LLM provider communication]
        LOCAL_FS[Local File Permissions<br/>Project file access]
    end

    %% Key usage flows
    USER_NSEC --> |signs as| PROJECT_KEYS
    AGENT_KEYS --> |authenticates| AUTH_CHECK
    PROJECT_KEYS --> |signs| NOSTR_SIGS

    %% Auth flows
    AUTH_CHECK --> SIG_VERIFY
    SIG_VERIFY --> WHITELIST
    WHITELIST --> PROJECT_AUTH
    PROJECT_AUTH --> TOOL_AUTH
    TOOL_AUTH --> PUBLISH_AUTH

    classDef keys fill:#ffebee
    classDef auth fill:#e8f5e8
    classDef secure fill:#e3f2fd

    class USER_NSEC,AGENT_KEYS,PROJECT_KEYS keys
    class AUTH_CHECK,SIG_VERIFY,WHITELIST,PROJECT_AUTH,TOOL_AUTH,PUBLISH_AUTH auth
    class NOSTR_SIGS,TLS,LOCAL_FS secure
```

## 5. Error Handling & Recovery

```mermaid
graph TB
    subgraph "Error Sources"
        LLM_ERR[LLM API Errors<br/>Rate limits, timeouts]
        TOOL_ERR[Tool Execution Errors<br/>Claude CLI failures]
        NOSTR_ERR[Nostr Errors<br/>Network issues]
        FS_ERR[File System Errors<br/>Permission, disk space]
    end

    subgraph "Error Detection"
        ERR_CATCH[Error Catching<br/>Try-catch blocks]
        HEALTH_CHECK[Health Checks<br/>Service availability]
        TIMEOUT[Timeout Handling<br/>Operation limits]
    end

    subgraph "Recovery Strategies"
        RETRY[Exponential Backoff<br/>Automatic retry]
        FALLBACK[Fallback Mechanisms<br/>Alternative providers]
        GRACEFUL[Graceful Degradation<br/>Reduced functionality]
        USER_NOTIFY[User Notification<br/>Error reporting]
    end

    subgraph "State Recovery"
        CHECKPOINT[State Checkpointing<br/>Regular saves]
        ROLLBACK[Transaction Rollback<br/>Undo failed operations]
        RESUME[Resume Operations<br/>Continue from last state]
    end

    %% Error flow
    LLM_ERR --> ERR_CATCH
    TOOL_ERR --> ERR_CATCH
    NOSTR_ERR --> HEALTH_CHECK
    FS_ERR --> TIMEOUT

    %% Recovery flow
    ERR_CATCH --> RETRY
    HEALTH_CHECK --> FALLBACK
    TIMEOUT --> GRACEFUL
    RETRY --> USER_NOTIFY

    %% State management
    CHECKPOINT --> ROLLBACK
    ROLLBACK --> RESUME

    classDef errors fill:#ffebee
    classDef detection fill:#fff3e0
    classDef recovery fill:#e8f5e8
    classDef state fill:#f3e5f5

    class LLM_ERR,TOOL_ERR,NOSTR_ERR,FS_ERR errors
    class ERR_CATCH,HEALTH_CHECK,TIMEOUT detection
    class RETRY,FALLBACK,GRACEFUL,USER_NOTIFY recovery
    class CHECKPOINT,ROLLBACK,RESUME state
```

## 6. Monitoring & Observability

```mermaid
graph TB
    subgraph "Metrics Collection"
        PERF[Performance Metrics<br/>Response times, throughput]
        USAGE[Usage Metrics<br/>Token counts, costs]
        ERROR[Error Metrics<br/>Failure rates, types]
        BUSINESS[Business Metrics<br/>Conversations, phases]
    end

    subgraph "Logging Layers"
        APP_LOG[Application Logs<br/>Structured JSON logs]
        AUDIT_LOG[Audit Logs<br/>Agent actions, decisions]
        DEBUG_LOG[Debug Logs<br/>Detailed execution traces]
        LLM_LOG[LLM Logs<br/>Prompts, responses, costs]
    end

    subgraph "Observability Tools"
        LOGGER[Logger Service<br/>@tenex/shared/logger]
        TRACE[Distributed Tracing<br/>Request correlation]
        DASHBOARDS[Dashboards<br/>Metrics visualization]
    end

    subgraph "Data Storage"
        LOG_FILES[Log Files<br/>Local storage]
        NOSTR_AUDIT[Nostr Events<br/>Audit trail]
        METRICS_DB[Metrics Database<br/>Time series data]
    end

    %% Collection flows
    PERF --> APP_LOG
    USAGE --> LLM_LOG
    ERROR --> AUDIT_LOG
    BUSINESS --> DEBUG_LOG

    %% Processing flows
    APP_LOG --> LOGGER
    AUDIT_LOG --> TRACE
    DEBUG_LOG --> DASHBOARDS
    LLM_LOG --> LOGGER

    %% Storage flows
    LOGGER --> LOG_FILES
    TRACE --> NOSTR_AUDIT
    DASHBOARDS --> METRICS_DB

    classDef metrics fill:#e3f2fd
    classDef logging fill:#e8f5e8
    classDef tools fill:#fff3e0
    classDef storage fill:#f3e5f5

    class PERF,USAGE,ERROR,BUSINESS metrics
    class APP_LOG,AUDIT_LOG,DEBUG_LOG,LLM_LOG logging
    class LOGGER,TRACE,DASHBOARDS tools
    class LOG_FILES,NOSTR_AUDIT,METRICS_DB storage
```

## 7. Development & Testing Architecture

```mermaid
graph TB
    subgraph "Testing Layers"
        UNIT[Unit Tests<br/>Individual components]
        INTEGRATION[Integration Tests<br/>Module interactions]
        E2E[End-to-End Tests<br/>Complete workflows]
        SYSTEM[System Tests<br/>Full system behavior]
    end

    subgraph "Test Infrastructure"
        MOCKS[Mock Services<br/>LLM, Nostr, File system]
        FIXTURES[Test Fixtures<br/>Sample data, events]
        HELPERS[Test Helpers<br/>Common utilities]
        RUNNERS[Test Runners<br/>Parallel execution]
    end

    subgraph "Development Tools"
        DEBUG_AGENT[Debug Agent<br/>Interactive testing]
        DEBUG_CHAT[Debug Chat<br/>Agent conversations]
        CLI_DEBUG[CLI Debug<br/>Command testing]
        SYSTEM_PROMPT[System Prompt Debug<br/>Prompt inspection]
    end

    subgraph "Quality Gates"
        LINT[Code Linting<br/>Style consistency]
        TYPE_CHECK[Type Checking<br/>TypeScript validation]
        COVERAGE[Test Coverage<br/>Code coverage metrics]
        BUILD[Build Verification<br/>Compilation checks]
    end

    %% Testing flows
    UNIT --> MOCKS
    INTEGRATION --> FIXTURES
    E2E --> HELPERS
    SYSTEM --> RUNNERS

    %% Development flows
    DEBUG_AGENT --> DEBUG_CHAT
    CLI_DEBUG --> SYSTEM_PROMPT

    %% Quality flows
    LINT --> TYPE_CHECK
    TYPE_CHECK --> COVERAGE
    COVERAGE --> BUILD

    classDef testing fill:#e8f5e8
    classDef infrastructure fill:#f3e5f5
    classDef development fill:#e3f2fd
    classDef quality fill:#fff3e0

    class UNIT,INTEGRATION,E2E,SYSTEM testing
    class MOCKS,FIXTURES,HELPERS,RUNNERS infrastructure
    class DEBUG_AGENT,DEBUG_CHAT,CLI_DEBUG,SYSTEM_PROMPT development
    class LINT,TYPE_CHECK,COVERAGE,BUILD quality
```

## 8. Performance & Scalability

```mermaid
graph TB
    subgraph "Performance Bottlenecks"
        LLM_LATENCY[LLM API Latency<br/>2-10 seconds per call]
        TOOL_EXEC[Tool Execution<br/>Claude CLI spawn time]
        NOSTR_NET[Nostr Network<br/>Event propagation]
        FILE_IO[File I/O<br/>Conversation persistence]
    end

    subgraph "Optimization Strategies"
        STREAMING[Response Streaming<br/>Real-time updates]
        CACHING[Intelligent Caching<br/>Prompt fragments, configs]
        PARALLEL[Parallel Processing<br/>Multiple conversations]
        ASYNC[Async Operations<br/>Non-blocking I/O]
    end

    subgraph "Scalability Patterns"
        PROCESS_ISOLATION[Process Isolation<br/>Per-project instances]
        RESOURCE_LIMITS[Resource Limits<br/>Memory, CPU bounds]
        QUEUE_MGMT[Queue Management<br/>Request throttling]
        LOAD_BALANCE[Load Balancing<br/>LLM provider rotation]
    end

    subgraph "Monitoring Points"
        RESPONSE_TIME[Response Time<br/>End-to-end latency]
        THROUGHPUT[Throughput<br/>Conversations per hour]
        RESOURCE_USAGE[Resource Usage<br/>CPU, memory, tokens]
        QUEUE_DEPTH[Queue Depth<br/>Pending operations]
    end

    %% Optimization flows
    LLM_LATENCY --> STREAMING
    TOOL_EXEC --> CACHING
    NOSTR_NET --> PARALLEL
    FILE_IO --> ASYNC

    %% Scalability flows
    STREAMING --> PROCESS_ISOLATION
    CACHING --> RESOURCE_LIMITS
    PARALLEL --> QUEUE_MGMT
    ASYNC --> LOAD_BALANCE

    %% Monitoring flows
    PROCESS_ISOLATION --> RESPONSE_TIME
    RESOURCE_LIMITS --> THROUGHPUT
    QUEUE_MGMT --> RESOURCE_USAGE
    LOAD_BALANCE --> QUEUE_DEPTH

    classDef bottlenecks fill:#ffebee
    classDef optimization fill:#e8f5e8
    classDef scalability fill:#e3f2fd
    classDef monitoring fill:#fff3e0

    class LLM_LATENCY,TOOL_EXEC,NOSTR_NET,FILE_IO bottlenecks
    class STREAMING,CACHING,PARALLEL,ASYNC optimization
    class PROCESS_ISOLATION,RESOURCE_LIMITS,QUEUE_MGMT,LOAD_BALANCE scalability
    class RESPONSE_TIME,THROUGHPUT,RESOURCE_USAGE,QUEUE_DEPTH monitoring
```

## Architecture Decision Records (ADRs)

### ADR-001: Event-Driven Architecture
**Decision**: Use Nostr events as the primary communication mechanism  
**Rationale**: Enables distributed coordination, audit trails, and loose coupling  
**Trade-offs**: Added complexity, network dependency  

### ADR-002: Phase-Based Workflow
**Decision**: Structure conversations through defined phases  
**Rationale**: Provides clear progression, specialization, and failure isolation  
**Trade-offs**: Rigid structure, transition complexity  

### ADR-003: Process Isolation per Project
**Decision**: Run separate processes for each project  
**Rationale**: Prevents interference, enables parallel execution, fault isolation  
**Trade-offs**: Resource overhead, IPC complexity  

### ADR-004: Multi-LLM Provider Support
**Decision**: Abstract LLM providers through unified interface  
**Rationale**: Reduces vendor lock-in, enables cost optimization, provider redundancy  
**Trade-offs**: Abstraction complexity, feature parity challenges  

### ADR-005: Tool Integration via External Processes
**Decision**: Execute tools (Claude CLI) as external processes  
**Rationale**: Leverages existing tools, isolation, streaming capabilities  
**Trade-offs**: Process spawn overhead, error handling complexity  

## Operational Insights

### 1. **Resource Management**
- Each project runner consumes ~50-100MB memory
- LLM calls can use 1K-10K tokens per interaction
- Claude CLI sessions average 5-30 minutes
- Conversation files grow ~1KB per exchange

### 2. **Scaling Characteristics**
- Horizontal scaling via multiple daemon instances
- Vertical scaling limited by LLM provider rate limits
- Network bandwidth primarily for Nostr event traffic
- Storage grows linearly with conversation count

### 3. **Operational Complexity**
- Multi-process debugging requires correlation tools
- Configuration management across global/project scopes
- Key management for multiple agent identities
- Version coordination between CLI tools

### 4. **Reliability Patterns**
- Circuit breakers for LLM provider failures
- Exponential backoff for rate limit handling
- State checkpointing for long-running operations
- Graceful degradation when tools unavailable

This additional architectural documentation provides deeper insights into the operational, performance, and quality aspects of the TENEX system, complementing the core integration and data flow diagrams.