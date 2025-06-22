# Project Inventory

Generated: 2025-06-22T12:00:00.000Z (Manually updated after cleanup)
Version: 1.0.0

## Project Overview

**Description:** No description available
**Technologies:** Node.js, TypeScript

## Statistics

- Total Files: 177 (removed 14 files)
- Total Directories: 53
- Total Size: 1.60 MB

### File Types

- .ts: 151 files (removed 13 test files)
- .md: 15 files
- .json: 5 files
- .sh: 4 files
- no-extension: 1 files
- .txt: 1 files
- .toml: 1 files

## Directory Structure

- **bin/** - Directory containing 1 files
- **docs/** - Directory containing 1 files
- **scripts/** - Directory containing 1 files
- **src/** - Directory containing 3 files
- **tests/** - Directory containing 0 files
    - **src/agents/__tests__/** - Directory containing 1 files
    - **src/agents/execution/** - Directory containing 4 files
    - **src/commands/debug/** - Directory containing 2 files
    - **src/commands/inventory/** - Directory containing 1 files
    - **src/commands/project/** - Directory containing 3 files
    - **src/commands/run/** - Directory containing 7 files
    - **src/commands/setup/** - Directory containing 2 files
    - **src/conversations/__tests__/** - Directory containing 2 files
    - **src/conversations/persistence/** - Directory containing 3 files
    - **src/core/llm/** - Directory containing 4 files
    - **src/core/types/** - Directory containing 1 files
    - **src/core/llm/** - Directory containing 5 files (moved LLMConfigEditor.ts here)
    - **src/phases/__tests__/** - Directory containing 1 files
    - **src/prompts/__tests__/** - Directory containing 4 files
    - **src/prompts/core/** - Directory containing 5 files
    - **src/prompts/fragments/** - Directory containing 10 files
    - **src/routing/__tests__/** - Directory containing 1 files
    - **src/services/__tests__/** - Directory containing 2 files
    - **src/tasks/__tests__/** - Directory containing 1 files
    - **src/test-utils/helpers/** - Directory containing 2 files (removed assertions.ts, async.ts)
    - **src/test-utils/mocks/** - Directory containing 6 files
    - **src/tools/execution/** - Directory containing 4 files
    - **src/utils/claude/** - Directory containing 1 files
      - **src/agents/execution/__tests__/** - Directory containing 2 files
      - **src/tools/execution/__tests__/** - Directory containing 2 files
      - **src/tools/execution/executors/** - Directory containing 3 files
  - **src/agents/** - Directory containing 3 files
  - **src/commands/** - Directory containing 1 files
  - **src/conversations/** - Directory containing 3 files
  - **src/core/** - Directory containing 1 files
  - **src/daemon/** - Directory containing 3 files
  - **src/debug/** - Directory containing 4 files
  - **src/llm/** - Directory removed (contents moved to src/core/llm)
  - **src/nostr/** - Directory containing 3 files
  - **src/phases/** - Directory containing 9 files
  - **src/prompts/** - Directory containing 3 files
  - **src/routing/** - Directory containing 6 files
  - **src/runtime/** - Directory containing 2 files
  - **src/services/** - Directory containing 1 files
  - **src/tasks/** - Directory containing 1 files
  - **src/test-utils/** - Directory containing 0 files
  - **src/tools/** - Directory containing 2 files
  - **src/tracing/** - Directory containing 3 files
  - **src/types/** - Directory containing 6 files
  - **src/utils/** - Directory containing 6 files (removed agents.ts, added string.ts)
  - **tests/e2e/** - Directory containing 1 files

## Files

### Root

- **.npmignore** - no-extension file
- **.repomix-output.txt** - .txt file
- **.wallet.json** - .json file
- **ADDITIONAL_ARCHITECTURE_DIAGRAMS.md** - .md file
- **AGENT_EXECUTION_SYSTEM.md** - .md file
- **AGENTIC_ROUTING_SYSTEM.md** - .md file
- **ARCHITECTURE_OVERVIEW.md** - .md file
- **ARCHITECTURE_SUMMARY.md** - .md file
- **ARCHITECTURE.md** - .md file
- **biome.json** - .json file
- **bunfig.toml** - .toml file
- **check_orphaned_files.sh** - .sh file
- **find_orphaned_files.sh** - .sh file
- **IMPLEMENTATION_PLAN.md** - .md file
- **INTEGRATION_COMPLETE.md** - .md file
- **llms.json** - .json file
- **LOGGING_GUIDE.md** - .md file
- **package.json** - .json file
- **PROMPT_SYSTEM_EXAMPLE.md** - .md file
- **SYSTEM_ARCHITECTURE_DIAGRAMS.md** - .md file
- **SYSTEM_DATA_FLOWS.md** - .md file
- **TEST_AND_DEBUG.md** - .md file [test]
- **test-debug-chat.sh** - .sh file [test]
- **test-routing-enhancement.ts** - .ts file [test]
- **tsconfig.json** - .json file [configuration]

### bin


### docs

- **TESTING.md** - .md file [test]

### scripts

- **test-all.sh** - .sh file [test]

### src/agents

- **agentFactoryFunctions.ts** - .ts file
- **AgentRegistry.ts** - .ts file
- **index.ts** - .ts file

### src/agents/__tests__

- **AgentRegistry.test.ts** - .ts file [test]

### src/agents/execution

- **AgentExecutor.ts** - .ts file
- **AgentPromptBuilder.ts** - .ts file
- **index.ts** - .ts file
- **types.ts** - .ts file [types]

### src/agents/execution/__tests__

- **AgentExecutor.integration.test.ts** - .ts file [test]
- **AgentExecutor.test.ts** - .ts file [test]

### src

- **cli.ts** - .ts file
- **index.ts** - .ts file
- **types.ts** - .ts file [types]

### src/commands

- **daemon.ts** - .ts file

### src/commands/debug

- **chat.ts** - .ts file
- **index.ts** - .ts file

### src/commands/inventory

- **index.ts** - .ts file

### src/commands/project

- **index.ts** - .ts file
- **init.ts** - .ts file
- **run.ts** - .ts file

### src/commands/run

- **constants.ts** - .ts file
- **EventHandler.ts** - .ts file
- **processedEventTracking.ts** - .ts file
- **ProjectDisplay.ts** - .ts file
- **ProjectLoader.ts** - .ts file
- **StatusPublisher.ts** - .ts file
- **SubscriptionManager.ts** - .ts file

### src/commands/setup

- **index.ts** - .ts file
- **llm.ts** - .ts file

### src/commands/test

- **agent-execution.ts** - .ts file [test]
- **conversation.ts** - .ts file [test]
- **index.ts** - .ts file [test]
- **integration.ts** - .ts file [test]
- **phases.ts** - .ts file [test]

### src/conversations

- **ConversationManager.ts** - .ts file
- **index.ts** - .ts file
- **types.ts** - .ts file [types]

### src/conversations/__tests__

- **ConversationManager.integration.test.ts** - .ts file [test]
- **ConversationManager.test.ts** - .ts file [test]

### src/conversations/persistence

- **FileSystemAdapter.ts** - .ts file
- **index.ts** - .ts file
- **types.ts** - .ts file [types]

### src/core

- **index.ts** - .ts file

### src/core/llm

- **index.ts** - .ts file
- **LLMServiceFactory.ts** - .ts file [service]
- **MultiLLMService.ts** - .ts file [service]
- **types.ts** - .ts file [types]

### src/core/types

- **agents.ts** - .ts file [types]

### src/daemon

- **EventMonitor.ts** - .ts file
- **ProcessManager.ts** - .ts file
- **ProjectManager.ts** - .ts file

### src/debug

- **createDebugAgentSystem.ts** - .ts file
- **DebugAgent.ts** - .ts file
- **index.ts** - .ts file
- **utils.ts** - .ts file [utility]

### src/llm

- **ConfigManager.ts** - .ts file [configuration]
- **index.ts** - .ts file
- **LLMService.ts** - .ts file [service]
- **types.ts** - .ts file [types]

### src/llm/__tests__

- **LLMConfigManager.test.ts** - .ts file [test, configuration]
- **LLMService.test.ts** - .ts file [test, service]

### src/llm/providers

- **MockProvider.ts** - .ts file

### src/nostr

- **ConversationPublisher.ts** - .ts file
- **index.ts** - .ts file
- **ndkClient.ts** - .ts file

### src/phases

- **ChatPhaseInitializer.ts** - .ts file
- **ChoresPhaseInitializer.ts** - .ts file
- **ExecutePhaseInitializer.ts** - .ts file
- **index.ts** - .ts file
- **phaseInitializers.ts** - .ts file
- **PlanPhaseInitializer.ts** - .ts file
- **ReviewPhaseInitializer.ts** - .ts file
- **types.ts** - .ts file [types]

### src/phases/__tests__

- **ChoresPhaseInitializer.test.ts** - .ts file [test]

### src/prompts/__tests__

- **FragmentRegistry.test.ts** - .ts file [test]
- **fragments.test.ts** - .ts file [test]
- **integration.test.ts** - .ts file [test]
- **PromptBuilder.test.ts** - .ts file [test]

### src/prompts/core

- **FragmentRegistry.ts** - .ts file
- **index.ts** - .ts file
- **PromptBuilder.ts** - .ts file
- **types.ts** - .ts file [types]
- **validation.ts** - .ts file

### src/prompts

- **example.ts** - .ts file
- **index.ts** - .ts file
- **routingPrompts.ts** - .ts file

### src/prompts/fragments

- **agent-specific.ts** - .ts file [test]
- **agent.ts** - .ts file
- **common.ts** - .ts file
- **context.ts** - .ts file
- **generic.ts** - .ts file
- **inventory.ts** - .ts file
- **project.ts** - .ts file
- **routing-system.ts** - .ts file

### src/core/llm

- **index.ts** - .ts file
- **LLMConfigEditor.ts** - .ts file [configuration]
- **MultiLLMService.ts** - .ts file [service]
- **types.ts** - .ts file [types]
- **routing.ts** - .ts file
- **tools.ts** - .ts file

### src/routing

- **ConversationRouter.ts** - .ts file [api]
- **index.ts** - .ts file
- **routingDomain.ts** - .ts file
- **RoutingLLM.ts** - .ts file
- **types.ts** - .ts file [types]

### src/routing/__tests__

- **RoutingLLM.test.ts** - .ts file [test]

### src/runtime

- **index.ts** - .ts file
- **ProjectContext.ts** - .ts file

### src/services


### src/services/__tests__

- **InventoryService.integration.test.ts** - .ts file [test, service]
- **InventoryService.test.ts** - .ts file [test, service]

### src/tasks/__tests__

- **analyzeTask.test.ts** - .ts file [test]

### src/tasks

- **analyzeTask.ts** - .ts file

### src/test-utils/helpers

- **fixtures.ts** - .ts file [test, utility]
- **index.ts** - .ts file [test, utility]

### src/test-utils/mocks

- **agents.ts** - .ts file [test, utility]
- **events.ts** - .ts file [test, utility]
- **filesystem.ts** - .ts file [test, utility]
- **index.ts** - .ts file [test, utility]
- **llm.ts** - .ts file [test, utility]
- **ndk.ts** - .ts file [test, utility]

### src/tools

- **index.ts** - .ts file

### src/tools/claude

- **ClaudeCodeExecutor.ts** - .ts file
- **types.ts** - .ts file [types]

### src/tools/execution

- **index.ts** - .ts file
- **ToolDetector.ts** - .ts file
- **ToolExecutionManager.ts** - .ts file
- **types.ts** - .ts file [types]

### src/tools/execution/__tests__

- **ToolDetector.test.ts** - .ts file [test]
- **ToolExecutionManager.test.ts** - .ts file [test]

### src/tools/execution/executors

- **FileExecutor.ts** - .ts file
- **index.ts** - .ts file
- **ShellExecutor.ts** - .ts file

### src/tracing

- **index.ts** - .ts file
- **TracingContext.ts** - .ts file
- **TracingLogger.ts** - .ts file

### src/types

- **agent.ts** - .ts file [types]
- **conversation.ts** - .ts file [types]
- **index.ts** - .ts file [types]
- **llm.ts** - .ts file [types]
- **nostr.ts** - .ts file [types]
- **routing.ts** - .ts file [types]

### src/utils

- **string.ts** - .ts file [utility]
- **errors.ts** - .ts file [utility]
- **inventory.ts** - .ts file [utility]
- **project.ts** - .ts file [utility]
- **setup.ts** - .ts file [utility]

### src/utils/claude

- **ClaudeParser.ts** - .ts file [utility]

### tests/e2e

- **conversation-flow.test.ts** - .ts file [test]

<!--
INVENTORY_DATA:
{
  "projectPath": "/Users/pablofernandez/projects/TENEX-15czp8/tenex",
  "generatedAt": 1750537206170,
  "version": "1.0.0",
  "projectDescription": "No description available",
  "technologies": [
    "Node.js",
    "TypeScript"
  ],
  "files": [
    {
      "path": ".npmignore",
      "type": "no-extension",
      "description": "no-extension file",
      "size": 524,
      "lastModified": 1750377506348.97,
      "tags": []
    },
    {
      "path": ".repomix-output.txt",
      "type": ".txt",
      "description": ".txt file",
      "size": 839829,
      "lastModified": 1750536395529.297,
      "tags": []
    },
    {
      "path": ".wallet.json",
      "type": ".json",
      "description": ".json file",
      "size": 429,
      "lastModified": 1750458274957.2908,
      "tags": []
    },
    {
      "path": "ADDITIONAL_ARCHITECTURE_DIAGRAMS.md",
      "type": ".md",
      "description": ".md file",
      "size": 14697,
      "lastModified": 1750518169300.267,
      "tags": []
    },
    {
      "path": "AGENTIC_ROUTING_SYSTEM.md",
      "type": ".md",
      "description": ".md file",
      "size": 6004,
      "lastModified": 1750460333055.7332,
      "tags": []
    },
    {
      "path": "AGENT_EXECUTION_SYSTEM.md",
      "type": ".md",
      "description": ".md file",
      "size": 5114,
      "lastModified": 1750460319358.8716,
      "tags": []
    },
    {
      "path": "ARCHITECTURE.md",
      "type": ".md",
      "description": ".md file",
      "size": 9957,
      "lastModified": 1750490478410.563,
      "tags": []
    },
    {
      "path": "ARCHITECTURE_OVERVIEW.md",
      "type": ".md",
      "description": ".md file",
      "size": 10482,
      "lastModified": 1750518229078.5613,
      "tags": []
    },
    {
      "path": "ARCHITECTURE_SUMMARY.md",
      "type": ".md",
      "description": ".md file",
      "size": 5770,
      "lastModified": 1750452442879.3262,
      "tags": []
    },
    {
      "path": "DEBUG_CHAT_RESTORATION_PLAN.md",
      "type": ".md",
      "description": ".md file",
      "size": 5097,
      "lastModified": 1750457919236.1248,
      "tags": []
    },
    {
      "path": "IMPLEMENTATION_PLAN.md",
      "type": ".md",
      "description": ".md file",
      "size": 12543,
      "lastModified": 1750452426570.944,
      "tags": []
    },
    {
      "path": "INTEGRATION_COMPLETE.md",
      "type": ".md",
      "description": ".md file",
      "size": 2749,
      "lastModified": 1750457925846.6694,
      "tags": []
    },
    {
      "path": "LOGGING_GUIDE.md",
      "type": ".md",
      "description": ".md file",
      "size": 9467,
      "lastModified": 1750537115765.6062,
      "tags": []
    },
    {
      "path": "PROMPT_SYSTEM_EXAMPLE.md",
      "type": ".md",
      "description": ".md file",
      "size": 3198,
      "lastModified": 1750452481275.0505,
      "tags": []
    },
    {
      "path": "SYSTEM_ARCHITECTURE_DIAGRAMS.md",
      "type": ".md",
      "description": ".md file",
      "size": 15792,
      "lastModified": 1750518012432.9966,
      "tags": []
    },
    {
      "path": "SYSTEM_DATA_FLOWS.md",
      "type": ".md",
      "description": ".md file",
      "size": 9822,
      "lastModified": 1750518080707.0515,
      "tags": []
    },
    {
      "path": "TEST_AND_DEBUG.md",
      "type": ".md",
      "description": ".md file",
      "size": 5201,
      "lastModified": 1750455630279.3394,
      "tags": [
        "test"
      ]
    },
    {
      "path": "bin/tenex.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 1692,
      "lastModified": 1750408593159.8013,
      "tags": []
    },
    {
      "path": "biome.json",
      "type": ".json",
      "description": ".json file",
      "size": 910,
      "lastModified": 1750408593157.078,
      "tags": []
    },
    {
      "path": "bunfig.toml",
      "type": ".toml",
      "description": ".toml file",
      "size": 483,
      "lastModified": 1750471556906.9473,
      "tags": []
    },
    {
      "path": "check_orphaned_files.sh",
      "type": ".sh",
      "description": ".sh file",
      "size": 2000,
      "lastModified": 1750378212650.192,
      "tags": []
    },
    {
      "path": "docs/TESTING.md",
      "type": ".md",
      "description": ".md file",
      "size": 6578,
      "lastModified": 1750465269033.0913,
      "tags": [
        "test"
      ]
    },
    {
      "path": "find_orphaned_files.sh",
      "type": ".sh",
      "description": ".sh file",
      "size": 3472,
      "lastModified": 1750378244940.9373,
      "tags": []
    },
    {
      "path": "llm-tools-example.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 8656,
      "lastModified": 1750464072916.2424,
      "tags": []
    },
    {
      "path": "llm-tools-types.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 175,
      "lastModified": 1750464072911.8486,
      "tags": [
        "types"
      ]
    },
    {
      "path": "llms.json",
      "type": ".json",
      "description": ".json file",
      "size": 565,
      "lastModified": 1750439426587.6833,
      "tags": []
    },
    {
      "path": "package.json",
      "type": ".json",
      "description": ".json file",
      "size": 1656,
      "lastModified": 1750465073602.7024,
      "tags": []
    },
    {
      "path": "parser-test.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 1606,
      "lastModified": 1750458274967.1726,
      "tags": [
        "test"
      ]
    },
    {
      "path": "scripts/test-all.sh",
      "type": ".sh",
      "description": ".sh file",
      "size": 1424,
      "lastModified": 1750465283314.7678,
      "tags": [
        "test"
      ]
    },
    {
      "path": "src/agents/AgentRegistry.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 5935,
      "lastModified": 1750520236506.3303,
      "tags": []
    },
    {
      "path": "src/agents/__tests__/AgentRegistry.test.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 11973,
      "lastModified": 1750464711435.4548,
      "tags": [
        "test"
      ]
    },
    {
      "path": "src/agents/agentFactoryFunctions.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 2278,
      "lastModified": 1750514124327.3965,
      "tags": []
    },
    {
      "path": "src/agents/execution/AgentExecutor.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 11384,
      "lastModified": 1750536938496.8142,
      "tags": []
    },
    {
      "path": "src/agents/execution/AgentPromptBuilder.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 7498,
      "lastModified": 1750514181434.0645,
      "tags": []
    },
    {
      "path": "src/agents/execution/__tests__/AgentExecutor.integration.test.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 11232,
      "lastModified": 1750465147143.55,
      "tags": [
        "test"
      ]
    },
    {
      "path": "src/agents/execution/__tests__/AgentExecutor.test.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 10687,
      "lastModified": 1750512850421.8953,
      "tags": [
        "test"
      ]
    },
    {
      "path": "src/agents/execution/index.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 96,
      "lastModified": 1750464072911.9395,
      "tags": []
    },
    {
      "path": "src/agents/execution/types.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 1024,
      "lastModified": 1750463871772.9172,
      "tags": [
        "types"
      ]
    },
    {
      "path": "src/agents/index.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 377,
      "lastModified": 1750490811131.7024,
      "tags": []
    },
    {
      "path": "src/cli.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 1843,
      "lastModified": 1750514605671.2688,
      "tags": []
    },
    {
      "path": "src/commands/daemon.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 4757,
      "lastModified": 1750438759116.4565,
      "tags": []
    },
    {
      "path": "src/commands/debug/chat.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 4369,
      "lastModified": 1750492231279.7732,
      "tags": []
    },
    {
      "path": "src/commands/debug/index.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 1685,
      "lastModified": 1750492256071.8708,
      "tags": []
    },
    {
      "path": "src/commands/inventory/index.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 7681,
      "lastModified": 1750518254386.6682,
      "tags": []
    },
    {
      "path": "src/commands/project/index.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 327,
      "lastModified": 1750408593162.0452,
      "tags": []
    },
    {
      "path": "src/commands/project/init.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 1488,
      "lastModified": 1750438811161.5205,
      "tags": []
    },
    {
      "path": "src/commands/project/run.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 3811,
      "lastModified": 1750408593163.643,
      "tags": []
    },
    {
      "path": "src/commands/run/EventHandler.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 15908,
      "lastModified": 1750516564976.3987,
      "tags": []
    },
    {
      "path": "src/commands/run/ProjectDisplay.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 3113,
      "lastModified": 1750458274970.4968,
      "tags": []
    },
    {
      "path": "src/commands/run/ProjectLoader.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 6134,
      "lastModified": 1750514902562.3108,
      "tags": []
    },
    {
      "path": "src/commands/run/StatusPublisher.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 3250,
      "lastModified": 1750514124330.5747,
      "tags": []
    },
    {
      "path": "src/commands/run/SubscriptionManager.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 4229,
      "lastModified": 1750514124331.156,
      "tags": []
    },
    {
      "path": "src/commands/run/constants.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 1083,
      "lastModified": 1750463676464.2812,
      "tags": []
    },
    {
      "path": "src/commands/run/processedEventTracking.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 4094,
      "lastModified": 1750492831039.186,
      "tags": []
    },
    {
      "path": "src/commands/setup/index.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 216,
      "lastModified": 1750514402385.872,
      "tags": []
    },
    {
      "path": "src/commands/setup/llm.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 34533,
      "lastModified": 1750516533833.0752,
      "tags": []
    },
    {
      "path": "src/commands/test/agent-execution.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 686,
      "lastModified": 1750460272568.4111,
      "tags": [
        "test"
      ]
    },
    {
      "path": "src/commands/test/conversation.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 3549,
      "lastModified": 1750455554403.1924,
      "tags": [
        "test"
      ]
    },
    {
      "path": "src/commands/test/index.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 657,
      "lastModified": 1750460282080.2502,
      "tags": [
        "test"
      ]
    },
    {
      "path": "src/commands/test/integration.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 689,
      "lastModified": 1750457162312.6323,
      "tags": [
        "test"
      ]
    },
    {
      "path": "src/commands/test/phases.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 670,
      "lastModified": 1750457155973.5122,
      "tags": [
        "test"
      ]
    },
    {
      "path": "src/conversations/ConversationManager.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 9423,
      "lastModified": 1750537184662.3845,
      "tags": []
    },
    {
      "path": "src/conversations/__tests__/ConversationManager.integration.test.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 13316,
      "lastModified": 1750465224228.0107,
      "tags": [
        "test"
      ]
    },
    {
      "path": "src/conversations/__tests__/ConversationManager.test.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 13464,
      "lastModified": 1750464837997.085,
      "tags": [
        "test"
      ]
    },
    {
      "path": "src/conversations/index.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 86,
      "lastModified": 1750458274970.685,
      "tags": []
    },
    {
      "path": "src/conversations/persistence/FileSystemAdapter.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 11145,
      "lastModified": 1750514124338.7134,
      "tags": []
    },
    {
      "path": "src/conversations/persistence/index.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 62,
      "lastModified": 1750464072915.456,
      "tags": []
    },
    {
      "path": "src/conversations/persistence/types.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 870,
      "lastModified": 1750464072915.8357,
      "tags": [
        "types"
      ]
    },
    {
      "path": "src/conversations/types.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 738,
      "lastModified": 1750464287881.714,
      "tags": [
        "types"
      ]
    },
    {
      "path": "src/core/index.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 124,
      "lastModified": 1750438899259.4927,
      "tags": []
    },
    {
      "path": "src/core/llm/LLMServiceFactory.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 736,
      "lastModified": 1750514540341.3457,
      "tags": [
        "service"
      ]
    },
    {
      "path": "src/core/llm/MultiLLMService.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 9264,
      "lastModified": 1750514918489.069,
      "tags": [
        "service"
      ]
    },
    {
      "path": "src/core/llm/index.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 96,
      "lastModified": 1750514600740.227,
      "tags": []
    },
    {
      "path": "src/core/llm/types.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 1549,
      "lastModified": 1750514528798.6838,
      "tags": [
        "types"
      ]
    },
    {
      "path": "src/core/types/agents.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 258,
      "lastModified": 1750458274971.4026,
      "tags": [
        "types"
      ]
    },
    {
      "path": "src/daemon/EventMonitor.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 3884,
      "lastModified": 1750458274972.456,
      "tags": []
    },
    {
      "path": "src/daemon/ProcessManager.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 3709,
      "lastModified": 1750408593167.0378,
      "tags": []
    },
    {
      "path": "src/daemon/ProjectManager.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 13301,
      "lastModified": 1750514716244.5593,
      "tags": []
    },
    {
      "path": "src/debug/DebugAgent.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 5894,
      "lastModified": 1750464229443.6382,
      "tags": []
    },
    {
      "path": "src/debug/createDebugAgentSystem.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 5151,
      "lastModified": 1750514124333.617,
      "tags": []
    },
    {
      "path": "src/debug/index.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 254,
      "lastModified": 1750458274971.8987,
      "tags": []
    },
    {
      "path": "src/debug/utils.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 274,
      "lastModified": 1750464412284.291,
      "tags": [
        "utility"
      ]
    },
    {
      "path": "src/index.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 190,
      "lastModified": 1750378151342.7354,
      "tags": []
    },
    {
      "path": "src/llm/ConfigManager.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 3993,
      "lastModified": 1750514124335.9084,
      "tags": [
        "configuration"
      ]
    },
    {
      "path": "src/llm/LLMService.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 6485,
      "lastModified": 1750514139918.9287,
      "tags": [
        "service"
      ]
    },
    {
      "path": "src/llm/__tests__/LLMConfigManager.test.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 8261,
      "lastModified": 1750464583267.0618,
      "tags": [
        "test",
        "configuration"
      ]
    },
    {
      "path": "src/llm/__tests__/LLMService.test.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 9813,
      "lastModified": 1750471648037.7717,
      "tags": [
        "test",
        "service"
      ]
    },
    {
      "path": "src/llm/index.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 120,
      "lastModified": 1750458274971.9407,
      "tags": []
    },
    {
      "path": "src/llm/providers/MockProvider.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 2594,
      "lastModified": 1750514124333.2458,
      "tags": []
    },
    {
      "path": "src/llm/types.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 776,
      "lastModified": 1750514124332.3982,
      "tags": [
        "types"
      ]
    },
    {
      "path": "src/nostr/ConversationPublisher.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 4151,
      "lastModified": 1750514192190.715,
      "tags": []
    },
    {
      "path": "src/nostr/index.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 103,
      "lastModified": 1750458274972.4297,
      "tags": []
    },
    {
      "path": "src/nostr/ndkClient.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 1015,
      "lastModified": 1750408593172.002,
      "tags": []
    },
    {
      "path": "src/phases/ChatPhaseInitializer.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 1530,
      "lastModified": 1750487610683.1692,
      "tags": []
    },
    {
      "path": "src/phases/ChoresPhaseInitializer.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 5452,
      "lastModified": 1750514284208.259,
      "tags": []
    },
    {
      "path": "src/phases/ExecutePhaseInitializer.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 5967,
      "lastModified": 1750514041208.471,
      "tags": []
    },
    {
      "path": "src/phases/PhaseInitializer.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 1184,
      "lastModified": 1750492863427.95,
      "tags": []
    },
    {
      "path": "src/phases/PhaseInitializerFactory.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 1341,
      "lastModified": 1750514299575.0745,
      "tags": []
    },
    {
      "path": "src/phases/PlanPhaseInitializer.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 7093,
      "lastModified": 1750514124336.702,
      "tags": []
    },
    {
      "path": "src/phases/ReviewPhaseInitializer.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 3296,
      "lastModified": 1750514061292.2715,
      "tags": []
    },
    {
      "path": "src/phases/__tests__/ChoresPhaseInitializer.test.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 10000,
      "lastModified": 1750514496630.8235,
      "tags": [
        "test"
      ]
    },
    {
      "path": "src/phases/index.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 286,
      "lastModified": 1750514617500.3289,
      "tags": []
    },
    {
      "path": "src/phases/types.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 522,
      "lastModified": 1750464072920.6182,
      "tags": [
        "types"
      ]
    },
    {
      "path": "src/prompts/__tests__/FragmentRegistry.test.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 3330,
      "lastModified": 1750454960575.4407,
      "tags": [
        "test"
      ]
    },
    {
      "path": "src/prompts/__tests__/PromptBuilder.test.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 7574,
      "lastModified": 1750454960577.7344,
      "tags": [
        "test"
      ]
    },
    {
      "path": "src/prompts/__tests__/fragments.test.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 5801,
      "lastModified": 1750454960573.106,
      "tags": [
        "test"
      ]
    },
    {
      "path": "src/prompts/__tests__/integration.test.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 6588,
      "lastModified": 1750454960580.0232,
      "tags": [
        "test"
      ]
    },
    {
      "path": "src/prompts/core/FragmentRegistry.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 665,
      "lastModified": 1750458274975.415,
      "tags": []
    },
    {
      "path": "src/prompts/core/PromptBuilder.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 2648,
      "lastModified": 1750514124336.8362,
      "tags": []
    },
    {
      "path": "src/prompts/core/index.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 185,
      "lastModified": 1750458274975.4204,
      "tags": []
    },
    {
      "path": "src/prompts/core/types.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 363,
      "lastModified": 1750513324259.1294,
      "tags": [
        "types"
      ]
    },
    {
      "path": "src/prompts/core/validation.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 2181,
      "lastModified": 1750514124337.713,
      "tags": []
    },
    {
      "path": "src/prompts/example.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 2688,
      "lastModified": 1750458274976.8564,
      "tags": []
    },
    {
      "path": "src/prompts/fragments/agent-specific.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 1478,
      "lastModified": 1750458274976.8955,
      "tags": [
        "test"
      ]
    },
    {
      "path": "src/prompts/fragments/agent.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 1747,
      "lastModified": 1750492889499.5466,
      "tags": []
    },
    {
      "path": "src/prompts/fragments/common.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 3495,
      "lastModified": 1750458967854.0298,
      "tags": []
    },
    {
      "path": "src/prompts/fragments/context.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 1303,
      "lastModified": 1750458274977.332,
      "tags": []
    },
    {
      "path": "src/prompts/fragments/generic.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 2125,
      "lastModified": 1750458274976.8975,
      "tags": []
    },
    {
      "path": "src/prompts/fragments/inventory.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 6062,
      "lastModified": 1750514124340.407,
      "tags": []
    },
    {
      "path": "src/prompts/fragments/project.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 1783,
      "lastModified": 1750514162451.3303,
      "tags": []
    },
    {
      "path": "src/prompts/fragments/routing-system.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 3743,
      "lastModified": 1750537151903.2007,
      "tags": []
    },
    {
      "path": "src/prompts/fragments/routing.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 692,
      "lastModified": 1750458274977.9026,
      "tags": []
    },
    {
      "path": "src/prompts/fragments/tools.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 747,
      "lastModified": 1750458274977.1348,
      "tags": []
    },
    {
      "path": "src/prompts/index.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 750,
      "lastModified": 1750514068319.2532,
      "tags": []
    },
    {
      "path": "src/prompts/routingPrompts.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 1020,
      "lastModified": 1750514124337.8892,
      "tags": []
    },
    {
      "path": "src/routing/ConversationRouter.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 12340,
      "lastModified": 1750514124341.8655,
      "tags": [
        "api"
      ]
    },
    {
      "path": "src/routing/RoutingDomainService.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 7839,
      "lastModified": 1750514124341.3662,
      "tags": [
        "service"
      ]
    },
    {
      "path": "src/routing/RoutingLLM.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 13753,
      "lastModified": 1750537093446.8916,
      "tags": []
    },
    {
      "path": "src/routing/__tests__/RoutingLLM.test.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 11294,
      "lastModified": 1750465015745.9668,
      "tags": [
        "test"
      ]
    },
    {
      "path": "src/routing/index.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 232,
      "lastModified": 1750490868617.005,
      "tags": []
    },
    {
      "path": "src/routing/routingDomainFunctions.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 7990,
      "lastModified": 1750514356970.215,
      "tags": []
    },
    {
      "path": "src/routing/types.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 839,
      "lastModified": 1750458274978.3142,
      "tags": [
        "types"
      ]
    },
    {
      "path": "src/runtime/ProjectContext.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 758,
      "lastModified": 1750458750039.1804,
      "tags": []
    },
    {
      "path": "src/runtime/index.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 34,
      "lastModified": 1750458274977.9426,
      "tags": []
    },
    {
      "path": "src/services/InventoryService.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 17237,
      "lastModified": 1750520071202.3042,
      "tags": [
        "service"
      ]
    },
    {
      "path": "src/services/__tests__/InventoryService.integration.test.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 10123,
      "lastModified": 1750514816482.2427,
      "tags": [
        "test",
        "service"
      ]
    },
    {
      "path": "src/services/__tests__/InventoryService.test.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 16854,
      "lastModified": 1750514644615.932,
      "tags": [
        "test",
        "service"
      ]
    },
    {
      "path": "src/tasks/__tests__/analyzeTask.test.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 10524,
      "lastModified": 1750514547632.2568,
      "tags": [
        "test"
      ]
    },
    {
      "path": "src/tasks/analyzeTask.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 12548,
      "lastModified": 1750537073772.814,
      "tags": []
    },
    {
      "path": "src/test-utils/helpers/assertions.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 2307,
      "lastModified": 1750514124341.9924,
      "tags": [
        "test",
        "utility"
      ]
    },
    {
      "path": "src/test-utils/helpers/async.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 1894,
      "lastModified": 1750514124340.176,
      "tags": [
        "test",
        "utility"
      ]
    },
    {
      "path": "src/test-utils/helpers/fixtures.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 1600,
      "lastModified": 1750514124339.9082,
      "tags": [
        "test",
        "utility"
      ]
    },
    {
      "path": "src/test-utils/helpers/index.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 83,
      "lastModified": 1750514124339.6685,
      "tags": [
        "test",
        "utility"
      ]
    },
    {
      "path": "src/test-utils/mocks/agents.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 2357,
      "lastModified": 1750514124341.1658,
      "tags": [
        "test",
        "utility"
      ]
    },
    {
      "path": "src/test-utils/mocks/events.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 2493,
      "lastModified": 1750514124343.4026,
      "tags": [
        "test",
        "utility"
      ]
    },
    {
      "path": "src/test-utils/mocks/filesystem.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 2949,
      "lastModified": 1750514124342.5535,
      "tags": [
        "test",
        "utility"
      ]
    },
    {
      "path": "src/test-utils/mocks/index.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 128,
      "lastModified": 1750464412288.9788,
      "tags": [
        "test",
        "utility"
      ]
    },
    {
      "path": "src/test-utils/mocks/llm.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 2885,
      "lastModified": 1750514124342.8726,
      "tags": [
        "test",
        "utility"
      ]
    },
    {
      "path": "src/test-utils/mocks/ndk.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 2558,
      "lastModified": 1750514124342.5461,
      "tags": [
        "test",
        "utility"
      ]
    },
    {
      "path": "src/tools/ClaudeCodeExecutor.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 11282,
      "lastModified": 1750537122813.239,
      "tags": []
    },
    {
      "path": "src/tools/execution/ToolDetector.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 3054,
      "lastModified": 1750514124344.3657,
      "tags": []
    },
    {
      "path": "src/tools/execution/ToolExecutionManager.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 4268,
      "lastModified": 1750490621388.4421,
      "tags": []
    },
    {
      "path": "src/tools/execution/__tests__/ToolDetector.test.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 7246,
      "lastModified": 1750513721716.2407,
      "tags": [
        "test"
      ]
    },
    {
      "path": "src/tools/execution/__tests__/ToolExecutionManager.test.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 12145,
      "lastModified": 1750464946519.4602,
      "tags": [
        "test"
      ]
    },
    {
      "path": "src/tools/execution/executors/FileExecutor.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 4691,
      "lastModified": 1750464267030.1375,
      "tags": []
    },
    {
      "path": "src/tools/execution/executors/ShellExecutor.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 2389,
      "lastModified": 1750464267032.1184,
      "tags": []
    },
    {
      "path": "src/tools/execution/executors/index.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 65,
      "lastModified": 1750464072925.0537,
      "tags": []
    },
    {
      "path": "src/tools/execution/index.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 126,
      "lastModified": 1750464072924.235,
      "tags": []
    },
    {
      "path": "src/tools/execution/types.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 716,
      "lastModified": 1750464072924.944,
      "tags": [
        "types"
      ]
    },
    {
      "path": "src/tools/index.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 148,
      "lastModified": 1750458274978.6008,
      "tags": []
    },
    {
      "path": "src/tracing/TracingContext.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 4285,
      "lastModified": 1750536995461.0068,
      "tags": []
    },
    {
      "path": "src/tracing/TracingLogger.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 5380,
      "lastModified": 1750537024742.8723,
      "tags": []
    },
    {
      "path": "src/tracing/index.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 66,
      "lastModified": 1750537031245.264,
      "tags": []
    },
    {
      "path": "src/types/agent.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 1514,
      "lastModified": 1750492287096.591,
      "tags": [
        "types"
      ]
    },
    {
      "path": "src/types/conversation.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 505,
      "lastModified": 1750513881213.0667,
      "tags": [
        "types"
      ]
    },
    {
      "path": "src/types/index.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 346,
      "lastModified": 1750459003390.4526,
      "tags": [
        "types"
      ]
    },
    {
      "path": "src/types/llm.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 821,
      "lastModified": 1750458274979.0027,
      "tags": [
        "types"
      ]
    },
    {
      "path": "src/types/nostr.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 350,
      "lastModified": 1750458274979.0884,
      "tags": [
        "types"
      ]
    },
    {
      "path": "src/types/routing.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 522,
      "lastModified": 1750458274979.1824,
      "tags": [
        "types"
      ]
    },
    {
      "path": "src/types.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 584,
      "lastModified": 1750408593173.13,
      "tags": [
        "types"
      ]
    },
    {
      "path": "src/utils/RulesManager.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 4550,
      "lastModified": 1750408593175.3835,
      "tags": [
        "utility"
      ]
    },
    {
      "path": "src/utils/agents.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 325,
      "lastModified": 1750458274979.31,
      "tags": [
        "utility"
      ]
    },
    {
      "path": "src/utils/claude/ClaudeParser.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 2354,
      "lastModified": 1750492785936.771,
      "tags": [
        "utility"
      ]
    },
    {
      "path": "src/utils/errors.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 199,
      "lastModified": 1750458274980.0562,
      "tags": [
        "utility"
      ]
    },
    {
      "path": "src/utils/json.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 1422,
      "lastModified": 1750408593163.0984,
      "tags": [
        "utility"
      ]
    },
    {
      "path": "src/utils/project.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 5426,
      "lastModified": 1750514124347.5369,
      "tags": [
        "utility"
      ]
    },
    {
      "path": "src/utils/setup.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 2973,
      "lastModified": 1750458274980.9822,
      "tags": [
        "utility"
      ]
    },
    {
      "path": "test-agent-execution.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 8976,
      "lastModified": 1750464267036.1672,
      "tags": [
        "test"
      ]
    },
    {
      "path": "test-conversation-system.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 8148,
      "lastModified": 1750458274983.1296,
      "tags": [
        "test"
      ]
    },
    {
      "path": "test-debug-chat.sh",
      "type": ".sh",
      "description": ".sh file",
      "size": 141,
      "lastModified": 1750458569385.9138,
      "tags": [
        "test"
      ]
    },
    {
      "path": "test-debug-system.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 1089,
      "lastModified": 1750464072926.5698,
      "tags": [
        "test"
      ]
    },
    {
      "path": "test-event-handler-integration.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 5459,
      "lastModified": 1750458274982.405,
      "tags": [
        "test"
      ]
    },
    {
      "path": "test-global-agents.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 3782,
      "lastModified": 1750514124346.6086,
      "tags": [
        "test"
      ]
    },
    {
      "path": "test-integration.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 9441,
      "lastModified": 1750464267031.166,
      "tags": [
        "test"
      ]
    },
    {
      "path": "test-multi-llm.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 2744,
      "lastModified": 1750458274977.421,
      "tags": [
        "test"
      ]
    },
    {
      "path": "test-phase-initializers.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 7370,
      "lastModified": 1750514124337.1282,
      "tags": [
        "test"
      ]
    },
    {
      "path": "test-routing-enhancement.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 2817,
      "lastModified": 1750537197396.2131,
      "tags": [
        "test"
      ]
    },
    {
      "path": "test-time-tool.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 3666,
      "lastModified": 1750463915484.8242,
      "tags": [
        "test"
      ]
    },
    {
      "path": "test-tools-and-persistence.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 8030,
      "lastModified": 1750464244189.5723,
      "tags": [
        "test"
      ]
    },
    {
      "path": "tests/e2e/conversation-flow.test.ts",
      "type": ".ts",
      "description": ".ts file",
      "size": 13617,
      "lastModified": 1750465377126.3179,
      "tags": [
        "test"
      ]
    },
    {
      "path": "tsconfig.json",
      "type": ".json",
      "description": ".json file",
      "size": 620,
      "lastModified": 1750408593157.0754,
      "tags": [
        "configuration"
      ]
    }
  ],
  "directories": [
    {
      "path": "bin",
      "description": "Directory containing 1 files",
      "fileCount": 1,
      "subdirectories": []
    },
    {
      "path": "docs",
      "description": "Directory containing 1 files",
      "fileCount": 1,
      "subdirectories": []
    },
    {
      "path": "scripts",
      "description": "Directory containing 1 files",
      "fileCount": 1,
      "subdirectories": []
    },
    {
      "path": "src/agents/__tests__",
      "description": "Directory containing 1 files",
      "fileCount": 1,
      "subdirectories": []
    },
    {
      "path": "src/agents/execution/__tests__",
      "description": "Directory containing 2 files",
      "fileCount": 2,
      "subdirectories": []
    },
    {
      "path": "src/agents/execution",
      "description": "Directory containing 4 files",
      "fileCount": 4,
      "subdirectories": [
        "__tests__"
      ]
    },
    {
      "path": "src/agents",
      "description": "Directory containing 3 files",
      "fileCount": 3,
      "subdirectories": [
        "__tests__",
        "execution"
      ]
    },
    {
      "path": "src/commands/debug",
      "description": "Directory containing 2 files",
      "fileCount": 2,
      "subdirectories": []
    },
    {
      "path": "src/commands/inventory",
      "description": "Directory containing 1 files",
      "fileCount": 1,
      "subdirectories": []
    },
    {
      "path": "src/commands/project",
      "description": "Directory containing 3 files",
      "fileCount": 3,
      "subdirectories": []
    },
    {
      "path": "src/commands/run",
      "description": "Directory containing 7 files",
      "fileCount": 7,
      "subdirectories": []
    },
    {
      "path": "src/commands/setup",
      "description": "Directory containing 2 files",
      "fileCount": 2,
      "subdirectories": []
    },
    {
      "path": "src/commands/test",
      "description": "Directory containing 5 files",
      "fileCount": 5,
      "subdirectories": []
    },
    {
      "path": "src/commands",
      "description": "Directory containing 1 files",
      "fileCount": 1,
      "subdirectories": [
        "debug",
        "inventory",
        "project",
        "run",
        "setup",
        "test"
      ]
    },
    {
      "path": "src/conversations/__tests__",
      "description": "Directory containing 2 files",
      "fileCount": 2,
      "subdirectories": []
    },
    {
      "path": "src/conversations/persistence",
      "description": "Directory containing 3 files",
      "fileCount": 3,
      "subdirectories": []
    },
    {
      "path": "src/conversations",
      "description": "Directory containing 3 files",
      "fileCount": 3,
      "subdirectories": [
        "__tests__",
        "persistence"
      ]
    },
    {
      "path": "src/core/llm",
      "description": "Directory containing 4 files",
      "fileCount": 4,
      "subdirectories": []
    },
    {
      "path": "src/core/types",
      "description": "Directory containing 1 files",
      "fileCount": 1,
      "subdirectories": []
    },
    {
      "path": "src/core",
      "description": "Directory containing 1 files",
      "fileCount": 1,
      "subdirectories": [
        "llm",
        "types"
      ]
    },
    {
      "path": "src/daemon",
      "description": "Directory containing 3 files",
      "fileCount": 3,
      "subdirectories": []
    },
    {
      "path": "src/debug",
      "description": "Directory containing 4 files",
      "fileCount": 4,
      "subdirectories": []
    },
    {
      "path": "src/llm/__tests__",
      "description": "Directory containing 2 files",
      "fileCount": 2,
      "subdirectories": []
    },
    {
      "path": "src/llm/providers",
      "description": "Directory containing 1 files",
      "fileCount": 1,
      "subdirectories": []
    },
    {
      "path": "src/llm",
      "description": "Directory containing 4 files",
      "fileCount": 4,
      "subdirectories": [
        "__tests__",
        "configuration",
        "providers",
        "types"
      ]
    },
    {
      "path": "src/nostr",
      "description": "Directory containing 3 files",
      "fileCount": 3,
      "subdirectories": []
    },
    {
      "path": "src/phases/__tests__",
      "description": "Directory containing 1 files",
      "fileCount": 1,
      "subdirectories": []
    },
    {
      "path": "src/phases",
      "description": "Directory containing 9 files",
      "fileCount": 9,
      "subdirectories": [
        "__tests__"
      ]
    },
    {
      "path": "src/prompts/__tests__",
      "description": "Directory containing 4 files",
      "fileCount": 4,
      "subdirectories": []
    },
    {
      "path": "src/prompts/core",
      "description": "Directory containing 5 files",
      "fileCount": 5,
      "subdirectories": []
    },
    {
      "path": "src/prompts/fragments",
      "description": "Directory containing 10 files",
      "fileCount": 10,
      "subdirectories": []
    },
    {
      "path": "src/prompts",
      "description": "Directory containing 3 files",
      "fileCount": 3,
      "subdirectories": [
        "__tests__",
        "core",
        "fragments"
      ]
    },
    {
      "path": "src/routing/__tests__",
      "description": "Directory containing 1 files",
      "fileCount": 1,
      "subdirectories": []
    },
    {
      "path": "src/routing",
      "description": "Directory containing 6 files",
      "fileCount": 6,
      "subdirectories": [
        "__tests__"
      ]
    },
    {
      "path": "src/runtime",
      "description": "Directory containing 2 files",
      "fileCount": 2,
      "subdirectories": []
    },
    {
      "path": "src/services/__tests__",
      "description": "Directory containing 2 files",
      "fileCount": 2,
      "subdirectories": []
    },
    {
      "path": "src/services",
      "description": "Directory containing 1 files",
      "fileCount": 1,
      "subdirectories": [
        "__tests__"
      ]
    },
    {
      "path": "src/tasks/__tests__",
      "description": "Directory containing 1 files",
      "fileCount": 1,
      "subdirectories": []
    },
    {
      "path": "src/tasks",
      "description": "Directory containing 1 files",
      "fileCount": 1,
      "subdirectories": [
        "__tests__"
      ]
    },
    {
      "path": "src/test-utils/helpers",
      "description": "Directory containing 4 files",
      "fileCount": 4,
      "subdirectories": []
    },
    {
      "path": "src/test-utils/mocks",
      "description": "Directory containing 6 files",
      "fileCount": 6,
      "subdirectories": []
    },
    {
      "path": "src/test-utils",
      "description": "Directory containing 0 files",
      "fileCount": 0,
      "subdirectories": [
        "helpers",
        "mocks"
      ]
    },
    {
      "path": "src/tools/execution/__tests__",
      "description": "Directory containing 2 files",
      "fileCount": 2,
      "subdirectories": []
    },
    {
      "path": "src/tools/execution/executors",
      "description": "Directory containing 3 files",
      "fileCount": 3,
      "subdirectories": []
    },
    {
      "path": "src/tools/execution",
      "description": "Directory containing 4 files",
      "fileCount": 4,
      "subdirectories": [
        "__tests__",
        "executors"
      ]
    },
    {
      "path": "src/tools",
      "description": "Directory containing 2 files",
      "fileCount": 2,
      "subdirectories": [
        "execution"
      ]
    },
    {
      "path": "src/tracing",
      "description": "Directory containing 3 files",
      "fileCount": 3,
      "subdirectories": []
    },
    {
      "path": "src/types",
      "description": "Directory containing 6 files",
      "fileCount": 6,
      "subdirectories": []
    },
    {
      "path": "src/utils/claude",
      "description": "Directory containing 1 files",
      "fileCount": 1,
      "subdirectories": []
    },
    {
      "path": "src/utils",
      "description": "Directory containing 6 files",
      "fileCount": 6,
      "subdirectories": [
        "claude"
      ]
    },
    {
      "path": "src",
      "description": "Directory containing 3 files",
      "fileCount": 3,
      "subdirectories": [
        "agents",
        "commands",
        "conversations",
        "core",
        "daemon",
        "debug",
        "llm",
        "nostr",
        "phases",
        "prompts",
        "routing",
        "runtime",
        "services",
        "tasks",
        "test-utils",
        "tools",
        "tracing",
        "types",
        "utils"
      ]
    },
    {
      "path": "tests/e2e",
      "description": "Directory containing 1 files",
      "fileCount": 1,
      "subdirectories": []
    },
    {
      "path": "tests",
      "description": "Directory containing 0 files",
      "fileCount": 0,
      "subdirectories": [
        "e2e"
      ]
    }
  ],
  "stats": {
    "totalFiles": 191,
    "totalDirectories": 53,
    "totalSize": 1673157,
    "fileTypes": {
      "no-extension": 1,
      ".txt": 1,
      ".json": 5,
      ".md": 15,
      ".ts": 164,
      ".toml": 1,
      ".sh": 4
    }
  }
}
-->