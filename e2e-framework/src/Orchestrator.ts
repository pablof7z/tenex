import { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import * as path from 'node:path';
import { readFile } from 'node:fs/promises';
import { watchForFile } from './utils/FileWatcher';
import { Logger } from './utils/Logger';
import { TestEnvironment } from './TestEnvironment';
import { ProcessController, type ProcessHandle } from './ProcessController';
import { NostrMonitor } from './NostrMonitor';
import { CliClient } from './CliClient';
import { Project } from './Project';
import { getConfig } from './config';
import type { 
  LLMConfig, 
  TenexConfig, 
  ProjectOptions, 
  WaitOptions
} from './types';

/**
 * Configuration options for the Orchestrator.
 */
export interface OrchestratorOptions {
  /** Custom Nostr relay URLs to use instead of defaults */
  relays?: string[];
  /** LLM provider configuration */
  llmConfig?: LLMConfig;
  /** Enable debug logging */
  debug?: boolean;
  /** Path to write debug logs */
  logFile?: string;
}

/**
 * Main orchestrator for E2E testing of TENEX applications.
 * Manages test environment, processes, CLI client, and Nostr monitoring.
 * 
 * @example
 * ```typescript
 * const orchestrator = new Orchestrator({
 *   llmConfig: { provider: 'openai', model: 'gpt-4' }
 * });
 * await orchestrator.setup();
 * 
 * const project = await orchestrator.createProject({
 *   name: 'test-project',
 *   agents: ['coder']
 * });
 * 
 * await orchestrator.teardown();
 * ```
 */
export class Orchestrator {
  private environment: TestEnvironment;
  private processController: ProcessController;
  private nostrMonitor: NostrMonitor;
  private cliClient: CliClient;
  private daemonHandle?: ProcessHandle;
  
  // Test identity
  private nsec: string;
  private npub: string;
  
  // Logger
  private logger: Logger;
  
  /**
   * Creates a new Orchestrator instance.
   * 
   * @param options - Configuration options for the orchestrator
   */
  constructor(private options: OrchestratorOptions = {}) {
    const config = getConfig();
    
    this.environment = new TestEnvironment();
    this.processController = new ProcessController();
    this.nostrMonitor = new NostrMonitor(
      options.relays || config.nostr.defaultRelays
    );
    
    // Generate test identity
    const signer = NDKPrivateKeySigner.generate();
    this.nsec = signer.nsec!;
    this.npub = signer.npub!;
    
    this.cliClient = new CliClient(
      this.processController,
      this.nsec,
      path.join(process.cwd(), config.cli.path)
    );
    
    // Initialize logger
    this.logger = new Logger({
      component: 'Orchestrator',
      debug: options.debug,
      logFile: options.logFile
    });
  }
  
  /**
   * Sets up the test environment and starts the TENEX daemon.
   * Must be called before running any tests.
   * 
   * @throws {Error} If daemon fails to start or connect to relays
   * @throws {Error} If environment setup fails
   * 
   * @remarks
   * This method will automatically clean up partial state if setup fails.
   */
  async setup(): Promise<void> {
    let setupComplete = false;
    this.logger.info('Starting orchestrator setup');
    
    try {
      // Set up environment
      this.logger.debug('Setting up test environment');
      await this.environment.setup();
      
      // Write daemon config
      const config: TenexConfig = {
        whitelistedPubkeys: [this.npub],
        llmConfigs: this.options.llmConfig ? [this.options.llmConfig] : []
      };
      this.logger.debug('Writing daemon config', { npub: this.npub });
      await this.environment.writeConfig(config);
      
      // Write LLM config if provided
      if (this.options.llmConfig) {
        await this.environment.writeLLMConfig([{
          ...this.options.llmConfig,
          name: 'default'
        }]);
      }
      
      // Start daemon
      this.logger.info('Starting TENEX daemon');
      const tenexPath = path.join(process.cwd(), '..', 'tenex', 'src', 'cli.ts');
      const projectsPath = path.join(this.environment.getTempDir(), 'projects');
      
      this.daemonHandle = await this.processController.spawn(
        'daemon',
        'bun',
        [tenexPath, 'daemon', '--projects-path', projectsPath],
        {
          env: {
            ...process.env,
            TENEX_CONFIG_DIR: this.environment.getConfigDir(),
            LOG_LEVEL: 'debug',
            TENEX_LOG: 'general:debug,nostr:debug,agent:debug'
          },
          cwd: path.join(process.cwd(), '..', 'tenex')
        }
      );
      
      // Wait for daemon ready
      await this.waitForDaemonReady();
      this.logger.info('Daemon ready');
      
      // Connect Nostr monitor
      this.logger.debug('Connecting to Nostr relays', { relays: this.options.relays });
      await this.nostrMonitor.connect();
      
      setupComplete = true;
      this.logger.info('Orchestrator setup complete');
    } catch (error) {
      this.logger.error('Setup failed', { error: (error as Error).message });
      // If setup fails, clean up partial state
      if (!setupComplete) {
        await this.teardown();
      }
      throw error;
    }
  }
  
  /**
   * Tears down the test environment, stopping all processes and cleaning up resources.
   * Should be called after tests complete, even if they fail.
   * 
   * @remarks
   * This method is safe to call multiple times and will not throw errors
   * if resources are already cleaned up.
   */
  async teardown(): Promise<void> {
    this.logger.info('Starting teardown');
    
    // Disconnect Nostr
    this.logger.debug('Disconnecting from Nostr');
    await this.nostrMonitor.disconnect();
    
    // Kill all processes
    this.logger.debug('Killing all processes');
    await this.processController.killAll();
    
    // Clean environment
    this.logger.debug('Cleaning up test environment');
    await this.environment.teardown();
    
    this.logger.info('Teardown complete');
  }
  
  /**
   * Creates a new TENEX project.
   * 
   * @param options - Project creation options
   * @param options.name - Project name
   * @param options.description - Project description (optional)
   * @param options.template - Project template to use (optional)
   * @param options.agents - List of agents to add to the project
   * @param options.instructions - List of instruction IDs to apply
   * @returns A Project instance for interacting with the created project
   * 
   * @example
   * ```typescript
   * const project = await orchestrator.createProject({
   *   name: 'my-app',
   *   description: 'Test application',
   *   agents: ['architect', 'coder'],
   *   instructions: ['be-concise']
   * });
   * ```
   */
  async createProject(options: ProjectOptions): Promise<Project> {
    this.logger.info('Creating project', { name: options.name });
    const info = await this.cliClient.createProject(options);
    this.logger.debug('Project created', { naddr: info.naddr });
    
    return new Project(
      this,
      info.naddr,
      info.name,
      this.environment.getProjectDir(info.name)
    );
  }
  
  /**
   * Waits for a file to exist in the project directory.
   * 
   * @param projectDir - The project directory path
   * @param filePath - Relative path to the file within the project
   * @param options - Wait options
   * @param options.timeout - Maximum time to wait in milliseconds
   * @param options.content - Optional content that must be present in the file
   * @throws {Error} If file is not found within the timeout period
   * 
   * @internal
   */
  async waitForFile(
    projectDir: string,
    filePath: string,
    options: WaitOptions = {}
  ): Promise<void> {
    const config = getConfig();
    const { timeout = config.timeouts.fileWait, content } = options;
    const fullPath = path.join(projectDir, filePath);
    
    // Use file watcher for efficient waiting
    await watchForFile(fullPath, { timeout, content });
  }
  
  /**
   * Reads the contents of a file from the project directory.
   * 
   * @param projectDir - The project directory path
   * @param filePath - Relative path to the file within the project
   * @returns The file contents as a string
   * @throws {Error} If the file does not exist
   * 
   * @internal
   */
  async readFile(projectDir: string, filePath: string): Promise<string> {
    const fullPath = path.join(projectDir, filePath);
    return readFile(fullPath, 'utf-8');
  }
  
  /**
   * Waits for the TENEX daemon to be ready to accept commands.
   * 
   * @throws {Error} If daemon fails to start or times out
   * 
   * @private
   */
  private async waitForDaemonReady(): Promise<void> {
    if (!this.daemonHandle) throw new Error('Daemon not started');
    
    const config = getConfig();
    const timeout = config.timeouts.daemonStart;
    const startTime = Date.now();
    
    // Log stderr in background
    (async () => {
      if (!this.daemonHandle) return;
      for await (const line of this.daemonHandle.stderr) {
        this.logger.warn('Daemon stderr', { line });
      }
    })();
    
    // Also monitor daemon output to see what projects it's processing
    let outputMonitor: Promise<void>;
    
    // Wait for daemon ready signal and continue logging after
    let ready = false;
    for await (const line of this.daemonHandle.stdout) {
      this.logger.debug('Daemon output', { line });
      
      if (!ready && (line.includes('TENEX daemon is running') || line.includes('Monitoring events from') || line.includes('Starting TENEX daemon') || line.includes('Whitelisted pubkeys'))) {
        ready = true;
        // Continue reading stdout in background to prevent blocking
        outputMonitor = (async () => {
          if (!this.daemonHandle) return;
          for await (const line of this.daemonHandle.stdout) {
            this.logger.debug('Daemon output', { line });
            
            // Log important daemon events
            if (line.includes('Project started') || 
                line.includes('Agent created') || 
                line.includes('Processing event') ||
                line.includes('Received event') ||
                line.includes('Starting project')) {
              this.logger.info('Daemon event', { line });
            }
          }
        })();
        return;
      }
      
      // Check for timeout
      if (!ready && Date.now() - startTime > timeout) {
        throw new Error(`Daemon failed to start within ${timeout}ms`);
      }
      
      // Check for error indicators
      if (!ready && (line.toLowerCase().includes('error') || line.toLowerCase().includes('failed'))) {
        this.logger.error('Daemon startup error detected', { line });
        throw new Error(`Daemon startup error: ${line}`);
      }
    }
    
    throw new Error('Daemon failed to start - stdout ended unexpectedly');
  }
  
  // Getters for components that Project/Conversation might need
  /**
   * Gets the CLI client instance for interacting with TENEX.
   * @returns The CliClient instance
   */
  get client(): CliClient {
    return this.cliClient;
  }
  
  /**
   * Gets the Nostr monitor instance for tracking events.
   * @returns The NostrMonitor instance
   */
  get monitor(): NostrMonitor {
    return this.nostrMonitor;
  }
}