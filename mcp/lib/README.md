# MCP-NDK Library Structure

This directory contains reusable code organized into modules to reduce duplication and improve maintainability.

## Directory Structure

- `/lib` - Core libraries and utilities
  - `/types` - TypeScript type definitions used across the application
  - `/nostr` - Nostr-related functionality
    - `utils.ts` - Utility functions for working with Nostr
    - `snippets.ts` - Functions for managing code snippets
  - `/utils` - General utility functions
    - `log.ts` - Logging functionality

## Design Principles

1. **Single Responsibility**: Each module has a specific, focused purpose
2. **DRY (Don't Repeat Yourself)**: Common code is extracted into reusable functions
3. **Separation of Concerns**: Clear separation between types, utilities, and business logic
4. **Consistency**: Consistent patterns and naming conventions throughout the codebase

## How to Use

When adding new functionality, follow these guidelines:

1. Place type definitions in `/lib/types`
2. Place general utilities in `/lib/utils`
3. Organize Nostr-specific code under `/lib/nostr`
4. Aim to minimize duplication by leveraging existing utilities
5. Keep command files focused on their specific command, delegating to library code for implementation
