# TENEX Refactoring Report

## Executive Summary

This report provides a comprehensive analysis of the TENEX codebase, identifying refactoring opportunities, architectural improvements, and performance optimizations. The analysis focuses on project structure, code patterns, performance bottlenecks, and operational concerns that can improve the system's maintainability and efficiency.

## Table of Contents

1. [Project Structure & Organization](#project-structure--organization)
2. [Code Quality & Architecture](#code-quality--architecture)
3. [Performance Optimization](#performance-optimization)
4. [Operational Improvements](#operational-improvements)
5. [Testing & Documentation](#testing--documentation)
6. [Prioritized Action Plan](#prioritized-action-plan)

## Project Structure & Organization

### Current Issues

1. **No Workspace Configuration**
   - Multiple packages without unified workspace management
   - Each package manages dependencies independently
   - Mixed package managers (bun.lock + package-lock.json)

2. **Inconsistent Package Naming**
   - Web client named `my-nostr-app` instead of `@tenex/web-client`
   - No consistent namespace/scope for internal packages

3. **Duplicate Code & Unclear Boundaries**
   - Both `cli/` and `cli-client/` directories exist
   - Shared dependencies installed multiple times
   - No clear module boundaries documentation

### Recommendations

#### 1. Implement Bun Workspace
```json
// Root package.json
{
  "name": "tenex",
  "private": true,
  "workspaces": [
    "packages/*",
    "cli",
    "web-client",
    "mcp",
    "shared",
    "tenexd"
  ],
  "scripts": {
    "build": "bun workspaces run build",
    "dev": "bun workspaces run dev",
    "lint": "biome check .",
    "format": "biome format . --write",
    "test": "bun workspaces run test"
  }
}
```

#### 2. Standardize Package Structure
- Rename all packages to use `@tenex/` scope
- Merge or clarify `cli` vs `cli-client`
- Create clear package boundaries with documented responsibilities

#### 3. Centralize Configuration
- Use `tsconfig.base.json` as parent for all TypeScript configs
- Single root `biome.json` for formatting
- Unified dependency versions in root workspace

## Code Quality & Architecture

### Strengths
- Well-structured multi-agent system
- Clean state management with Jotai
- Good TypeScript coverage
- Extensible tool system

### Areas for Improvement

#### 1. Error Handling
**Current Issues:**
- No error boundaries in React components
- Silent failures in async operations
- Missing error recovery strategies
- Generic try-catch blocks without proper error types

**Recommendations:**
```typescript
// Create custom error types
export class TenexError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'TenexError';
  }
}

// Add error boundaries
export class ErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('React error boundary', { error, errorInfo });
  }
}

// Implement result types
type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E };
```

#### 2. Type Safety
**Current Issues:**
- No runtime validation
- Types only exist at compile time
- Some `any` types in event handlers

**Recommendations:**
```typescript
// Add runtime validation with zod
import { z } from 'zod';

export const ProjectEventSchema = z.object({
  kind: z.literal(31933),
  pubkey: z.string(),
  content: z.string(),
  tags: z.array(z.array(z.string())),
  created_at: z.number()
});

// Use type guards
export function isProjectEvent(event: unknown): event is ProjectEvent {
  return ProjectEventSchema.safeParse(event).success;
}
```

#### 3. Component Performance
**Current Issues:**
- Missing memoization for expensive renders
- No virtualization for long lists
- Unnecessary re-renders

**Recommendations:**
```typescript
// Add memoization
export const AgentList = memo(({ agents }: Props) => {
  const sortedAgents = useMemo(
    () => agents.sort((a, b) => a.name.localeCompare(b.name)),
    [agents]
  );
  
  return <VirtualList items={sortedAgents} />;
});

// Implement virtualization for lists
import { VirtualList } from '@tanstack/react-virtual';
```

#### 4. State Management
**Current Issues:**
- State atoms scattered across files
- No persistence layer
- Missing state validation

**Recommendations:**
```typescript
// Centralize atoms
// src/state/atoms/index.ts
export * from './project.atoms';
export * from './agent.atoms';
export * from './settings.atoms';

// Add persistence
import { atomWithStorage } from 'jotai/utils';

export const settingsAtom = atomWithStorage('settings', defaultSettings);

// Add validation
export const validatedAtom = atom(
  (get) => get(baseAtom),
  (get, set, update) => {
    const validated = schema.parse(update);
    set(baseAtom, validated);
  }
);
```

## Testing & Documentation

### Current State
- Minimal test coverage across all packages
- No established testing patterns or utilities
- Documentation exists but could be more comprehensive
- Missing API documentation and examples

### Recommendations

#### 1. Establish Testing Infrastructure
```typescript
// Create test utilities package
// packages/test-utils/src/index.ts
export * from './nostr-mocks';
export * from './agent-mocks';
export * from './test-fixtures';

// Example test utilities
export function createMockNDK() {
  return {
    connect: vi.fn(),
    publish: vi.fn(),
    subscribe: vi.fn()
  };
}

export function createMockAgent(overrides = {}) {
  return {
    name: 'test-agent',
    nsec: 'nsec1test...',
    ...overrides
  };
}
```

#### 2. Add Component Testing
```typescript
// Example component test
import { render, screen } from '@testing-library/react';
import { AgentList } from './AgentList';

describe('AgentList', () => {
  it('renders agents with status indicators', () => {
    const agents = [createMockAgent({ status: 'online' })];
    render(<AgentList agents={agents} />);
    
    expect(screen.getByText('test-agent')).toBeInTheDocument();
    expect(screen.getByTestId('status-online')).toBeInTheDocument();
  });
});
```

#### 3. Integration Testing
```typescript
// Test agent orchestration
describe('AgentOrchestrator', () => {
  it('handles multi-agent conversations', async () => {
    const orchestrator = new AgentOrchestrator(config);
    const agents = await orchestrator.loadAgents();
    
    const result = await orchestrator.processTask({
      content: 'Implement feature X',
      mentions: ['@code', '@planner']
    });
    
    expect(result.participants).toHaveLength(2);
    expect(result.responses).toBeDefined();
  });
});
```

#### 4. API Documentation
```typescript
/**
 * Manages agent lifecycle and orchestration
 * @example
 * ```typescript
 * const orchestrator = new AgentOrchestrator(projectInfo);
 * await orchestrator.initialize();
 * const agent = await orchestrator.getOrCreateAgent('code');
 * ```
 */
export class AgentOrchestrator {
  // Implementation
}

## Performance Optimization

### Critical Performance Issues

#### 1. Memory Leaks
**Location:** `ConversationStorage`, event listeners
**Issue:** Unbounded growth, uncleaned listeners

**Fix:**
```typescript
// Implement cleanup
export class ConversationStorage {
  private cleanupInterval?: NodeJS.Timeout;
  
  async initialize() {
    // Clean old conversations periodically
    this.cleanupInterval = setInterval(
      () => this.cleanupOldConversations(),
      24 * 60 * 60 * 1000 // Daily
    );
  }
  
  async cleanupOldConversations() {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    // Remove old conversations
  }
  
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}
```

#### 2. Synchronous File Operations
**Location:** Throughout codebase
**Issue:** Blocking event loop

**Fix:**
```typescript
// Use async operations with batching
export class BatchedFileWriter {
  private queue: Map<string, any> = new Map();
  private timeout?: NodeJS.Timeout;
  
  async write(path: string, data: any) {
    this.queue.set(path, data);
    this.scheduleFlush();
  }
  
  private scheduleFlush() {
    if (this.timeout) return;
    
    this.timeout = setTimeout(() => {
      this.flush();
      this.timeout = undefined;
    }, 100);
  }
  
  private async flush() {
    const writes = Array.from(this.queue.entries());
    this.queue.clear();
    
    await Promise.all(
      writes.map(([path, data]) => 
        fileSystem.writeJSON(path, data)
      )
    );
  }
}
```

#### 3. Inefficient Algorithms
**Location:** Event processing, search operations
**Issue:** O(n²) complexity in some operations

**Fix:**
```typescript
// Use efficient data structures
export class EventIndex {
  private byId = new Map<string, Event>();
  private byKind = new Map<number, Set<string>>();
  private byAuthor = new Map<string, Set<string>>();
  
  add(event: Event) {
    this.byId.set(event.id, event);
    
    if (!this.byKind.has(event.kind)) {
      this.byKind.set(event.kind, new Set());
    }
    this.byKind.get(event.kind)!.add(event.id);
    
    if (!this.byAuthor.has(event.pubkey)) {
      this.byAuthor.set(event.pubkey, new Set());
    }
    this.byAuthor.get(event.pubkey)!.add(event.id);
  }
  
  findByKind(kind: number): Event[] {
    const ids = this.byKind.get(kind) || new Set();
    return Array.from(ids).map(id => this.byId.get(id)!);
  }
}
```

#### 4. React Performance
**Location:** Web client components
**Issue:** Unnecessary re-renders, large component trees

**Fix:**
```typescript
// Split components and use React.memo
export const ExpensiveComponent = memo(({ data }: Props) => {
  // Component logic
}, (prevProps, nextProps) => {
  // Custom comparison
  return prevProps.data.id === nextProps.data.id;
});

// Use React.lazy for code splitting
const HeavyFeature = lazy(() => import('./HeavyFeature'));

// Debounce expensive operations
const debouncedSearch = useMemo(
  () => debounce((term: string) => {
    performSearch(term);
  }, 300),
  []
);
```

## Operational Improvements

### 1. Logging & Monitoring
**Current:** Console.log throughout
**Needed:** Structured logging with levels

```typescript
// Implement structured logging
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Add performance monitoring
export function measurePerformance(name: string) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args: any[]) {
      const start = performance.now();
      try {
        return await originalMethod.apply(this, args);
      } finally {
        const duration = performance.now() - start;
        logger.info(`${name} took ${duration}ms`);
      }
    };
  };
}
```

### 2. Health Checks
**Current:** None
**Needed:** Service health monitoring

```typescript
// Add health check endpoints
export class HealthCheck {
  async check(): Promise<HealthStatus> {
    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkNostrConnection(),
      this.checkFileSystem(),
      this.checkMemory()
    ]);
    
    return {
      status: checks.every(c => c.ok) ? 'healthy' : 'unhealthy',
      checks,
      timestamp: Date.now()
    };
  }
}
```

### 3. Resource Management
**Current:** No limits or monitoring
**Needed:** Resource constraints and cleanup

```typescript
// Implement resource pools
export class ProcessPool {
  private processes: ChildProcess[] = [];
  private maxProcesses = 10;
  
  async spawn(command: string): Promise<ChildProcess> {
    if (this.processes.length >= this.maxProcesses) {
      await this.waitForSlot();
    }
    
    const proc = spawn(command);
    this.processes.push(proc);
    
    proc.on('exit', () => {
      this.processes = this.processes.filter(p => p !== proc);
    });
    
    return proc;
  }
}
```

## Prioritized Action Plan

### Immediate (Performance & Stability)
1. **Fix Memory Leaks** - Add cleanup for conversations and listeners
2. **Add Error Boundaries** - Prevent React crashes
3. **Implement Error Recovery** - Add retry logic and fallback strategies
4. **Optimize File Operations** - Batch writes and use async operations

### Short Term (1-2 weeks)
1. **Implement Workspace** - Set up Bun workspace configuration
2. **Runtime Validation** - Add Zod schemas for critical data
3. **Structured Logging** - Replace console.log with proper logging
4. **Performance Monitoring** - Add basic metrics collection

### Medium Term (1 month)
1. **Component Optimization** - Add memoization and virtualization
2. **Test Coverage** - Establish basic test suite with utilities
3. **Health Monitoring** - Add health checks and metrics
4. **Resource Management** - Implement pools and limits
5. **State Management** - Centralize atoms with persistence

### Long Term (2-3 months)
1. **Database Migration** - Move from JSON files to proper database
2. **Horizontal Scaling** - Add clustering support
3. **Performance Profiling** - Continuous performance monitoring
4. **Architecture Documentation** - Comprehensive API docs
5. **Advanced Caching** - Implement multi-layer caching strategy

## Conclusion

The TENEX codebase has a solid architectural foundation with a well-designed multi-agent system. The main areas for improvement focus on:

1. **Project Organization** - Implementing proper workspace configuration
2. **Performance** - Addressing memory leaks and optimizing React components
3. **Code Quality** - Adding runtime validation and proper error handling
4. **Testing** - Establishing comprehensive test coverage
5. **Operational Excellence** - Structured logging and monitoring

These improvements will enhance developer experience, system performance, and long-term maintainability without requiring fundamental architectural changes.