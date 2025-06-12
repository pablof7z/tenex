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

## Project Overview

TENEX is a context-first development environment that orchestrates AI assistants to manage software development. It consists of:
- **Web Client** (`web-client/`): Vite-based React app with TypeScript and Tailwind CSS
- **CLI Tool** (`cli/`): Command-line interface for project and agent management  
- **MCP Server** (`mcp/`): Model Context Protocol server for AI agent integration
- **Shared Libraries** (`shared/`): Common code between components
- **tenexd** (`tenexd/`): Daemon service for Nostr protocol operations

The system is built on the Nostr protocol for decentralized collaboration.

**For detailed architecture and how components work together, see `/SPEC.md`**

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
- **Pages**: `AgentsPage.tsx`, `ChatsPage.tsx`, `SettingsPage.tsx`
- **Common Components**: `components/common/` (EmptyState, ErrorState, etc.)
- **Settings Components**: `components/settings/` (AgentsSettings, MetadataSettings, etc.)
- **UI Components**: `components/ui/` (shadcn/ui library)
- **Selectors**: AgentSelector, InstructionSelector, TemplateSelector

### CLI Commands
- `tenex init` - Initialize CLI with profile configuration
- `tenex project init <path> <naddr>` - Initialize a new project from Nostr event
- `tenex run` - Start project listener (no arguments needed)
- `tenex agent publish` - Publish an agent to Nostr
- `tenex rules` - Manage project rules

### MCP Server Features
- **Multi-Agent Support**: Manages multiple AI agent identities per project
- **Git Integration**: Automatic commits with task context
- **Status Updates**: Publishes real-time updates to Nostr
- **Tools**: `publish_task_status_update`, `publish`, git operations

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
Projects maintain agents in `.tenex/agents.json`:
```json
{
  "default": "nsec1...",
  "claude-code": "nsec1...",
  "planner": "nsec1..."
}
```

Agent definitions from NDKAgent events (kind 4199) are automatically fetched and stored in `.tenex/agents/` during project initialization:
```
.tenex/agents/
├── {agent-event-id-1}.json
├── {agent-event-id-2}.json
└── {agent-event-id-3}.json
```

## Key Technologies

- **Runtime**: Bun (not Node.js) for all components
- **Web Framework**: Vite + React (not Next.js)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **State**: Jotai (web), Zustand (legacy)
- **Protocol**: Nostr via NDK
- **Formatter/Linter**: Biome
- **Voice**: OpenAI Whisper API

## Development Best Practices

1. **File Paths**: All tools require absolute paths (not relative)
2. **Nostr Events**: 
   - Projects: kind 31933 (with tags: d, title, repo, hashtags)
   - Templates: kind 30717 (with tags: d, title, uri, agent)
   - Tasks: kind 1934
3. **Testing**: Always test changes when possible
4. **Git Operations**: Never commit unless explicitly asked by the user
5. **Code Style**:
   - Use Biome for formatting (4 spaces, double quotes)
   - Follow existing patterns in the codebase
   - Never add comments unless explicitly asked
   - Prefer editing existing files over creating new ones

## Project Structure Notes

- Voice transcription features use OpenAI Whisper API
- MCP server enables AI agents to publish Nostr events and perform git operations
- When using `tenex run --claude`, the MCP server is configured with `--config-file` pointing to `agents.json`
- Task execution uses backend-specific commands:
  - `--roo`: VS Code integration with roo-executor
  - `--claude`: Claude CLI with MCP server
  - `--goose`: Not yet implemented

When working on this codebase, always check the `.tenex/rules/` directory for the latest context-specific guidelines and requirements.

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
