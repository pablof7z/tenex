Here is a comprehensive inventory of the codebase:

### 1. Project Overview

TENEX is a command-line interface (CLI) and daemon that provides a context-first development environment for orchestrating multiple AI agents to build software collaboratively. It uses the Nostr protocol for all communication, allowing for a decentralized, observable system where users and agents interact through Nostr events.

The core architecture is agent-based and event-driven. A long-running `daemon` process monitors Nostr for project-related events. When an event for a specific project is detected, it spawns a dedicated process to handle the interaction. This process uses a "Project Manager" (PM) agent to orchestrate a team of specialist agents, guiding them through a structured workflow divided into distinct phases (e.g., chat, plan, execute, review).

The system features a sophisticated, modular prompt engineering system, a multi-LLM router that supports native function calling, and comprehensive logging/tracing capabilities.

**Main Technologies & Frameworks:**
*   **Language**: TypeScript
*   **Runtime**: Bun.js
*   **CLI Framework**: `commander`
*   **Communication Protocol**: Nostr (via `@nostr-dev-kit/ndk`)
*   **LLM Abstraction**: `multi-llm-ts`
*   **Schema Validation**: `zod`
*   **CLI UI**: `chalk`, `inquirer`

### 2. Directory Structure

The repository is organized into several key directories, following a feature-based structure within `src/`.

*   `src/`: The main application source code.
*   `src/agents/`: Contains all logic related to AI agents, including their definition, execution loop (`AgentExecutor`, `ReasonActLoop`), and management (`AgentRegistry`).
*   `src/commands/`: Defines the CLI commands available through the `tenex` executable, such as `daemon`, `project`, `setup`, and `inventory`.
*   `src/conversations/`: Manages the state, history, and persistence of conversations, including the concept of "phases" that guide the workflow.
*   `src/daemon/`: Implements the long-running daemon process, which includes monitoring Nostr for events (`EventMonitor`) and managing project subprocesses (`ProcessManager`).
*   `src/event-handler/`: The core routing logic that receives Nostr events and dispatches them to appropriate handlers based on event kind (e.g., new conversation, reply).
*   `src/llm/`: An abstraction layer over the `multi-llm-ts` library. It handles routing requests to different LLMs, managing configurations, and adapting TENEX tools into the native function-calling plugin system.
*   `src/nostr/`: Encapsulates all interactions with the Nostr network, including event publishing, subscribing, and utility functions for event analysis.
*   `src/prompts/`: A powerful, modular system for building dynamic LLM prompts. It uses a `FragmentRegistry` and `PromptBuilder` to compose complex prompts from smaller, reusable, and prioritized fragments.
*   `src/services/`: Provides singleton services for application-wide concerns, primarily configuration management (`ConfigService`) and a global project context (`ProjectContext`).
*   `src/tools/`: Contains the definitions and implementations for all tools that agents can execute, such as `shell`, `readFile`, and the powerful `claude_code` and `analyze` tools.
*   `src/tracing/`: A lightweight tracing and logging system to provide contextualized debugging information across the distributed flow of an agent interaction.
*   `docs/`: Contains project documentation and design plans, notably the plan to migrate from XML-based tool use to native function calling.
*   `scripts/`: Utility scripts for building the application, and for viewing and analyzing tool and LLM log files.
*   `tests/`: Contains various test scripts for verifying model capabilities and the correct implementation of the native function calling system.

### 3. Significant Files

*   `src/tenex.ts`: The main CLI entry point, which configures and parses all user-facing commands using `commander`.
*   `src/daemon/daemon.ts`: The entry point for the long-running background daemon, responsible for initializing the `EventMonitor` and managing project lifecycles.
*   `src/event-handler/index.ts`: The central hub for processing incoming Nostr events. It determines the event type and routes it to the correct handler (e.g., `handleNewConversation`, `handleChatMessage`).
*   `src/agents/execution/AgentExecutor.ts`: The core engine for agent operation. It orchestrates a single "turn" for an agent, including building the prompt, calling the LLM, managing the tool execution loop (`ReasonActLoop`), and publishing the final response to Nostr.
*   `src/agents/AgentRegistry.ts`: Manages the lifecycle of project agents, handling their creation, storage (as JSON files and nsecs in `agents.json`), and retrieval. It ensures each agent has a valid Nostr identity.
*   `src/conversations/ConversationManager.ts`: A stateful class that manages the complete lifecycle of conversations, including creating them from Nostr events, tracking their phase transitions, and persisting their history to the filesystem.
*   `src/llm/router.ts`: Implements the `LLMService` interface. It routes LLM requests to the appropriate provider and model based on project and agent configuration. It's also responsible for wrapping TENEX `Tool`s into `ToolPlugin`s for the `multi-llm-ts` library.
*   `src/llm/ToolPlugin.ts`: The critical adapter that bridges the internal TENEX `Tool` interface with the `multi-llm-ts` `Plugin` interface, enabling native function calling across various LLMs.
*   `src/tools/registry.ts`: A central registry that holds all available `Tool` implementations, making them discoverable to the agent execution system.
*   `src/prompts/core/PromptBuilder.ts`: A key utility that enables the dynamic assembly of complex system prompts from a registry of smaller, reusable `PromptFragment`s.
*   `src/services/ConfigService.ts`: A singleton service that provides a unified API for loading and saving configuration files (`config.json`, `agents.json`, `llms.json`), intelligently merging global (`~/.tenex`) and project-local (`<project>/.tenex`) settings.
*   `src/services/ProjectContext.ts`: A singleton that holds the live state for a running project, including the `NDKProject` event and the map of all loaded agents, providing a single source of truth for the project's context.

### 4. Architectural Insights

*   **Daemonized, Process-per-Project Model**: The system operates with a central daemon (`tenex daemon`) that acts as a lightweight Nostr event monitor. Upon detecting relevant activity for a project, it spawns a separate, isolated `tenex project run` process. This architecture ensures that projects are sandboxed and that the core daemon remains stable and responsive, independent of the workload of any single project.
*   **Nostr as the Nervous System**: All communication, coordination, and state changes are mediated through Nostr events. This includes user-agent conversations, agent-to-agent handoffs, task creation, and status updates. This makes the entire system decentralized, transparent, and debuggable by observing Nostr relays.
*   **Orchestration via a PM Agent**: Instead of a hardcoded central loop, the system uses a designated "Project Manager" (PM) agent as the primary orchestrator. This agent is responsible for understanding user requests, managing conversation phases (`switch_phase` tool), and delegating tasks to specialist agents (`handoff` tool). This pattern makes the orchestration logic flexible and adaptable through prompting.
*   **Phased Conversation Workflow**: Conversations are not monolithic but progress through a series of well-defined phases (`chat`, `brainstorm`, `plan`, `execute`, `review`). Each phase provides agents with different context, constraints, and available tools, creating a structured and predictable workflow for software development tasks. This state is managed by the `ConversationManager`.
*   **Native Function Calling Abstraction**: The architecture has decisively shifted towards native LLM function calling, moving away from less reliable XML-based tool parsing. The `ToolPlugin` class serves as a brilliant adapter, allowing a single internal `Tool` definition to be used seamlessly across different LLM providers (Anthropic, OpenAI, Google) that support function calling via the `multi-llm-ts` library.
*   **Modular & Dynamic Prompting**: System prompts are not static text files. They are dynamically constructed at runtime by the `PromptBuilder`, which assembles `PromptFragment`s from a central `fragmentRegistry`. This powerful pattern allows for highly contextual and fine-tuned prompts that can be easily modified and extended without altering the core execution logic.
*   **Layered Configuration**: The `ConfigService` implements a two-tiered configuration system (global and project-specific). This allows users to define default LLM providers and credentials globally in their home directory, while also enabling projects to have their own specific agents and override LLM settings as needed.
*   **Comprehensive Inventory and Analysis**: The system integrates `repomix` to create a full-codebase context. The `generate_inventory` tool leverages this with an LLM to produce a detailed `INVENTORY.md` file, which is then fed back into the PM agent's context. This gives agents a deep, up-to-date understanding of the project's architecture and key components.

### 5. High-Complexity Modules

The following modules contain significant complexity and are central to the application's functionality.

*   **`src/agents/execution/AgentExecutor.ts`**: This is the orchestrator for an agent's turn. Its complexity lies in managing the rich context (agent, conversation, phase, tools), building dynamic prompts, executing the `ReasonActLoop` for tool usage, handling both streaming and non-streaming responses, and publishing results back to Nostr. It is the nexus where prompting, LLM interaction, and state management converge.

*   **`src/conversations/ConversationManager.ts`**: This class is the state machine for the entire system. It manages the lifecycle of multiple conversations, tracks their history and phase transitions, and handles their persistence to the filesystem via the `FileSystemAdapter`. The complexity arises from managing in-memory state, ensuring reliable serialization/deserialization of `NDKEvent` objects, and handling potential race conditions during file I/O.

*   **`src/llm/LLMConfigEditor.ts`**: This file implements the interactive CLI wizard for managing LLM configurations. Its complexity comes from its highly stateful, user-driven nature. It must handle both global and project-level configurations, dynamically fetch available models from multiple providers (which may require API keys), prompt for credentials securely, and perform live tests on new configurations before saving them.

```json
{
  "complexModules": [
    {
      "name": "AgentExecutor",
      "path": "src/agents/execution/AgentExecutor.ts",
      "reason": "This class is the core of agent orchestration. It manages the entire lifecycle of an agent's turn, including complex prompt building from multiple fragments, invoking the LLM, managing the Reason-Act loop for tool execution, handling streaming responses, and publishing events back to Nostr. Its high complexity comes from the coordination of these many asynchronous and context-dependent tasks.",
      "suggestedFilename": "AGENT_EXECUTOR_GUIDE.md"
    },
    {
      "name": "ConversationManager",
      "path": "src/conversations/ConversationManager.ts",
      "reason": "This module is responsible for managing the state and persistence of all conversations. Its complexity stems from tracking conversation history, managing workflow phase transitions, and interacting with the filesystem via the FileSystemAdapter. Ensuring data integrity, handling concurrent operations, and correctly serializing/deserializing Nostr events make it a critical and complex component.",
      "suggestedFilename": "CONVERSATION_MANAGER_GUIDE.md"
    },
    {
      "name": "LLMConfigEditor",
      "path": "src/llm/LLMConfigEditor.ts",
      "reason": "This file implements a complex, interactive CLI wizard for managing LLM configurations. It handles a multi-layered state (global vs. project), interacts with external APIs to fetch model lists, securely prompts for credentials, and performs live validation of new configurations. The branching logic to guide the user through setup and editing is extensive.",
      "suggestedFilename": "LLM_CONFIG_EDITOR_GUIDE.md"
    }
  ]
}
```