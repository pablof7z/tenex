import type { Orchestrator } from './Orchestrator';
import { Conversation } from './Conversation';
import type { ConversationOptions, WaitOptions } from './types';
import type { NDKEvent } from '@nostr-dev-kit/ndk';

/**
 * Represents a TENEX project for E2E testing.
 * Provides methods to interact with the project, create conversations,
 * and manage files.
 * 
 * @example
 * ```typescript
 * const project = await orchestrator.createProject({
 *   name: 'my-project',
 *   agents: ['coder']
 * });
 * 
 * const conversation = await project.startConversation({
 *   message: '@coder create a README.md file'
 * });
 * 
 * await project.waitForFile('README.md');
 * const content = await project.readFile('README.md');
 * ```
 */
export class Project {
  /**
   * Creates a new Project instance.
   * 
   * @param orchestrator - The orchestrator instance managing this project
   * @param naddr - The Nostr address (naddr) of the project
   * @param name - The project name
   * @param directory - The project directory path
   * @param event - The NDKProject event
   * 
   * @internal
   */
  constructor(
    private orchestrator: Orchestrator,
    public readonly naddr: string,
    public readonly name: string,
    public readonly directory: string,
    public readonly event: NDKEvent
  ) {}
  
  /**
   * Starts a new conversation within the project.
   * 
   * @param options - Conversation options
   * @param options.message - The initial message to send
   * @param options.title - Optional title for the conversation
   * @returns A Conversation instance for managing the message flow
   * 
   * @example
   * ```typescript
   * const conversation = await project.startConversation({
   *   message: '@architect design a REST API',
   *   title: 'API Design'
   * });
   * ```
   */
  async startConversation(options: ConversationOptions): Promise<Conversation> {
    console.log(`Sending message to project ${this.naddr}: "${options.message}"`);
    const threadId = await this.orchestrator.client.sendMessage(
      this.event,
      options.message
    );
    console.log(`Message sent with thread ID: ${threadId}`);
    
    return new Conversation(
      this.orchestrator,
      this,
      threadId,
      options.title || 'Test Conversation'
    );
  }
  
  /**
   * Waits for a file to exist in the project directory.
   * 
   * @param filePath - Relative path to the file within the project
   * @param options - Wait options
   * @param options.timeout - Maximum time to wait in milliseconds (default: 30000)
   * @param options.content - Optional content that must be present in the file
   * @throws {Error} If file is not found within the timeout period
   * 
   * @example
   * ```typescript
   * // Wait for file to exist
   * await project.waitForFile('src/index.js');
   * 
   * // Wait for file with specific content
   * await project.waitForFile('package.json', {
   *   content: '"name": "my-project"',
   *   timeout: 60000
   * });
   * ```
   */
  async waitForFile(filePath: string, options?: WaitOptions): Promise<void> {
    return this.orchestrator.waitForFile(this.directory, filePath, options);
  }
  
  /**
   * Reads the contents of a file from the project directory.
   * 
   * @param filePath - Relative path to the file within the project
   * @returns The file contents as a string
   * @throws {Error} If the file does not exist
   * 
   * @example
   * ```typescript
   * const packageJson = await project.readFile('package.json');
   * const pkg = JSON.parse(packageJson);
   * console.log(pkg.dependencies);
   * ```
   */
  async readFile(filePath: string): Promise<string> {
    return this.orchestrator.readFile(this.directory, filePath);
  }
  
  /**
   * Checks if a file exists in the project directory.
   * 
   * @param filePath - Relative path to the file within the project
   * @returns True if the file exists, false otherwise
   * 
   * @example
   * ```typescript
   * if (await project.fileExists('README.md')) {
   *   console.log('README exists');
   * }
   * ```
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await this.readFile(filePath);
      return true;
    } catch {
      return false;
    }
  }
}