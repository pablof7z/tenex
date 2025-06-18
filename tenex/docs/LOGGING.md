# TENEX Logging System

## Overview

TENEX uses a module-based logging system that allows fine-grained control over verbosity levels for different subsystems. This helps reduce log noise while maintaining visibility into critical operations.

## Verbosity Levels

- **`silent`** (0): No logs except errors and warnings
- **`normal`** (1): Standard logging - important operations and state changes
- **`verbose`** (2): Detailed logging - includes state transitions and coordination
- **`debug`** (3): Full debug logging - includes all details

## Log Modules

- **`agent`**: Agent message handling and response generation
- **`team`**: Team formation and multi-agent coordination
- **`conversation`**: Turn management and speaker selection
- **`llm`**: LLM requests, responses, and token usage
- **`nostr`**: Nostr event publishing and typing indicators
- **`orchestration`**: High-level orchestration and routing
- **`tools`**: Tool execution and parsing
- **`general`**: Default module for unspecified logs

## Configuration

### Environment Variables

Set the default log level:
```bash
LOG_LEVEL=normal  # Options: silent, normal, verbose, debug
```

Set module-specific verbosity:
```bash
# Format: LOG_MODULE_<MODULE>=<level>
LOG_MODULE_TEAM=debug
LOG_MODULE_LLM=silent
LOG_MODULE_CONVERSATION=verbose
```

### Example Configurations

**Quiet mode** - Only see essential information:
```bash
LOG_LEVEL=normal
LOG_MODULE_LLM=silent
LOG_MODULE_CONVERSATION=silent
LOG_MODULE_TEAM=silent
```

**Debug team coordination**:
```bash
LOG_LEVEL=normal
LOG_MODULE_TEAM=debug
LOG_MODULE_CONVERSATION=verbose
```

**Debug LLM interactions**:
```bash
LOG_LEVEL=normal
LOG_MODULE_LLM=debug
```

**Full debug mode**:
```bash
LOG_LEVEL=debug
```

## Usage in Code

### Basic Usage

```typescript
import { logger } from "@tenex/shared/logger";

// Standard logging
logger.info("Operation completed");
logger.error("Operation failed", error);
```

### Module-Specific Logging

```typescript
import { logger } from "@tenex/shared/logger";

// Create a scoped logger for a module
const teamLogger = logger.forModule("team");

// Log with default verbosity (normal)
teamLogger.info("Team formed");

// Log with specific verbosity
teamLogger.info("Detailed team info", "verbose");
teamLogger.debug("Debug information", "debug");
```

### Agent Logger

```typescript
import { createAgentLogger } from "@tenex/shared/logger";

const agentLogger = createAgentLogger("myAgent", "projectName");
agentLogger.setModule("agent");

// Logs will include agent name and respect module verbosity
agentLogger.info("Processing request");
agentLogger.info("Detailed processing info", "verbose");
```

## Best Practices

1. **Always specify modules** for subsystem-specific logging
2. **Use appropriate verbosity**:
   - `normal`: User-facing operations, important state changes
   - `verbose`: Internal state transitions, coordination details
   - `debug`: Full details, prompts, responses
3. **Errors and warnings** always show regardless of verbosity
4. **Performance**: Verbose/debug logs are skipped entirely when not enabled

## Common Scenarios

### Running TENEX with Minimal Output

```bash
LOG_LEVEL=normal LOG_MODULE_LLM=silent LOG_MODULE_TEAM=silent tenex project run
```

### Debugging Agent Communication

```bash
LOG_MODULE_AGENT=debug LOG_MODULE_CONVERSATION=verbose tenex project run
```

### Monitoring LLM Costs

```bash
LOG_MODULE_LLM=verbose tenex project run
```

### Full System Debug

```bash
DEBUG=true LOG_LEVEL=debug tenex project run
```