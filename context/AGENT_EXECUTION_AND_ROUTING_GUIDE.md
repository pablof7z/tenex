This document provides a comprehensive technical overview of the **Agent Execution & Routing System** module located at `backend/src/agents/execution/`. This module is the core engine responsible for running AI agents, managing their lifecycles, and orchestrating their interactions within the TENEX ecosystem.

## 1. Module Overview

### Purpose and Responsibilities

The Agent Execution & Routing System acts as the "brain" for every AI agent. Its fundamental purpose is to take an agent, a set of inputs (like a user message or a handoff from another agent), and the current conversation context, then manage the agent's "turn" until it concludes. This module is stateless by design; it relies on the `ConversationManager` for all state persistence.

Its key responsibilities include:

*   **Prompt Construction**: Dynamically building comprehensive system prompts tailored to the specific agent, its role, the current conversation phase, and available tools.
*   **Backend Selection**: Choosing the appropriate execution strategy (backend) for an agent based on its configuration (`reason-act-loop`, `claude`, or `routing`).
*   **LLM Interaction**: Managing the request-response cycle with the configured Large Language Model (LLM), including handling of text streaming.
*   **Tool Execution**: Parsing tool-use requests from the LLM, validating parameters, and executing the corresponding tools.
*   **Workflow Enforcement**: Ensuring agents adhere to the system's architectural principles, such as using terminal tools (`complete()` or `continue()`) to hand off control. This is achieved through a robust reminder system.
*   **Stateful Communication**: Publishing real-time updates (typing indicators, tool usage, final responses) to the Nostr network via the `NostrPublisher`.
*   **Execution Orchestration**: Managing the entire lifecycle of an agent's turn, from receiving a trigger to producing a terminal output.

### Key Interfaces and Entry Points

*   **`AgentExecutor.execute(context)`**: The primary entry point for the module. It orchestrates the entire execution flow for a given agent.
*   **`ExecutionBackend` Interface**: Defines the contract for different execution strategies. Its `execute()` method is the core of each backend's logic.
*   **`ExecutionContext` Type**: A crucial data structure that encapsulates all necessary information for an agent's execution turn, including the agent's definition, conversation state, publisher, and triggering event.

### Dependencies and Relationships

This module is centrally located and interacts with several other key parts of the system:
*   **`EventHandler`**: The upstream consumer that triggers agent execution in response to Nostr events.
*   **`LLMService`**: The downstream service used for all interactions with AI models.
*   **`ConversationManager`**: Provides and persists the state for all conversations.
*   **`NostrPublisher`**: Used to communicate all agent outputs and status updates to the Nostr network.
*   **`Tool` System**: Provides the set of capabilities (tools) that an agent can use.
*   **`ProjectContext`**: The source for global project information, such as the list of available agents and the project's own identity.
*   **`Routing System Design`**: The principles outlined in `docs/routing-system-redesign.md` are directly implemented by the logic within this module, particularly by the `RoutingBackend` and the `continue` tool.

## 2. Technical Architecture

The module employs a **Strategy Pattern** to handle different types of agent behaviors through multiple execution backends. `AgentExecutor` acts as the context for this pattern, selecting the appropriate strategy based on the agent's configuration.

### Internal Structure & Key Classes

*   **`AgentExecutor`**: The high-level coordinator. It doesn't contain execution logic itself but is responsible for:
    1.  Preparing the execution environment (`ExecutionContext`, messages, tools).
    2.  Selecting the appropriate `ExecutionBackend`.
    3.  Initiating and tracking execution time.
    4.  Delegating the core execution logic to the chosen backend.

*   **`ExecutionBackend` (Interface)**: Defines the single `execute` method that all backend strategies must implement, ensuring a consistent interface for the `AgentExecutor`.

*   **`ReasonActLoop` (Backend)**: This is the default and most complex backend, implementing the core "Reason-Act" cycle.
    *   It manages a stateful streaming loop that processes events from the LLM (`content`, `tool_start`, `tool_complete`, `done`).
    *   It's responsible for the **Termination Enforcement (Reminder) System**, which re-prompts an agent if it fails to use a terminal tool, ensuring the workflow doesn't stall.
    *   It handles the parsing and execution of tool calls requested by the agent.

*   **`ClaudeBackend` (Backend)**: A specialized, simpler backend designed for agents that perform self-contained, complex tasks using the `@anthropic-ai/claude-code` SDK.
    *   It bypasses the `ReasonActLoop` and directly invokes the `ClaudeTaskOrchestrator`.
    *   Once the Claude session is complete, it uses the shared `handleAgentCompletion` function to uniformly signal task completion to the orchestrator.

*   **`RoutingBackend` (Backend)**: A specialized, non-conversational backend exclusively for the `orchestrator` agent.
    *   It makes a single, non-streaming call to the LLM.
    *   It expects a structured JSON response conforming to the `RoutingDecisionSchema`.
    *   It parses the decision and then **recursively calls `AgentExecutor.execute()`** for each agent targeted in the routing decision. This recursive invocation is the mechanism that drives multi-agent collaboration.

*   **`completionHandler.ts`**: Provides the `handleAgentCompletion` function. This shared utility is used by both the `ClaudeBackend` and the `complete` tool to ensure that all task completions are handled identically, publishing a response and returning control to a pre-defined "next agent" (always the orchestrator).

### Data Flow

The typical execution flow proceeds as follows:

1.  An `EventHandler` (e.g., `reply.ts`) receives a Nostr event for the project.
2.  It creates an `ExecutionContext` and calls `AgentExecutor.execute(context)`.
3.  `AgentExecutor` builds the initial `Message[]` array, including the detailed system prompt.
4.  It determines the agent's backend (e.g., `reason-act-loop`).
5.  The chosen `ExecutionBackend`'s `execute` method is called.
6.  The backend streams the response from the `LLMService`.
7.  As stream events arrive:
    *   `content` chunks are streamed to the `NostrPublisher`.
    *   `tool_start`/`tool_complete` events trigger tool execution via `ToolPlugin` and `ToolExecutor`.
    *   `done` event finalizes the turn.
8.  If the agent fails to use a terminal tool (`complete` or `continue`), the `ReasonActLoop` appends a reminder to the message history and re-prompts the LLM.
9.  The loop terminates when a terminal tool is used or the max number of attempts is reached.

## 3. Implementation Details

### Core Algorithms & Logic

*   **Termination Enforcement (Reminder System)**: The `ReasonActLoop` is the heart of the system's workflow enforcement. It uses a `while` loop with `MAX_TERMINATION_ATTEMPTS = 2`.
    1.  **Attempt 1**: The agent is prompted with the current conversation context.
    2.  After the LLM stream is `done`, the loop checks if a terminal tool (`complete` or `continue`) was used.
    3.  **If not**, a specific reminder message is appended to the message history, tailored to whether the agent is an orchestrator (reminding it to use `continue`) or a specialist (reminding it to use `complete`).
    4.  **Attempt 2**: The LLM is called again with the updated history including the reminder.
    5.  If the agent *still* fails to terminate correctly, the system force-completes the turn by calling `autoCompleteTermination`, preventing a stall. This logic is detailed in `ReasonActLoop.ts` and tested in `complete-reminder.test.ts` and `ReasonActLoop.orchestrator-reminder.test.ts`.

*   **Recursive Execution via `RoutingBackend`**: The `RoutingBackend` is designed to be a "silent router". It does not generate conversational text. It makes a single LLM call, parses the returned JSON, and then iterates through the target agent slugs. For each slug, it creates a new `ExecutionContext` and calls `agentExecutor.execute(targetContext)`. This recursive pattern allows the orchestrator to delegate tasks and coordinate complex, multi-agent workflows.

*   **Stateful Streaming**: `ReasonActLoop` uses a `StreamingState` object to aggregate the results of a single turn, which may involve multiple LLM stream events (content chunks, tool calls, etc.). The `StreamPublisher` class in `NostrPublisher.ts` is used to batch small content chunks for more efficient network use while still providing a low-latency feel to the end-user.

### Important Design Decisions

*   **Pluggable Backends**: The `ExecutionBackend` strategy pattern is a key design choice. It decouples the high-level execution flow from the low-level agent "thinking" process, making it easy to add new agent behaviors (like the `ClaudeBackend` or `RoutingBackend`) without altering the core `AgentExecutor`.
*   **Centralized Completion Logic**: By extracting the logic for `complete()` into `handleAgentCompletion`, the system ensures that an agent's turn conclusion is handled consistently, whether it comes from a standard tool call or a specialized backend like `ClaudeBackend`.
*   **Explicit Routing**: The `RoutingBackend` and `continue` tool force the orchestrator to make explicit, auditable routing decisions. The `reason` field in the `RoutingDecisionSchema` is critical for a "chain-of-thought" that can be logged and debugged.
*   **Enforced P-Tagging for Control**: The system heavily relies on Nostr's `p-tag` for routing. The `NostrPublisher` is designed to clear any automatically added `p-tags` from NDK's `reply()` method to give the system full control over message destinations.

### Configuration

*   The execution strategy for an agent is determined by the `backend` property in its definition (`agents.json` or built-in definitions).
*   Possible values: `"reason-act-loop"` (default), `"claude"`, `"routing"`.
*   This single configuration key completely changes the agent's execution path within this module.

## 4. Integration Points

*   **Upstream**: `EventHandler` is the primary caller, instantiating and invoking `AgentExecutor` when a relevant Nostr event is received for the project.
*   **Downstream Dependencies**:
    *   `LLMService`: All backends ultimately call `llmService.stream()` or `llmService.complete()` to interact with the AI models.
    *   `ConversationManager`: Used to fetch and update conversation state, including history, metadata, and phase transitions.
    *   `NostrPublisher`: The sink for all real-time outputs. Backends use it to send typing indicators and final responses.
    *   `ToolExecutor`: `ReasonActLoop` uses this to execute tools requested by an agent.
    *   `ProjectContext`: Provides global information like the full list of available agents and the project's identity.

## 5. Usage Guide

This module is primarily for internal system use and is not intended to be called directly by external code. However, understanding its patterns is crucial for defining new agents and tools.

### Example Use Cases & Flow

1.  **Standard Agent Turn (e.g., a specialist agent)**:
    *   **Backend**: `reason-act-loop` (default)
    *   **Flow**:
        1.  `AgentExecutor.execute()` is called.
        2.  `ReasonActLoop` is used.
        3.  The agent might use a tool like `read_path`. `ToolPlugin` executes it.
        4.  The LLM generates a final response.
        5.  The agent uses the `complete()` tool.
        6.  `handleAgentCompletion` publishes the response and signals the turn is over.

2.  **Orchestrator Routing**:
    *   **Backend**: `routing`
    *   **Flow**:
        1.  `AgentExecutor.execute()` is called for the orchestrator agent.
        2.  `RoutingBackend` is used.
        3.  A single LLM call is made to get a JSON `RoutingDecision`.
        4.  `RoutingBackend` iterates through the target agents in the decision.
        5.  For each target, it recursively calls `AgentExecutor.execute()` with a new context for that agent.

3.  **Complex Code Generation**:
    *   **Backend**: `claude`
    *   **Flow**:
        1.  `AgentExecutor.execute()` is called for an agent like `executor`.
        2.  `ClaudeBackend` is used.
        3.  It instantiates `ClaudeTaskOrchestrator` and calls its `execute()` method.
        4.  Progress is streamed back via the `TaskPublisher`.
        5.  When the Claude session ends, `ClaudeBackend` calls `handleAgentCompletion` to yield control back to the orchestrator.

### Best Practices for Developers

*   **Agent Definition**: When creating a new agent, carefully choose its `backend` property. Use `routing` for the orchestrator, `claude` for agents that need long-running, stateful code generation, and the default (`reason-act-loop`) for most other use cases.
*   **Tool Design**: Terminal tools like `continue` and `complete` should return a `Termination` or `ContinueFlow` object. The `ReasonActLoop` is specifically designed to look for these return types to manage the execution flow.
*   **Debugging**: To debug why an agent is making a certain decision, inspect the system prompt generated by `buildSystemPrompt`. The `debug system-prompt` CLI command is the best way to do this. The `reason` field in the `continue` tool is also invaluable for tracing the orchestrator's logic.