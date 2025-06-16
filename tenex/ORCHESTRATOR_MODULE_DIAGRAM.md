# Orchestrator Module Diagram

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User Interface (Web/CLI)                     │
└─────────────────────────────────────┬───────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          Nostr Event Stream                          │
│                         (NDKEvent - Kind 11)                         │
└─────────────────────────────────────┬───────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         AgentEventHandler                            │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ - Existing AgentEventHandler class                         │     │
│  │ - Optional OrchestrationCoordinator dependency             │     │
│  │ - Orchestration integrated in determineRespondingAgents    │     │
│  └────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────┬───────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     OrchestrationCoordinator                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Responsibilities:                                            │   │
│  │ - Coordinate all orchestration subsystems                   │   │
│  │ - Manage conversation state                                 │   │
│  │ - Handle event routing                                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
└──────┬──────────────┬──────────────┬──────────────┬────────────────┘
       │              │              │              │
       ▼              ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│    Team      │ │ Supervision  │ │ Reflection   │ │ Green Light  │
│ Orchestrator │ │   System     │ │   System     │ │   System     │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

## Detailed Module Interactions

### 1. Team Formation Module

```
┌─────────────────────────────────────────────────────────────────────┐
│                          TeamOrchestrator                            │
│                                                                      │
│  ┌─────────────────┐     ┌──────────────────┐                      │
│  │ analyzeAndForm  │────▶│ TeamFormation    │                      │
│  │     Team()      │     │   Analyzer       │                      │
│  └─────────────────┘     └──────────────────┘                      │
│           │                        │                                 │
│           ▼                        ▼                                 │
│  ┌─────────────────┐     ┌──────────────────┐                      │
│  │  LLMProvider    │     │  PromptBuilder   │                      │
│  │                 │     │                  │                      │
│  └─────────────────┘     └──────────────────┘                      │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────────────────────────────┐                       │
│  │           Team Object                    │                       │
│  │  - id: string                           │                       │
│  │  - lead: string                         │                       │
│  │  - members: string[]                    │                       │
│  │  - strategy: OrchestrationStrategy      │                       │
│  │  - taskDefinition: TaskDefinition       │                       │
│  └─────────────────────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 2. Supervision System Module

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SupervisionSystem                            │
│                                                                      │
│  ┌─────────────────┐     ┌──────────────────┐                      │
│  │   Milestone     │────▶│    Milestone     │                      │
│  │   Received      │     │    Tracker       │                      │
│  └─────────────────┘     └──────────────────┘                      │
│           │                        │                                 │
│           ▼                        ▼                                 │
│  ┌─────────────────┐     ┌──────────────────┐                      │
│  │  shouldSuper    │────▶│  ComplexTools    │                      │
│  │    vise()       │     │    Registry      │                      │
│  └─────────────────┘     └──────────────────┘                      │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────┐     ┌──────────────────┐                      │
│  │   Request       │────▶│   Supervisor     │                      │
│  │  Supervision    │     │ DecisionMaker    │                      │
│  └─────────────────┘     └──────────────────┘                      │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────────────────────────────┐                       │
│  │      SupervisionDecision                 │                       │
│  │  - action: approve|intervene|abort      │                       │
│  │  - feedback?: string                    │                       │
│  │  - suggestions?: string[]               │                       │
│  └─────────────────────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 3. Reflection System Module

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ReflectionSystem                             │
│                                                                      │
│  ┌─────────────────┐     ┌──────────────────┐                      │
│  │   User Event    │────▶│   Correction     │                      │
│  │   Received      │     │    Detector      │                      │
│  └─────────────────┘     └──────────────────┘                      │
│           │                        │                                 │
│           ▼                        ▼                                 │
│  ┌─────────────────────────────────────────┐                       │
│  │         ReflectionTrigger?               │                       │
│  └─────────────────────────────────────────┘                       │
│                    │ (if triggered)                                  │
│                    ▼                                                 │
│  ┌─────────────────┐     ┌──────────────────┐                      │
│  │  Orchestrate    │────▶│     Lesson       │                      │
│  │  Reflection     │     │    Generator     │                      │
│  └─────────────────┘     └──────────────────┘                      │
│           │                        │                                 │
│           ▼                        ▼                                 │
│  ┌─────────────────┐     ┌──────────────────┐                      │
│  │  Deduplicate    │────▶│     Lesson       │                      │
│  │    Lessons      │     │    Publisher     │                      │
│  └─────────────────┘     └──────────────────┘                      │
│                                   │                                  │
│                                   ▼                                  │
│                          ┌──────────────────┐                       │
│                          │ NDK Event 4124   │                       │
│                          │ (Lesson Event)   │                       │
│                          └──────────────────┘                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 4. Green Light System Module

```
┌─────────────────────────────────────────────────────────────────────┐
│                         GreenLightSystem                             │
│                                                                      │
│  ┌─────────────────┐     ┌──────────────────┐                      │
│  │ shouldRequire   │────▶│ Task Definition  │                      │
│  │   Review()      │     │    Analyzer      │                      │
│  └─────────────────┘     └──────────────────┘                      │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────┐     ┌──────────────────┐                      │
│  │   Initiate      │────▶│     Review       │                      │
│  │   Review        │     │   Coordinator    │                      │
│  └─────────────────┘     └──────────────────┘                      │
│           │                        │                                 │
│           ▼                        ▼                                 │
│  ┌─────────────────────────────────────────┐                       │
│  │        Parallel Review Requests          │                       │
│  │  ┌──────┐  ┌──────┐  ┌──────┐         │                       │
│  │  │Agent1│  │Agent2│  │Agent3│         │                       │
│  │  └──────┘  └──────┘  └──────┘         │                       │
│  └─────────────────────────────────────────┘                       │
│                    │                                                 │
│                    ▼                                                 │
│  ┌─────────────────┐     ┌──────────────────┐                      │
│  │    Collect      │────▶│     Review       │                      │
│  │    Reviews      │     │   Aggregator     │                      │
│  └─────────────────┘     └──────────────────┘                      │
│                                   │                                  │
│                                   ▼                                  │
│                          ┌──────────────────┐                       │
│                          │  ReviewResult    │                       │
│                          │ - status         │                       │
│                          │ - decisions[]    │                       │
│                          └──────────────────┘                       │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow Through Modules

### 1. Initial Request Processing

```
User Event → EventHandler → OrchestrationCoordinator
                                    │
                                    ├─→ Check existing team
                                    ├─→ Check for reflection
                                    └─→ Form new team if needed
```

### 2. Team Execution with Supervision

```
Agent executes tool → Create Milestone → SupervisionSystem
                                              │
                                              ├─→ Check complexity
                                              ├─→ Request supervision
                                              └─→ Apply decision
```

### 3. Reflection Flow

```
User correction → ReflectionSystem → Identify team
                        │
                        ├─→ Generate individual reflections
                        ├─→ Deduplicate lessons
                        └─→ Publish to Nostr
```

### 4. Review Process

```
Task complete → Team Lead → GreenLightSystem
                                │
                                ├─→ Select reviewers
                                ├─→ Parallel reviews
                                └─→ Aggregate decisions
```

## Module Dependencies

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Shared Dependencies                         │
│                                                                      │
│  ┌───────────────┐  ┌────────────────┐  ┌────────────────────┐    │
│  │ LLMProvider   │  │ Conversation   │  │        NDK         │    │
│  │               │  │    Storage     │  │                    │    │
│  └───────────────┘  └────────────────┘  └────────────────────┘    │
│         ▲                    ▲                     ▲                │
│         │                    │                     │                │
└─────────┼────────────────────┼─────────────────────┼────────────────┘
          │                    │                     │
    ┌─────┴─────┐        ┌─────┴─────┐        ┌─────┴─────┐
    │   Team    │        │Supervision│        │Reflection │
    │Orchestrator│       │  System   │        │  System   │
    └───────────┘        └───────────┘        └───────────┘
```

## Error Propagation

```
                           ┌─────────────────┐
                           │ User Interface   │
                           └────────▲────────┘
                                    │ (displays error)
                           ┌────────┴────────┐
                           │ Event Handler   │
                           └────────▲────────┘
                                    │ (catches & logs)
                           ┌────────┴────────┐
                           │  Coordinator    │
                           └────────▲────────┘
                                    │ (no catch - propagates)
                           ┌────────┴────────┐
                           │ Orchestrator    │
                           └────────▲────────┘
                                    │ (throws specific errors)
                           ┌────────┴────────┐
                           │ TeamFormation   │
                           │     Error       │
                           └─────────────────┘
```

## State Storage

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Conversation Metadata                           │
│                                                                      │
│  {                                                                   │
│    "team": {                                                         │
│      "id": "team-123",                                              │
│      "lead": "frontend-expert",                                     │
│      "members": ["frontend-expert", "backend-engineer"],            │
│      "strategy": "hierarchical",                                    │
│      "taskDefinition": { ... },                                     │
│      "formation": { ... }                                           │
│    },                                                               │
│    "supervisionHistory": [                                          │
│      { "milestone": "...", "decision": "...", "timestamp": ... }   │
│    ],                                                               │
│    "reflectionTriggers": [                                          │
│      { "eventId": "...", "triggered": true, "lessons": [...] }     │
│    ],                                                               │
│    "greenLightStatus": {                                            │
│      "required": true,                                              │
│      "reviews": { ... },                                            │
│      "finalStatus": "approved"                                      │
│    }                                                                │
│  }                                                                   │
└─────────────────────────────────────────────────────────────────────┘
```