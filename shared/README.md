# TENEX Shared Libraries

Common code and utilities shared across all TENEX components.

## Overview

This package contains core functionality used by the web client, CLI tool, and MCP server:

- **Project Management**: `ProjectService` for creating and managing projects
- **File System Utilities**: Abstracted file operations with TENEX-specific helpers
- **Configuration**: Unified configuration loading and management
- **Business Utilities**: Common string manipulation, validation, and formatting
- **Type Definitions**: Shared TypeScript interfaces and types
- **Logging**: Structured logging with chalk formatting

## Installation

```bash
cd shared
bun install
```

## Usage

Import utilities in other packages:

```typescript
import { ProjectService } from '@tenex/shared';
import { TenexFileSystem } from '@tenex/shared/fs';
import { logger } from '@tenex/shared/logger';
import { StringUtils, ValidationUtils } from '@tenex/shared/utils/business';
```

## Key Modules

### Project Service

Creates and manages TENEX projects with proper structure:

```typescript
const projectService = new ProjectService(fileSystem);
await projectService.create({
  path: '/path/to/project',
  naddr: 'project-nostr-address',
  projectNsec: 'nsec1...'
});
```

### File System

Abstracted file operations for cross-platform compatibility:

```typescript
const fs = new FileSystem();
await fs.writeFile('/path/to/file', 'content');
const exists = await fs.exists('/path/to/file');
```

### Business Utilities

Common utilities for string manipulation and validation:

```typescript
// String utilities
const slug = StringUtils.slugify('My Project Name'); // 'my-project-name'
const truncated = StringUtils.truncate('Long text...', 50);

// Validation
const isValid = ValidationUtils.isValidNaddr(naddr);
const errors = ValidationRules.projectName('My Project');
```

### Logger

Structured logging with levels and formatting:

```typescript
logger.info('Starting process', { projectId: '123' });
logger.error('Failed to load', error);
logger.success('Project created successfully');
```

## Development

```bash
# Build TypeScript
bun run build

# Watch mode
bun run dev

# Run tests
bun test
```

## Architecture

The shared library follows these principles:

- **Zero Dependencies**: Minimal external dependencies
- **Type Safety**: Full TypeScript coverage
- **Testability**: Dependency injection patterns
- **Cross-Platform**: Works in browser and Node/Bun environments