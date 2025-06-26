import { Orchestrator } from './Orchestrator';
import { LLMConfig } from './types';

/**
 * Configuration options for test scenarios.
 */
export interface ScenarioOptions {
  /** Custom Nostr relay URLs */
  relays?: string[];
  /** LLM provider configuration */
  llmConfig?: LLMConfig;
  /** Enable debug logging */
  debug?: boolean;
  /** Path to write debug logs */
  logFile?: string;
}

/**
 * Result of a scenario execution.
 */
export interface ScenarioResult {
  /** Scenario name */
  name: string;
  /** Whether the scenario passed */
  success: boolean;
  /** Execution duration in milliseconds */
  duration: number;
  /** Error if the scenario failed */
  error: Error | null;
}

/**
 * Base class for E2E test scenarios.
 * Provides lifecycle management (setup/teardown) and error handling.
 * 
 * @example
 * ```typescript
 * export class MyScenario extends BaseScenario {
 *   name = 'My Test Scenario';
 *   description = 'Tests a specific feature';
 *   
 *   async run(): Promise<void> {
 *     const project = await this.orchestrator.createProject({
 *       name: 'test-project',
 *       agents: ['coder']
 *     });
 *     
 *     const conversation = await project.startConversation({
 *       message: 'Create a hello world function'
 *     });
 *     
 *     await project.waitForFile('hello.js');
 *   }
 * }
 * ```
 */
export abstract class BaseScenario {
  /** Display name of the scenario */
  abstract name: string;
  /** Brief description of what the scenario tests */
  abstract description: string;
  
  /** The orchestrator instance for this scenario */
  protected orchestrator: Orchestrator;
  
  /**
   * Creates a new scenario instance.
   * 
   * @param options - Scenario configuration options
   */
  constructor(options: ScenarioOptions = {}) {
    this.orchestrator = new Orchestrator({
      relays: options.relays,
      llmConfig: options.llmConfig,
      debug: options.debug,
      logFile: options.logFile
    });
  }
  
  /**
   * Executes the complete scenario lifecycle.
   * Handles setup, run, and teardown phases with proper error handling.
   * 
   * @returns The scenario execution result
   * 
   * @example
   * ```typescript
   * const scenario = new MyScenario();
   * const result = await scenario.execute();
   * 
   * if (result.success) {
   *   console.log(`✅ ${result.name} passed in ${result.duration}ms`);
   * } else {
   *   console.error(`❌ ${result.name} failed:`, result.error);
   * }
   * ```
   */
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
      result.error = error as Error;
      throw error;
    } finally {
      result.duration = Date.now() - startTime;
      try {
        await this.orchestrator.teardown();
      } catch (teardownError: any) {
        // Log teardown errors but don't mask the original error
        console.error(`Teardown error in ${this.name}:`, teardownError.message);
      }
    }
    
    return result;
  }
  
  /**
   * Implements the test scenario logic.
   * Override this method in your scenario class.
   * 
   * @remarks
   * This method is called after setup() and before teardown().
   * Any errors thrown will be caught and reported in the result.
   */
  abstract run(): Promise<void>;
}