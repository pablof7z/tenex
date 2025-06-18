# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## CRITICAL: Living Documentation

**YOU MUST ALWAYS**:
1. Read @SPEC.md at the start of every conversation to understand the current system
2. Update @SPEC.md whenever:
   - Requirements change
   - New features are added
   - Architecture evolves
   - You discover how something actually works
3. When updating @SPEC.md:
   - Maintain it as a current state document, NOT a changelog
   - Replace outdated information with current reality
   - Remove historical changes unless they're essential context
   - Focus on "what is" and "where we're going", not "what was"
4. Refer to @SPEC.md as the source of truth for what TENEX is and how it works

You must ALWAYS read @INVENTORY.md and follow it's instructions.

**IMPORTANT**: When working through the TENEX CLI as an AI agent:
- Use the `read_specs` tool at the start of conversations to access SPEC.md and other project documentation
- Use the `update_spec` tool to update SPEC.md when changes occur (only available to the default agent)
- Use the `remember_lesson` tool when you realize a mistake or wrong assumption
- These tools provide access to the living documentation stored as Nostr events

**NEW AGENT CAPABILITIES**:
1. **Living Documentation**: All specs are now Nostr events (kind 30023)
2. **Agent Learning**: Record lessons with `remember_lesson` tool
3. **Rich Text**: Messages can contain Nostr entity references
4. **Typing Indicators**: Your prompts are visible during processing
5. **Cost Tracking**: Token usage and costs are tracked in events

## Project Overview

TENEX is a context-first development environment that orchestrates multiple AI agents to build software collaboratively. It consists of:
- **Web Client** (`web-client/`): Vite React app with living documentation viewer
- **CLI Tool** (`tenex/`): Unified CLI with daemon mode and agent orchestration
- **MCP Server** (`mcp/`): Model Context Protocol server with git integration
- **Shared Libraries** (`shared/`): Common types and utilities
- **CLI Client** (`cli-client/`): Interactive command-line interface

The system features living documentation, agent learning, rich communication, and sophisticated multi-agent orchestration through the Nostr protocol.

**For the complete system architecture, see `/SPEC.md` and `/SYSTEM_MAP.md`**

## Common Development Commands

### Web Client Development
```bash
cd web-client
bun install               # Install dependencies
bun run dev              # Start Vite dev server
bun run build            # Build for production
bun run lint             # Run ESLint
```

### CLI Tool
```bash
cd cli
bun install              # Install dependencies
bun run start            # Run the TENEX CLI
# Or use directly:
./bin/tenex.ts [command]
```

### MCP Server
```bash
cd mcp
bun install              # Install dependencies
bun run build            # Build executable (tenex-mcp)
bun run lint             # Run Biome linting
bun run format           # Format code with Biome
bun run check            # Run all Biome checks
```

### Shared Libraries
```bash
cd shared
bun install              # Install dependencies
bun run build            # Build TypeScript
bun run dev              # Build in watch mode
```

### Code Quality (Root Level)
```bash
biome check .            # Run Biome linting and formatting checks
biome format . --write   # Auto-format code with Biome
```

## Architecture Overview

### Web Client Structure
- **Framework**: Vite + React + TypeScript (not Next.js)
- **State Management**: Jotai for atomic state management
- **UI Components**: shadcn/ui components in `components/ui/`
- **Styling**: Tailwind CSS v4 with PostCSS
- **Nostr Integration**: NDK via `@nostr-dev-kit/ndk-hooks`

### Component Organization
- **Pages**: `AgentsPage.tsx`, `ChatsPage.tsx`, `SettingsPage.tsx`, `DocsPage.tsx`
- **Common Components**: `components/common/` (EmptyState, ErrorState, MessageWithEntities, NostrEntityCard)
- **Settings Components**: `components/settings/` (AgentsSettings, MetadataSettings, RulesSettings)
- **UI Components**: `components/ui/` (shadcn/ui library with hover-card)
- **Selectors**: AgentSelector, InstructionSelector, TemplateSelector
- **Hooks**: `useAgentLessons`, `useProjectAgents`, `useProjectStatus`

### CLI Commands
- `tenex daemon` - Start the event monitoring daemon for whitelisted pubkeys
- `tenex project init <path> <naddr>` - Initialize a new project from Nostr event
- `tenex project run` - Start multi-agent orchestration system for a project

### CLI Agent Tools
- `read_specs` - Access living documentation from Nostr
- `update_spec` - Update project specifications (default agent only)
- `remember_lesson` - Record learnings from mistakes
- Claude Code tools - File operations, bash commands, etc.

### MCP Server Features
- **Multi-Agent Support**: Manages agent identities and configurations
- **Git Integration**: Advanced operations with context preservation
- **Status Updates**: Real-time progress with confidence levels
- **Agent Loader**: Fetches configurations from NDKAgent events
- **Tools**: `publish_task_status_update`, `publish`, `git_reset_to_commit`, `git_commit_details`, `git_validate_commit`

## Important Development Patterns

### NDK/Nostr Usage (Web Client)
```tsx
// Use ndk-hooks, NOT ndk-react
import { useSubscribe, useNDKSessionLogin } from '@nostr-dev-kit/ndk-hooks';

// Fetching data
const { events: articles } = useSubscribe<NDKArticle>(
    follows.size > 0 ? [{ kinds: [NDKKind.Article], limit: 100 }] : false,
    { wrap: true },
    [follows.size]
);

// Publishing events (optimistic, don't await)
const event = new NDKEvent(ndk);
event.kind = 1;
event.content = "Hello world";
event.publish(); // Don't await
```

### Button Styling (Web Client)
Always use the Button component with proper variants:
- `variant="primary"` - Blue CTAs
- `variant="success"` - Green positive actions  
- `variant="destructive"` - Red dangerous actions
- `variant="ghost"` - Minimal hover-only buttons
- See `web-client/BUTTON_STYLE_GUIDE.md` for full guide

### Agent Management
Projects maintain agents in `.tenex/agents.json` with enhanced format:
```json
{
  "default": {
    "nsec": "nsec1...",
    "file": "abc123.json"  // Reference to NDKAgent event file
  },
  "code": {
    "nsec": "nsec1...",
    "file": "xyz789.json"
  },
  "planner": {
    "nsec": "nsec1...",
    "file": "def456.json"
  }
}
```

Agent features:
- **Individual Tool Registries**: Each agent has specialized tools
- **Conversation Persistence**: 30-day retention with optimization
- **Learning System**: Agents record lessons from mistakes
- **Cost Tracking**: Token usage tracked in event metadata
- **Typing Indicators**: Real-time status with prompt visibility

Agent definitions from NDKAgent events (kind 4199) are automatically fetched and cached in `.tenex/agents/` during initialization.

## Key Technologies

- **Runtime**: Bun (not Node.js) for all components
- **Web Framework**: Vite + React (not Next.js)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **State**: Jotai
- **Protocol**: Nostr via NDK with class-based wrappers (NDKAgent, etc.)
- **Formatter/Linter**: Biome
- **Voice**: OpenAI Whisper API
- **Testing**: Vitest for unit/integration, cli-client for e2e

## Development Best Practices

1. **File Paths**: All tools require absolute paths (not relative)
2. **Architecture**: Use dependency injection and testable patterns
3. **Nostr Events**: 
   - Projects: kind 31933 (NDKArticle with d, title, repo, agent tags)
   - Templates: kind 30717 (with d, title, uri, agent tags)
   - Tasks: kind 1934 (with title tag and structured metadata)
   - Specifications: kind 30023 (NDKArticle for living docs)
   - Agent Config: kind 4199 (NDKAgent with role, instructions)
   - Agent Lessons: kind 4124 (learnings with e-tag to agent)
   - Typing Indicators: kinds 24111/24112 (with prompt visibility)
   - Project Status: kind 24010 (online pings every 60s)
   - Chats: kinds 11/1111 (with rich text support)
3. **Testing**: Always test changes when possible (unit, integration, and e2e tests)
4. **Git Operations**: Never commit unless explicitly asked by the user
5. **Code Style**:
   - Use Biome for formatting (4 spaces, double quotes)
   - Follow existing patterns in the codebase
   - Never add comments unless explicitly asked
   - Prefer editing existing files over creating new ones
6. **Agent Best Practices**:
   - Use `read_specs` at conversation start
   - Update specs when requirements change
   - Record lessons when realizing mistakes
   - Collaborate via p-tags when needed

## Project Structure Notes

- **Living Documentation**: Specs stored as NDKArticle events (kind 30023)
- **Agent Tools**: Available via tool registry in CLI agent system
- **Conversation Storage**: `.tenex/conversations/` with 30-day retention
- **Rich Communication**: Support for Nostr entity references in messages
- **Token Optimization**: Automatic caching and context window management
- **Multi-Agent System**: Sophisticated orchestration with participant tracking
- **Cost Tracking**: LLM usage and costs tracked in event metadata

### Key Directories
- `.tenex/agents/`: Cached NDKAgent event definitions
- `.tenex/conversations/`: Persistent conversation history
- `web-client/src/utils/`: Entity parsing and utilities
- `tenex/src/utils/agents/tools/`: Agent tool implementations

When working on this codebase, always:
1. Use `read_specs` tool to access current documentation
2. Update living documentation when making changes

### Documentation Maintenance

**REMEMBER**: `/SPEC.md` is the living source of truth for this project. You must:
- Read it at the start of every session
- Update it to reflect the current state when changes occur
- Replace outdated sections rather than appending changes
- Remove historical information that no longer serves the current understanding
- Keep the "Last Updated" timestamp current
- Use version numbers to track major architectural shifts, not individual changes

This ensures future Claude Code instances have accurate, up-to-date information about TENEX.

## Development Guidance

- Whenever you finish something that you can easily test, always test it
- MCP server config updates require rebuilding: `cd mcp && bun run build`

NEVER say "You are right!!", "You are absolutely right!" or any variation of that -- it's EXTREMELY annoying.


Never import with `const ... = await import(....` -- use top-level imports only
