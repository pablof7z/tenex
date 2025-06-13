# File System Abstraction Migration Guide

This guide helps migrate existing file system operations to use the new abstraction layer.

## Why Use the File System Abstraction?

1. **Testability**: Easy to mock file operations in tests
2. **Consistency**: All file operations go through a single interface
3. **Path Handling**: Automatic `~` expansion and path normalization
4. **Error Handling**: Consistent error handling across all operations
5. **High-level Utilities**: Built-in JSON operations, directory creation, etc.

## Migration Examples

### Basic File Operations

**Before:**
```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';

// Read file
const content = fs.readFileSync(path.join(process.cwd(), 'config.json'), 'utf8');

// Write file
fs.mkdirSync(path.dirname(filePath), { recursive: true });
fs.writeFileSync(filePath, data);

// Check existence
if (fs.existsSync(filePath)) {
  // ...
}
```

**After:**
```typescript
import { fs } from './utils/fs';

// Read file
const content = await fs.readFile('./config.json', 'utf8');

// Write file (directory creation is automatic)
await fs.writeFile(filePath, data);

// Check existence
if (await fs.exists(filePath)) {
  // ...
}
```

### JSON Operations

**Before:**
```typescript
import * as fs from 'node:fs';

// Read JSON
const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Write JSON
fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
```

**After:**
```typescript
import { fs } from './utils/fs';

// Read JSON
const data = await fs.readJSON(configPath);

// Write JSON
await fs.writeJSON(configPath, data);
```

### Path Expansion

**Before:**
```typescript
import * as os from 'node:os';
import * as path from 'node:path';

function expandHome(filePath: string): string {
  if (filePath.startsWith('~')) {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return filePath;
}

const configPath = expandHome('~/.tenex/config.json');
```

**After:**
```typescript
import { fs } from './utils/fs';

// Automatic ~ expansion
const config = await fs.readJSON('~/.tenex/config.json');
```

### Directory Operations

**Before:**
```typescript
import * as fs from 'node:fs';

// Ensure directory exists
if (!fs.existsSync(dirPath)) {
  fs.mkdirSync(dirPath, { recursive: true });
}

// List files
const files = fs.readdirSync(dirPath)
  .filter(file => fs.statSync(path.join(dirPath, file)).isFile());
```

**After:**
```typescript
import { fs } from './utils/fs';

// Ensure directory exists
await fs.ensureDir(dirPath);

// List files
const files = await fs.listFiles(dirPath);
```

## Testing with Mock File System

```typescript
import { MockFileSystem } from './utils/fs';

describe('Config Manager', () => {
  let mockFs: MockFileSystem;

  beforeEach(() => {
    mockFs = new MockFileSystem({
      '/home/user/.tenex/config.json': JSON.stringify({
        version: '1.0.0',
        projects: []
      })
    });
  });

  it('should read config', async () => {
    const config = await mockFs.readJSON('/home/user/.tenex/config.json');
    expect(config.version).toBe('1.0.0');
  });

  it('should write new project', async () => {
    const config = await mockFs.readJSON('/home/user/.tenex/config.json');
    config.projects.push({ name: 'test' });
    await mockFs.writeJSON('/home/user/.tenex/config.json', config);

    const updated = await mockFs.readJSON('/home/user/.tenex/config.json');
    expect(updated.projects).toHaveLength(1);
  });
});
```

## Common Patterns

### 1. Safe File Writing
```typescript
// Atomic write with backup
async function safeWriteFile(filePath: string, content: string) {
  const backupPath = `${filePath}.backup`;
  
  // Create backup if file exists
  if (await fs.exists(filePath)) {
    await fs.copyFile(filePath, backupPath);
  }
  
  try {
    await fs.writeFile(filePath, content);
  } catch (error) {
    // Restore backup on error
    if (await fs.exists(backupPath)) {
      await fs.copyFile(backupPath, filePath);
    }
    throw error;
  }
  
  // Remove backup on success
  if (await fs.exists(backupPath)) {
    await fs.unlink(backupPath);
  }
}
```

### 2. Config File Management
```typescript
class ConfigManager {
  constructor(private fs = fs) {}

  async loadConfig<T>(configPath: string, defaults: T): Promise<T> {
    if (!await this.fs.exists(configPath)) {
      await this.fs.writeJSON(configPath, defaults);
      return defaults;
    }
    
    try {
      return await this.fs.readJSON<T>(configPath);
    } catch (error) {
      console.error('Invalid config, using defaults');
      return defaults;
    }
  }
}
```

### 3. Project Structure Creation
```typescript
async function createProjectStructure(projectPath: string) {
  const dirs = [
    '.tenex',
    '.tenex/agents',
    '.tenex/rules',
    'src'
  ];
  
  for (const dir of dirs) {
    await fs.ensureDir(fs.join(projectPath, dir));
  }
  
  // Create default files
  await fs.writeJSON(fs.join(projectPath, '.tenex/config.json'), {
    version: '1.0.0',
    created: new Date().toISOString()
  });
}
```

## Migration Checklist

1. [ ] Replace all `import * as fs from 'node:fs'` with `import { fs } from './utils/fs'`
2. [ ] Update synchronous operations to async where possible
3. [ ] Remove manual `mkdirSync` calls before writes (handled automatically)
4. [ ] Replace manual JSON parsing/stringifying with `readJSON`/`writeJSON`
5. [ ] Remove custom path expansion logic
6. [ ] Update tests to use `MockFileSystem`
7. [ ] Add proper error handling for async operations

## Gradual Migration

You don't need to migrate everything at once. The abstraction works alongside existing code:

```typescript
import * as nodeFs from 'node:fs';
import { fs } from './utils/fs';

// Can use both during migration
const oldWay = nodeFs.readFileSync('file.txt', 'utf8');
const newWay = await fs.readFile('file.txt', 'utf8');
```

Focus on migrating:
1. New code first
2. Code with lots of file operations
3. Code that needs testing
4. Code with complex path handling