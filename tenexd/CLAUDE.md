# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the `tenexd` component of the TENEX system - a daemon/service that handles Nostr protocol operations and real-time event processing for the TENEX context-first development environment.

**For complete system architecture and how all TENEX components work together, see `/SPEC.md` in the parent directory**

## Common Development Commands

### Development
```bash
bun install        # Install dependencies
bun run index.ts   # Run the tenexd service
```

### Testing
```bash
# Check package.json for test scripts once implemented
```

## Architecture Overview

### Purpose
The tenexd service acts as a dedicated Nostr protocol handler that:
- Maintains persistent connections to Nostr relays
- Handles event subscriptions and publishing
- Manages cryptographic operations (key generation, signing)
- Provides real-time event streaming capabilities

### Key Technologies
- **Runtime**: Bun (not Node.js)
- **Language**: TypeScript with strict mode
- **Protocol**: Nostr via NDK (@nostr-dev-kit/ndk)
- **CLI Output**: Chalk for colored terminal output
- **QR Codes**: qrcode library for displaying connection info

### Project Structure
```
tenexd/
├── index.ts           # Entry point (currently placeholder)
├── src/
│   ├── config/       # Configuration management
│   │   └── config.ts
│   ├── nostr/        # Nostr protocol implementations
│   └── utils/        # Utility functions
└── tests/            # Test files
```

## Nostr Development Guidelines

### NDK (Nostr Development Kit) Best Practices

1. **Singleton Pattern**: Always use NDK as a singleton instance
2. **Explicit Relays**: Initialize with explicit relay URLs for reliability
   ```typescript
   const ndk = new NDK({ 
     explicitRelayUrls: ["wss://relay.damus.io", "wss://relay.primal.net"] 
   });
   ```

3. **Event Publishing**: Use optimistic updates (don't await publish)
   ```typescript
   const event = new NDKEvent(ndk);
   event.kind = 1;
   event.content = "Hello world";
   event.publish(); // Don't await
   ```

4. **Key Generation**: Use NDKPrivateKeySigner for new keys
   ```typescript
   const signer = NDKPrivateKeySigner.generate();
   const { npub, nsec, pubkey } = signer;
   ```

### Nostr Protocol Rules

1. **Encoding**:
   - Use hex encoding internally for all IDs and pubkeys
   - Only use bech32 (npub/nsec/note) for user-facing display
   - NEVER use bech32 in filters or protocol messages

2. **Event Structure**:
   - Regular events: Store all
   - Replaceable events (0, 3, 10000-19999): Keep only latest per (pubkey, kind)
   - Addressable events (30000-39999): Require 'd' tag, keep latest per (pubkey, kind, d-tag)
   - Ephemeral events (20000-29999): Transmit but don't store

3. **Tag System**:
   - Single-letter tags are indexed by relays
   - Use 'e' tag for event references, 'p' tag for pubkey references
   - Use 'a' tag for addressable event references

## Development Patterns

### File Conventions
- Follow existing code patterns in the codebase
- Use TypeScript strict mode features
- Prefer editing existing files over creating new ones
- No comments unless explicitly requested

### Error Handling
- Handle relay connection failures gracefully
- Validate event signatures before processing
- Check timestamp reasonability

### State Management
- Maintain connection state with relays
- Cache user profiles and events appropriately
- Handle optimistic updates for better UX

## Important Context Rules

From `.tenex/rules/`:

1. **Inventory Management**: Update Inventory.md when creating/modifying files in src/
2. **NDK Usage**: Follow NDK best practices from NDK.md
3. **Nostr Guidelines**: Adhere to protocol specifications in NOSTR.md
4. **Simplicity**: Don't over-engineer - accomplish the asked task without going beyond

## Integration with TENEX System

This daemon integrates with:
- **Main App**: Provides real-time Nostr event streams
- **CLI**: May be invoked by CLI for background operations
- **MCP Server**: Shares Nostr publishing capabilities

For detailed integration patterns and data flow, refer to the parent `/SPEC.md`

## Future Considerations

When extending tenexd:
1. Maintain the daemon's focus on Nostr protocol operations
2. Keep it lightweight and efficient for long-running processes
3. Ensure proper cleanup of subscriptions and connections
4. Follow the established patterns for event handling

Read @NDK_Best_Practices.md and @Inventory.md
