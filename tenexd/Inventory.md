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
│   └── config.ts           # Configuration management including projects_path, taskCommand, and chatCommand settings
├── projects/
│   └── handler.ts          # Task event handler that fetches referenced task events, initializes projects, and executes taskCommand
├── nostr/
│   └── chatHandler.ts      # Chat event handler for kind:11 and kind:1111 that fetches root events, checks project a-tags, and executes chatCommand
└── utils/                  # (empty directory for future utility functions)
```
