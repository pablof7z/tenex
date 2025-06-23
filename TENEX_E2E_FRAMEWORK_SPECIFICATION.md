# TENEX E2E Testing Framework - Complete Implementation Specification

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Core Principles](#core-principles)
3. [Architecture Overview](#architecture-overview)
4. [Module Specifications](#module-specifications)
5. [Implementation Milestones](#implementation-milestones)
6. [Extension Guide](#extension-guide)
7. [Test Scenario Development](#test-scenario-development)
8. [Critical Implementation Details](#critical-implementation-details)
9. [API Reference](#api-reference)
10. [Troubleshooting Guide](#troubleshooting-guide)

---

## 1. Executive Summary

### Purpose
Create an LLM-friendly E2E testing framework for TENEX that enables autonomous testing of the complete system workflow from daemon initialization through complex agent interactions.

### Key Goals
- **Zero Manual Intervention**: Tests run completely autonomously
- **Complete Isolation**: Each test run is hermetic and reproducible
- **LLM-Optimized API**: Declarative, typed, and self-documenting
- **Extensible**: Easy to add new test scenarios without modifying core

### Success Criteria
- An LLM can write and execute test scenarios using only the API documentation
- Tests can run in parallel without interference
- Failed tests provide actionable error messages
- New test scenarios require only implementing a new scenario file

---

## 2. Core Principles

### DRY (Don't Repeat Yourself)
- **Shared test utilities** in `BaseScenario` class
- **Reusable assertions** in dedicated modules
- **Common setup/teardown** logic centralized
- **Configuration templates** for typical test patterns

### SRP (Single Responsibility Principle)
- **TestEnvironment**: Manages filesystem and process isolation
- **NostrMonitor**: Handles all Nostr event subscriptions
- **ProcessController**: Manages child process lifecycle
- **CliClient**: Wraps CLI interactions
- **Orchestrator**: Coordinates components (facade pattern)

### YAGNI (You Aren't Gonna Need It)
- **No relay management** - use existing public relays initially
- **No custom test runner** - use Bun's built-in test
- **No complex retry mechanisms** - simple timeout + retry
- **No test database** - filesystem-based state only

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Test Script                           │
│  (Written by LLM using high-level Orchestrator API)        │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                      Orchestrator                            │
│  (Facade coordinating all components)                        │
└──────┬──────────┬──────────┬──────────┬────────────────────┘
       │          │          │          │
┌──────▼────┐ ┌──▼────┐ ┌───▼───┐ ┌────▼────┐
│   Test    │ │  CLI  │ │ Nostr │ │ Process │
│Environment│ │Client │ │Monitor│ │Controller│
└───────────┘ └───────┘ └───────┘ └──────────┘
       │          │          │          │
       └──────────┴──────────┴──────────┘
                      │
         ┌────────────▼────────────┐
         │   TENEX System          │
         │ (daemon, cli, projects) │
         └─────────────────────────┘
```

---

## 4. Module Specifications

### 4.1 TestEnvironment Module

**File**: `e2e-framework/src/TestEnvironment.ts`

**Responsibility**: Manage isolated test execution environment

```typescript
export class TestEnvironment {
  private tempDir: string;
  private testId: string;
  
  constructor(testId?: string) {
    this.testId = testId || generateTestId();
  }
  
  async setup(): Promise<void> {
    // Create isolated temp directory
    this.tempDir = path.join(tmpdir(), `tenex-e2e-${this.testId}`);
    await mkdir(this.tempDir, { recursive: true });
    
    // Set up test-specific directories
    await mkdir(path.join(this.tempDir, '.tenex'));
    await mkdir(path.join(this.tempDir, 'projects'));
  }
  
  async teardown(): Promise<void> {
    // Clean up temp directory
    await rm(this.tempDir, { recursive: true, force: true });
  }
  
  getConfigDir(): string {
    return path.join(this.tempDir, '.tenex');
  }
  
  getProjectDir(projectName: string): string {
    return path.join(this.tempDir, 'projects', projectName);
  }
  
  async writeConfig(config: TenexConfig): Promise<void> {
    const configPath = path.join(this.getConfigDir(), 'config.json');
    await writeFile(configPath, JSON.stringify(config, null, 2));
  }
}
```

### 4.2 ProcessController Module

**File**: `e2e-framework/src/ProcessController.ts`

**Responsibility**: Spawn and manage child processes

```typescript
export interface ProcessHandle {
  process: ChildProcess;
  stdout: AsyncIterableIterator<string>;
  stderr: AsyncIterableIterator<string>;
}

export class ProcessController {
  private processes: Map<string, ProcessHandle> = new Map();
  
  async spawn(
    name: string,
    command: string,
    args: string[],
    options: SpawnOptions = {}
  ): Promise<ProcessHandle> {
    const proc = spawn(command, args, {
      ...options,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    const handle: ProcessHandle = {
      process: proc,
      stdout: this.createLineIterator(proc.stdout),
      stderr: this.createLineIterator(proc.stderr)
    };
    
    this.processes.set(name, handle);
    return handle;
  }
  
  async kill(name: string): Promise<void> {
    const handle = this.processes.get(name);
    if (handle) {
      handle.process.kill('SIGTERM');
      this.processes.delete(name);
    }
  }
  
  async killAll(): Promise<void> {
    for (const [name] of this.processes) {
      await this.kill(name);
    }
  }
  
  private async *createLineIterator(stream: Readable): AsyncIterableIterator<string> {
    let buffer = '';
    for await (const chunk of stream) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        yield line;
      }
    }
    if (buffer) yield buffer;
  }
}
```

### 4.3 NostrMonitor Module

**File**: `e2e-framework/src/NostrMonitor.ts`

**Responsibility**: Subscribe to and filter Nostr events

```typescript
import NDK, { NDKEvent, NDKFilter } from '@nostr-dev-kit/ndk';

export class NostrMonitor {
  private ndk: NDK;
  private subscriptions: Map<string, NDKSubscription> = new Map();
  
  constructor(private relays: string[]) {
    this.ndk = new NDK({
      explicitRelayUrls: relays,
      autoConnectUserRelays: false
    });
  }
  
  async connect(): Promise<void> {
    await this.ndk.connect();
  }
  
  async disconnect(): Promise<void> {
    for (const sub of this.subscriptions.values()) {
      sub.stop();
    }
    this.subscriptions.clear();
    await this.ndk.destroy();
  }
  
  async waitForEvent(
    filter: NDKFilter,
    options: { timeout?: number; validate?: (event: NDKEvent) => boolean } = {}
  ): Promise<NDKEvent> {
    const { timeout = 30000, validate } = options;
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        sub.stop();
        reject(new Error(`Timeout waiting for event matching ${JSON.stringify(filter)}`));
      }, timeout);
      
      const sub = this.ndk.subscribe(filter, {
        closeOnEose: false
      });
      
      sub.on('event', (event: NDKEvent) => {
        if (!validate || validate(event)) {
          clearTimeout(timeoutId);
          sub.stop();
          resolve(event);
        }
      });
    });
  }
  
  subscribeToProject(projectNaddr: string): AsyncIterableIterator<NDKEvent> {
    const filter: NDKFilter = {
      '#a': [projectNaddr],
      kinds: [1, 24111, 9001, 9002] // messages, typing, status updates
    };
    
    return this.createEventIterator(filter);
  }
  
  private async *createEventIterator(filter: NDKFilter): AsyncIterableIterator<NDKEvent> {
    const events: NDKEvent[] = [];
    let resolveNext: ((value: IteratorResult<NDKEvent>) => void) | null = null;
    
    const sub = this.ndk.subscribe(filter, { closeOnEose: false });
    
    sub.on('event', (event: NDKEvent) => {
      if (resolveNext) {
        resolveNext({ value: event, done: false });
        resolveNext = null;
      } else {
        events.push(event);
      }
    });
    
    try {
      while (true) {
        if (events.length > 0) {
          yield events.shift()!;
        } else {
          yield await new Promise<NDKEvent>((resolve) => {
            resolveNext = (result) => resolve(result.value);
          });
        }
      }
    } finally {
      sub.stop();
    }
  }
}
```

### 4.4 CliClient Module

**File**: `e2e-framework/src/CliClient.ts`

**Responsibility**: Programmatic interface to cli-client

```typescript
export interface ProjectInfo {
  naddr: string;
  name: string;
  description?: string;
}

export class CliClient {
  constructor(
    private processController: ProcessController,
    private nsec: string,
    private cliPath: string
  ) {}
  
  async createProject(options: {
    name: string;
    description?: string;
    template?: string;
    agents?: string[];
    instructions?: string[];
  }): Promise<ProjectInfo> {
    const args = ['project', 'create', '--json'];
    
    // Build command arguments
    args.push('--name', options.name);
    if (options.description) args.push('--description', options.description);
    if (options.template) args.push('--template', options.template);
    if (options.agents?.length) args.push('--agents', options.agents.join(','));
    if (options.instructions?.length) args.push('--instructions', options.instructions.join(','));
    
    const output = await this.runCommand(args);
    return JSON.parse(output);
  }
  
  async sendMessage(projectNaddr: string, message: string): Promise<string> {
    const args = ['chat', '--project', projectNaddr, '--message', message, '--json'];
    const output = await this.runCommand(args);
    return JSON.parse(output).threadId;
  }
  
  async listProjects(): Promise<ProjectInfo[]> {
    const output = await this.runCommand(['project', 'list', '--json']);
    return JSON.parse(output);
  }
  
  private async runCommand(args: string[]): Promise<string> {
    const handle = await this.processController.spawn(
      `cli-${Date.now()}`,
      'bun',
      [this.cliPath, ...args],
      {
        env: {
          ...process.env,
          NSEC: this.nsec,
          NODE_ENV: 'test'
        }
      }
    );
    
    let output = '';
    let errorOutput = '';
    
    for await (const line of handle.stdout) {
      output += line + '\n';
    }
    
    for await (const line of handle.stderr) {
      errorOutput += line + '\n';
    }
    
    // Wait for process to exit
    await new Promise((resolve, reject) => {
      handle.process.on('exit', (code) => {
        if (code === 0) {
          resolve(void 0);
        } else {
          reject(new Error(`CLI exited with code ${code}: ${errorOutput}`));
        }
      });
    });
    
    return output.trim();
  }
}
```

### 4.5 Orchestrator Module

**File**: `e2e-framework/src/Orchestrator.ts`

**Responsibility**: High-level test coordination

```typescript
import { generatePrivateKey, getPublicKey } from 'nostr-tools';

export class Orchestrator {
  private environment: TestEnvironment;
  private processController: ProcessController;
  private nostrMonitor: NostrMonitor;
  private cliClient: CliClient;
  private daemonHandle?: ProcessHandle;
  
  // Test identity
  private nsec: string;
  private npub: string;
  
  constructor(options: {
    relays?: string[];
    llmConfig?: LLMConfig;
  } = {}) {
    this.environment = new TestEnvironment();
    this.processController = new ProcessController();
    this.nostrMonitor = new NostrMonitor(
      options.relays || ['wss://relay.damus.io', 'wss://relay.nostr.band']
    );
    
    // Generate test identity
    this.nsec = generatePrivateKey();
    this.npub = getPublicKey(this.nsec);
    
    this.cliClient = new CliClient(
      this.processController,
      this.nsec,
      path.join(process.cwd(), 'cli-client', 'src', 'index.ts')
    );
  }
  
  async setup(): Promise<void> {
    // Set up environment
    await this.environment.setup();
    
    // Write daemon config
    const config: TenexConfig = {
      whitelistedPubkeys: [this.npub],
      llmConfigs: this.options.llmConfig ? [this.options.llmConfig] : []
    };
    await this.environment.writeConfig(config);
    
    // Start daemon
    this.daemonHandle = await this.processController.spawn(
      'daemon',
      'bun',
      ['tenex', 'daemon'],
      {
        env: {
          ...process.env,
          TENEX_CONFIG_DIR: this.environment.getConfigDir()
        }
      }
    );
    
    // Wait for daemon ready
    await this.waitForDaemonReady();
    
    // Connect Nostr monitor
    await this.nostrMonitor.connect();
  }
  
  async teardown(): Promise<void> {
    // Disconnect Nostr
    await this.nostrMonitor.disconnect();
    
    // Kill all processes
    await this.processController.killAll();
    
    // Clean environment
    await this.environment.teardown();
  }
  
  async createProject(options: ProjectOptions): Promise<Project> {
    const info = await this.cliClient.createProject(options);
    
    return new Project(
      this,
      info.naddr,
      info.name,
      this.environment.getProjectDir(info.name)
    );
  }
  
  async waitForFile(
    projectDir: string,
    filePath: string,
    options: { timeout?: number; content?: string } = {}
  ): Promise<void> {
    const { timeout = 30000, content } = options;
    const fullPath = path.join(projectDir, filePath);
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const fileContent = await readFile(fullPath, 'utf-8');
        if (!content || fileContent.includes(content)) {
          return;
        }
      } catch (e) {
        // File doesn't exist yet
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    throw new Error(`Timeout waiting for file: ${filePath}`);
  }
  
  async readFile(projectDir: string, filePath: string): Promise<string> {
    const fullPath = path.join(projectDir, filePath);
    return readFile(fullPath, 'utf-8');
  }
  
  private async waitForDaemonReady(): Promise<void> {
    if (!this.daemonHandle) throw new Error('Daemon not started');
    
    for await (const line of this.daemonHandle.stdout) {
      if (line.includes('Monitoring events from')) {
        return;
      }
    }
    
    throw new Error('Daemon failed to start');
  }
}
```

### 4.6 Project and Conversation Classes

**File**: `e2e-framework/src/Project.ts`

```typescript
export class Project {
  constructor(
    private orchestrator: Orchestrator,
    public readonly naddr: string,
    public readonly name: string,
    public readonly directory: string
  ) {}
  
  async startConversation(options: {
    message: string;
    title?: string;
  }): Promise<Conversation> {
    const threadId = await this.orchestrator.cliClient.sendMessage(
      this.naddr,
      options.message
    );
    
    return new Conversation(
      this.orchestrator,
      this,
      threadId,
      options.title || 'Test Conversation'
    );
  }
  
  async waitForFile(filePath: string, options?: WaitOptions): Promise<void> {
    return this.orchestrator.waitForFile(this.directory, filePath, options);
  }
  
  async readFile(filePath: string): Promise<string> {
    return this.orchestrator.readFile(this.directory, filePath);
  }
  
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await this.readFile(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
```

**File**: `e2e-framework/src/Conversation.ts`

```typescript
export class Conversation {
  private messages: NostrEvent[] = [];
  
  constructor(
    private orchestrator: Orchestrator,
    private project: Project,
    private threadId: string,
    private title: string
  ) {}
  
  async sendMessage(content: string): Promise<void> {
    await this.orchestrator.cliClient.sendMessage(
      this.project.naddr,
      content
    );
  }
  
  async waitForReply(options: {
    timeout?: number;
    validate?: (event: NDKEvent) => boolean;
  } = {}): Promise<NDKEvent> {
    const event = await this.orchestrator.nostrMonitor.waitForEvent(
      {
        kinds: [1],
        '#a': [this.project.naddr],
        '#e': [this.threadId]
      },
      options
    );
    
    this.messages.push(event);
    return event;
  }
  
  async waitForCompletion(options: {
    timeout?: number;
    indicators?: string[];
  } = {}): Promise<void> {
    const { timeout = 60000, indicators = ['Done', 'Completed', 'Finished'] } = options;
    
    const reply = await this.waitForReply({
      timeout,
      validate: (event) => {
        const content = event.content.toLowerCase();
        return indicators.some(ind => content.includes(ind.toLowerCase()));
      }
    });
  }
  
  getMessages(): NostrEvent[] {
    return [...this.messages];
  }
}
```

---

## 5. Implementation Milestones

### Milestone 1: Foundation (Core Infrastructure)

**Modules to implement**:
1. `TestEnvironment.ts`
2. `ProcessController.ts`
3. Basic types in `types.ts`

**Validation criteria**:
- Can create/destroy isolated test directories
- Can spawn and kill processes reliably
- Process stdout/stderr captured correctly

**Test case**:
```typescript
const env = new TestEnvironment();
await env.setup();
const controller = new ProcessController();
const handle = await controller.spawn('test', 'echo', ['hello']);
// Verify output captured
await env.teardown();
```

### Milestone 2: Process Control

**Modules to implement**:
1. Complete `ProcessController.ts` with line iterator
2. Add timeout and error handling

**Validation criteria**:
- Line-by-line output iteration works
- Process termination handled gracefully
- Timeouts trigger correctly

### Milestone 3: CLI Client Integration

**Prerequisites**:
- Modify `cli-client` to support `--json` flag
- Add non-interactive mode to cli-client

**Modules to implement**:
1. `CliClient.ts`
2. JSON parsing and error handling

**Validation criteria**:
- Can create project programmatically
- JSON output parsed correctly
- Errors propagated with context

### Milestone 4: Nostr Integration

**Modules to implement**:
1. `NostrMonitor.ts`
2. Event filtering and subscription management

**Validation criteria**:
- Can connect to relays
- Event subscriptions work
- Timeout handling for events

### Milestone 5: Orchestrator Assembly

**Modules to implement**:
1. `Orchestrator.ts`
2. `Project.ts`
3. `Conversation.ts`

**Validation criteria**:
- Full setup/teardown cycle works
- Can create project and start conversation
- File system assertions work

### Milestone 6: Test Scenarios

**Modules to implement**:
1. `BaseScenario.ts`
2. Example scenarios in `scenarios/`

**Validation criteria**:
- Can run complete test scenario
- Proper error reporting
- Reproducible results

---

## 6. Extension Guide

### Adding a New Test Scenario

**Step 1**: Create a new file in `scenarios/`

```typescript
// e2e-framework/src/scenarios/MyNewScenario.ts
import { BaseScenario } from '../BaseScenario';
import { expect } from 'bun:test';

export class MyNewScenario extends BaseScenario {
  name = 'My New Test Scenario';
  description = 'Tests a specific workflow';
  
  async run(): Promise<void> {
    // Create project
    const project = await this.orchestrator.createProject({
      name: 'test-project',
      agents: ['coder'],
      instructions: ['be-concise']
    });
    
    // Start conversation
    const conversation = await project.startConversation({
      message: 'Create a README.md file'
    });
    
    // Wait for completion
    await project.waitForFile('README.md');
    
    // Validate
    const content = await project.readFile('README.md');
    expect(content).toContain('# test-project');
  }
}
```

**Step 2**: Register the scenario

```typescript
// e2e-framework/src/scenarios/index.ts
export { MyNewScenario } from './MyNewScenario';
```

**Step 3**: Use in test

```typescript
import { MyNewScenario } from 'e2e-framework';

test('my new scenario', async () => {
  const scenario = new MyNewScenario();
  await scenario.execute(); // Handles setup/teardown
});
```

### Adding Custom Assertions

Create domain-specific assertions in `e2e-framework/src/assertions/`:

```typescript
// FileAssertions.ts
export async function assertFileContains(
  project: Project,
  filePath: string,
  expected: string
): Promise<void> {
  const content = await project.readFile(filePath);
  if (!content.includes(expected)) {
    throw new Error(
      `File ${filePath} does not contain "${expected}"\nActual content:\n${content}`
    );
  }
}

export async function assertFileMatches(
  project: Project,
  filePath: string,
  pattern: RegExp
): Promise<void> {
  const content = await project.readFile(filePath);
  if (!pattern.test(content)) {
    throw new Error(
      `File ${filePath} does not match pattern ${pattern}\nActual content:\n${content}`
    );
  }
}
```

### Adding New Orchestrator Methods

Extend the Orchestrator class following SRP:

```typescript
// In Orchestrator.ts
async runCommand(
  project: Project,
  command: string,
  args: string[] = []
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const handle = await this.processController.spawn(
    `cmd-${Date.now()}`,
    command,
    args,
    { cwd: project.directory }
  );
  
  // Collect output and return
}
```

---

## 7. Test Scenario Development

### Base Scenario Pattern

All scenarios should extend `BaseScenario`:

```typescript
// e2e-framework/src/BaseScenario.ts
export abstract class BaseScenario {
  abstract name: string;
  abstract description: string;
  
  protected orchestrator: Orchestrator;
  
  constructor(options: ScenarioOptions = {}) {
    this.orchestrator = new Orchestrator(options);
  }
  
  async execute(): Promise<ScenarioResult> {
    const startTime = Date.now();
    const result: ScenarioResult = {
      name: this.name,
      success: false,
      duration: 0,
      error: null
    };
    
    try {
      await this.orchestrator.setup();
      await this.run();
      result.success = true;
    } catch (error) {
      result.error = error;
      throw error;
    } finally {
      result.duration = Date.now() - startTime;
      await this.orchestrator.teardown();
    }
    
    return result;
  }
  
  abstract run(): Promise<void>;
}
```

### Common Test Patterns

#### 1. Simple File Creation
```typescript
export class FileCreationScenario extends BaseScenario {
  async run(): Promise<void> {
    const project = await this.orchestrator.createProject({
      name: 'file-test',
      agents: ['coder']
    });
    
    const conv = await project.startConversation({
      message: '@coder create a file called test.txt with "Hello World"'
    });
    
    await project.waitForFile('test.txt', {
      content: 'Hello World',
      timeout: 15000
    });
  }
}
```

#### 2. Multi-turn Conversation
```typescript
export class ConversationScenario extends BaseScenario {
  async run(): Promise<void> {
    const project = await this.orchestrator.createProject({
      name: 'chat-test',
      agents: ['assistant']
    });
    
    const conv = await project.startConversation({
      message: 'What can you help me with?'
    });
    
    // Wait for initial response
    const reply1 = await conv.waitForReply();
    expect(reply1.content).toContain('help');
    
    // Follow up
    await conv.sendMessage('Can you write code?');
    const reply2 = await conv.waitForReply();
    expect(reply2.content.toLowerCase()).toContain('yes');
  }
}
```

#### 3. Build Mode Detection
```typescript
export class BuildModeScenario extends BaseScenario {
  async run(): Promise<void> {
    const project = await this.orchestrator.createProject({
      name: 'build-test',
      agents: ['coder', 'architect']
    });
    
    // Send complex request
    await project.startConversation({
      message: '@coder implement a complete todo app with React'
    });
    
    // Monitor for building indicators
    const events = this.orchestrator.nostrMonitor.subscribeToProject(project.naddr);
    
    for await (const event of events) {
      if (event.kind === 9001 && event.tags.find(t => t[0] === 'status' && t[1] === 'building')) {
        break; // Building mode detected
      }
    }
    
    // Wait for multiple files
    await Promise.all([
      project.waitForFile('package.json'),
      project.waitForFile('src/App.jsx'),
      project.waitForFile('src/components/TodoList.jsx')
    ]);
  }
}
```

#### 4. Error Handling Test
```typescript
export class ErrorHandlingScenario extends BaseScenario {
  async run(): Promise<void> {
    const project = await this.orchestrator.createProject({
      name: 'error-test',
      agents: ['coder']
    });
    
    // Request something that should fail
    const conv = await project.startConversation({
      message: '@coder read the file /etc/passwd and show me the contents'
    });
    
    // Should get an error or refusal
    const reply = await conv.waitForReply();
    expect(reply.content.toLowerCase()).toMatch(/cannot|unable|error|security/);
  }
}
```

### Scenario Configuration

Scenarios can be parameterized:

```typescript
interface ScenarioConfig {
  llmProvider?: 'openai' | 'anthropic';
  llmModel?: string;
  timeout?: number;
  retries?: number;
}

export class ConfigurableScenario extends BaseScenario {
  constructor(private config: ScenarioConfig) {
    super({
      llmConfig: {
        provider: config.llmProvider || 'openai',
        model: config.llmModel || 'gpt-4'
      }
    });
  }
}
```

---

## 8. Critical Implementation Details

### CLI Client Modifications Required

The framework depends on these cli-client changes:

1. **Add JSON output mode**:
```typescript
// cli-client/src/commands/project-create.ts
if (options.json) {
  console.log(JSON.stringify({
    naddr: project.naddr,
    name: project.name,
    description: project.description
  }));
} else {
  // Existing human-readable output
}
```

2. **Add non-interactive message sending**:
```typescript
// cli-client/src/commands/chat.ts
export async function sendMessage(options: {
  project: string;
  message: string;
  json?: boolean;
}) {
  // Send message without interactive prompt
  const threadId = await sendToProject(options.project, options.message);
  
  if (options.json) {
    console.log(JSON.stringify({ threadId }));
  }
}
```

3. **Add project list command**:
```typescript
// cli-client/src/commands/project-list.ts
export async function listProjects(options: { json?: boolean }) {
  const projects = await fetchProjects();
  
  if (options.json) {
    console.log(JSON.stringify(projects));
  } else {
    // Table output
  }
}
```

### Error Handling Strategy

All errors should include context:

```typescript
class TestError extends Error {
  constructor(
    message: string,
    public context: {
      scenario?: string;
      step?: string;
      project?: string;
      stdout?: string;
      stderr?: string;
    }
  ) {
    super(message);
    this.name = 'TestError';
  }
}

// Usage
throw new TestError('Failed to create project', {
  scenario: 'FileCreationScenario',
  step: 'project creation',
  stderr: processError
});
```

### Timeout Management

Implement graduated timeouts:

```typescript
const TIMEOUTS = {
  processStart: 5000,      // Process startup
  daemonReady: 30000,      // Daemon initialization
  projectCreate: 10000,    // Project creation
  fileCreation: 15000,     // Simple file creation
  complexTask: 60000,      // Complex operations
  conversation: 120000     // Full conversation
};
```

### Resource Cleanup

Ensure cleanup even on failure:

```typescript
process.on('SIGINT', async () => {
  console.log('\nCleaning up test resources...');
  await globalCleanup();
  process.exit(1);
});

process.on('uncaughtException', async (error) => {
  console.error('Uncaught exception:', error);
  await globalCleanup();
  process.exit(1);
});
```

---

## 9. API Reference

### Orchestrator API

```typescript
class Orchestrator {
  // Lifecycle
  setup(): Promise<void>
  teardown(): Promise<void>
  
  // Project management
  createProject(options: ProjectOptions): Promise<Project>
  
  // File operations
  waitForFile(projectDir: string, path: string, options?: WaitOptions): Promise<void>
  readFile(projectDir: string, path: string): Promise<string>
  
  // Process execution
  runCommand(project: Project, cmd: string, args?: string[]): Promise<CommandResult>
}
```

### Project API

```typescript
class Project {
  // Properties
  readonly naddr: string
  readonly name: string
  readonly directory: string
  
  // Conversation
  startConversation(options: ConversationOptions): Promise<Conversation>
  
  // File operations
  waitForFile(path: string, options?: WaitOptions): Promise<void>
  readFile(path: string): Promise<string>
  fileExists(path: string): Promise<boolean>
}
```

### Conversation API

```typescript
class Conversation {
  // Messaging
  sendMessage(content: string): Promise<void>
  waitForReply(options?: ReplyOptions): Promise<NDKEvent>
  waitForCompletion(options?: CompletionOptions): Promise<void>
  
  // History
  getMessages(): NostrEvent[]
}
```

---

## 10. Troubleshooting Guide

### Common Issues

1. **"Daemon failed to start"**
   - Check LLM configuration is valid
   - Ensure no other tenex daemon running
   - Verify temp directory permissions

2. **"Timeout waiting for event"**
   - Increase timeout values
   - Check relay connectivity
   - Verify event filters are correct

3. **"CLI command failed"**
   - Check cli-client supports required flags
   - Verify NSEC is being passed correctly
   - Check for interactive prompts blocking

### Debug Mode

Enable detailed logging:

```typescript
const orchestrator = new Orchestrator({
  debug: true,
  logFile: './test-debug.log'
});
```

### Performance Optimization

1. **Use local relay** for faster event propagation
2. **Parallelize file waits** when possible
3. **Reuse orchestrator** for multiple related tests
4. **Cache LLM responses** for deterministic tests

---

## Implementation Checklist

- [ ] Create `e2e-framework` workspace in monorepo
- [ ] Set up TypeScript configuration
- [ ] Implement core modules (Milestone 1-2)
- [ ] Modify cli-client for JSON output
- [ ] Implement CLI integration (Milestone 3)
- [ ] Add Nostr monitoring (Milestone 4)
- [ ] Build orchestrator (Milestone 5)
- [ ] Create example scenarios
- [ ] Write integration tests for framework itself
- [ ] Document usage examples
- [ ] Add to CI/CD pipeline

## Summary

This specification provides a complete blueprint for implementing a robust E2E testing framework for TENEX. The design prioritizes:

1. **LLM-friendliness** through declarative APIs
2. **Isolation** via ephemeral test environments  
3. **Extensibility** through scenario patterns
4. **Maintainability** via SOLID principles

An LLM implementing this specification should start with Milestone 1 and progress sequentially, validating each milestone before proceeding. The framework will enable comprehensive automated testing of the entire TENEX system with minimal manual intervention.