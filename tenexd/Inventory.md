Maintain an accurate inventory of all code files within the `src/` directory, providing a concise one-line summary clearly stating each file's responsibility and scope. Immediately update this inventory whenever you create, significantly modify, or delete files.

**Inventory Guidelines for LLMs:**

- **Clearly state the file's purpose:** Each entry should explicitly describe what the file does, its main responsibility, and scope.
- **Avoid vagueness:** Entries must precisely communicate responsibilities and usage context to enable quick understanding by other LLMs without additional context.

### Inventory Format:

```
src/
├── path/to/file.ext  # concise, explicit one-liner summarizing file responsibility and scope
```

### Current Inventory (Update Immediately):

```
src/
├── config/
│   └── config.ts           # Configuration management including projects_path, taskCommand, chatCommand, aiConfigPath, and tenexCommand settings
├── projects/
│   └── eventHandler.ts     # Universal project event handler that starts "tenex run" processes for any event with project a-tag, also handles NDKAgent events (kind 4199)
├── nostr/
│   └── chatHandler.ts      # Chat event handler for kind:11 and kind:1111 that fetches root events, checks project a-tags, and executes chatCommand with optional AI integration
├── ai/
│   ├── types.ts            # TypeScript types and Zod schemas for AI provider configurations supporting OpenAI and OpenRouter
│   ├── service.ts          # AI service implementation wrapping OpenAI SDK with support for multiple providers and custom base URLs
│   ├── configManager.ts    # AI configuration manager for storing, loading, and managing multiple named AI model configurations
│   ├── setup.ts            # Interactive setup flow for configuring AI providers with API key prompts and connection testing
│   └── index.ts            # Module exports for AI functionality
└── utils/
    ├── projectScanner.ts   # Scans projects directory to collect project metadata and agent counts for status reporting
    └── processManager.ts   # Manages running "tenex run" processes per project, initializes llms.json from AI configs, and tracks process lifecycle
```
