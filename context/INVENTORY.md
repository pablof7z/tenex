Here is a comprehensive inventory of the codebase, created with special attention to the recently modified files.

### 1. Project Overview

TENEX is a decentralized, multi-agent AI system designed for real-time, collaborative software development. It operates through various clients (CLI, web, iOS) and uses the Nostr protocol for event-driven communication. The system's core philosophy is to center the development process around managing context rather than just code.

Recent architectural changes have refined the multi-agent system into a structured, phase-based workflow where a central **Orchestrator** acts as a silent router, delegating tasks to specialized agents like a `Planner`, `Executor`, and various domain-expert agents. This new "Complete Routing System" is designed to be more predictable and robust, with clear separation of concerns between agents.

-   **Main Technologies**: TypeScript, Bun (runtime), React (for web-client), Nostr (protocol), Claude AI.
-   **Architecture Style**: Event-Driven, Multi-Agent System, Service-Oriented. The backend is a daemon process that monitors Nostr events and orchestrates agent actions.

### 2. Directory Structure

The repository is a monorepo containing the main `tenex` backend, a `web-client`, a `cli-client`, and an `e2e-framework`.

-   `tenex/`: The core backend application.
    -   `src/agents/`: **(Heavily Modified)** Contains all agent-related logic. This is the heart of the system.
        -   `built-in/`: Definitions for core agents (`orchestrator`, `planner`, `executor`).
        -   `execution/`: The logic for running agents, including the main `ReasonActLoop`, `AgentExecutor`, and the new `RoutingBackend`.
    -   `src/conversations/`: Manages the state and lifecycle of conversations, including the new phase-based flow.
    -   `src/prompts/`: **(Heavily Modified)** Defines the "brains" of the agents through a structured fragment system. Contains critical instructions for routing and agent behavior.
    -   `src/tools/`: Implementation of actions agents can perform, like `continue` (for routing) and `complete` (for finishing a task).
    -   `src/services/`: Core services like configuration management and project context.
    -   `docs/`: **(New)** Contains key architectural design documents, including the new routing system design.
-   `cli-client/`: A command-line interface for interacting with the TENEX system.
-   `e2e-framework/`: A home-grown, LLM-friendly end-to-end testing framework for running autonomous tests against the system.
-   `web-client/`: The primary user-facing web application built with React and TypeScript.
-   `context/`: Stores project-specific context files like `PROJECT.md` and `CHANGE_LOG.md`.

### 3. Significant Files

This section highlights key files, with special focus on recent changes.

-   **`tenex/docs/routing-system-redesign.md` (New)**: The new architectural blueprint. It describes a shift where the `Orchestrator` is a "silent router" that never speaks to users, and the system follows a strict, phase-based workflow (`CHAT` -> `PLAN` -> `EXECUTE` -> `VERIFICATION` etc.). It's the most important document for understanding the current system design.

-   **`tenex/src/agents/built-in/orchestrator.ts` (Modified)**: The orchestrator's instructions have been rewritten to reflect its new role as a silent, JSON-based router that uses the new `RoutingBackend`. It is explicitly forbidden from communicating with users and only uses a `continue()`-like function.

-   **`tenex/src/agents/execution/RoutingBackend.ts` (New)**: A new execution backend specifically for the orchestrator. It takes a conversation, makes an LLM call to get a JSON routing decision (`{agents: [...], phase: '...', reason: '...'}`), and then delegates the task to the target agents via the `AgentExecutor`.

-   **`tenex/src/agents/execution/ReasonActLoop.ts` (Modified)**: The primary agent execution loop. It now includes logic to enforce the new workflow, reminding non-orchestrator agents to use the `complete()` tool to hand control back, preventing conversations from stalling.

-   **`tenex/src/tools/implementations/continue.ts` (Modified)** & **`complete.ts` (Modified)**: These two tools form the new control flow backbone.
    -   `continue.ts`: An orchestrator-only tool to delegate tasks to other agents and manage phase transitions.
    -   `complete.ts`: A tool for all other agents to signal that their task for the current phase is finished, returning control to the orchestrator.

-   **`tenex/src/prompts/fragments/orchestrator-routing.ts` (Modified)**: This fragment provides the detailed logic for the orchestrator's routing decisions, quality control cycles, and phase management, directly supporting the `routing-system-redesign.md` specification.

-   **`tenex/src/prompts/fragments/agent-completion-guidance.ts` (New)**: Provides explicit, phase-specific instructions to non-orchestrator agents on when and how to use the `complete()` tool, ensuring they properly hand off control.

-   **`tenex/src/prompts/fragments/domain-expert-guidelines.ts` (New)**: A critical new prompt fragment that defines the role of specialist agents as "ADVISOR ONLY". It instructs them to provide recommendations and reviews but *never* to implement changes, which is solely the `Executor`'s responsibility.

-   **`tenex/src/conversations/phases.ts` (Modified)**: Defines the distinct phases of a conversation, each with a clear goal and constraints. This formalizes the structured workflow of the entire system.

-   **`tenex/src/conversations/ConversationManager.ts` (Modified)**: Manages the lifecycle of conversations, including tracking the current phase and persisting phase transition history, which is essential for the new routing logic.

### 4. Architectural Insights

The codebase has recently undergone a significant architectural refactoring, moving towards a more structured and predictable multi-agent system.

-   **Phase-Driven-Orchestration**: The system is built on a clear, stateful, phase-driven workflow. A conversation moves through defined phases (`CHAT`, `PLAN`, `EXECUTE`, `VERIFICATION`, `CHORES`, `REFLECTION`), each with a specific goal. This makes the agent's behavior predictable and controllable.

-   **The Silent Orchestrator Pattern**: The `Orchestrator` agent has been redesigned to be a pure, invisible router. It does not communicate with the user. Its sole responsibility is to receive events (from users or other agents) and route them to the appropriate agent(s) for the next phase of work. This is implemented via the new `RoutingBackend`.

-   **Separation of Concerns among Agents**: There is a strict division of labor, particularly between "advisory" and "implementation" agents.
    -   **Specialist Agents** (`@ndkswift`, `@database-expert`, etc.): Act as advisors. They review plans and code, providing recommendations within their domain. They are forbidden from making system changes.
    -   **Executor Agent**: The *only* agent with the authority to perform actions with side effects (writing files, running commands). It receives plans and recommendations and carries out the implementation.
    -   **Planner Agent**: Creates high-level plans and strategies, breaking down complex tasks. It cannot write code.
    -   **Project Manager Agent**: Manages project knowledge, requirements, and verification.

-   **Control Flow via `continue()` and `complete()`**: The flow of control is explicit and tool-based.
    1.  The `Orchestrator` uses a `continue()`-like function (implemented in the `RoutingBackend`) to delegate tasks.
    2.  Specialist agents perform their work (e.g., planning, reviewing) and use the `complete()` tool to return their output and signal they are finished.
    3.  Control returns to the `Orchestrator`, which then decides the next step (e.g., route to another agent for review, or move to the next phase).

-   **Built-in Review Cycles**: The `PLAN` and `EXECUTE` phases have mandatory review cycles built into the orchestrator's logic. A plan or implementation is first created by the primary agent (`planner` or `executor`) and then automatically routed to relevant experts for review before proceeding. This enforces quality control.

### 5. High-Complexity Modules

-   **Agent Execution & Routing System**
    -   **Path**: `tenex/src/agents/execution/`
    -   **Reason for Complexity**: This module is the engine of the multi-agent system. It manages the intricate dance between different agents and phases. The logic in `ReasonActLoop.ts` handles the think-act cycle, tool execution, and the new reminder system. The `RoutingBackend.ts` adds another layer of LLM-based decision-making for the orchestrator. The interactions between `AgentExecutor`, `ReasonActLoop`, `RoutingBackend`, and the `ConversationManager` create a complex state machine that must be robust to various conversation flows.
    -   **Suggested Filename**: `AGENT_EXECUTION_AND_ROUTING_GUIDE.md`

-   **Conversation State Management**
    -   **Path**: `tenex/src/conversations/`
    -   **Reason for Complexity**: The `ConversationManager.ts` is responsible for the state of all interactions. It must persist and load conversations, manage the newly introduced `phase` and `phaseTransitions`, and handle concurrent updates from multiple agents. The interplay between the master `history` and per-agent `agentContexts` adds to the complexity, especially with ensuring data consistency and providing the correct context for each agent's turn.
    -   **Suggested Filename**: `CONVERSATION_MANAGEMENT_GUIDE.md`