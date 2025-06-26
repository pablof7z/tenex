import { NDKKind, type NDKEvent } from '@nostr-dev-kit/ndk';
import type { Orchestrator } from './Orchestrator';
import type { Project } from './Project';
import type { ReplyOptions, CompletionOptions } from './types';
import { getConfig } from './config';
import { NostrEventKinds } from './constants';
import { EventEmitter } from 'events';

/**
 * Represents a conversation thread within a TENEX project.
 * Manages message flow and provides methods to wait for agent responses.
 * 
 * @example
 * ```typescript
 * const conversation = await project.startConversation({
 *   message: '@coder implement a fibonacci function'
 * });
 * 
 * // Wait for agent to reply
 * const reply = await conversation.waitForReply();
 * console.log(reply.content);
 * 
 * // Send follow-up message
 * await conversation.sendMessage('Add tests for the function');
 * 
 * // Wait for task completion
 * await conversation.waitForCompletion();
 * ```
 */
export class Conversation extends EventEmitter {
  private messages: NDKEvent[] = [];
  private lastEvent?: NDKEvent;
  
  /**
   * Creates a new Conversation instance.
   * 
   * @param orchestrator - The orchestrator instance managing this conversation
   * @param project - The project this conversation belongs to
   * @param threadId - The Nostr event ID of the conversation thread
   * @param _title - The conversation title (for future use)
   * 
   * @internal
   */
  constructor(
    private orchestrator: Orchestrator,
    private project: Project,
    private threadId: string,
    _title: string
  ) {
    super();
    // Title is available for future use
    
    // Monitor for phase transition events
    this.monitorPhaseTransitions();
  }
  
  /**
   * Monitor for phase transition events in the conversation
   */
  private monitorPhaseTransitions(): void {
    // This is a placeholder for monitoring phase transitions
    // In a real implementation, we would subscribe to specific event types
  }
  
  /**
   * Sends a message in the conversation.
   * 
   * @param content - The message content to send
   * 
   * @example
   * ```typescript
   * await conversation.sendMessage('Please add error handling');
   * ```
   */
  async sendMessage(content: string): Promise<void> {
    if (this.lastEvent) {
      // Reply to the last event in the conversation
      await this.orchestrator.createReply(this.lastEvent, this.project.event, content);
    } else {
      // This is the first message, create a new conversation thread
      await this.orchestrator.client.sendMessage(
        this.project.event,
        content
      );
    }
  }
  
  /**
   * Waits for a reply in the conversation.
   * 
   * @param options - Reply wait options
   * @param options.timeout - Maximum time to wait in milliseconds (default: 30000)
   * @param options.validate - Optional validation function to filter replies
   * @param options.afterMessage - Wait for reply after a specific message content
   * @returns The reply event
   * @throws {Error} If no reply is received within the timeout
   * 
   * @example
   * ```typescript
   * // Wait for any reply
   * const reply = await conversation.waitForReply();
   * 
   * // Wait for reply containing specific text
   * const reply = await conversation.waitForReply({
   *   validate: (event) => event.content.includes('completed'),
   *   timeout: 60000
   * });
   * 
   * // Wait for reply after a specific message
   * const reply = await conversation.waitForReply({
   *   afterMessage: 'What features should it have?'
   * });
   * ```
   */
  async waitForReply(options: ReplyOptions & { afterMessage?: string } = {}): Promise<NDKEvent> {
    const { afterMessage, ...replyOptions } = options;
    
    // If waiting for reply after specific message, track message index
    let afterMessageIndex = -1;
    if (afterMessage) {
      afterMessageIndex = this.messages.findIndex(msg => 
        msg.content.includes(afterMessage)
      );
    }
    
    const event = await this.orchestrator.monitor.waitForProjectEvent(
      this.project.event,
      {
        kinds: [NDKKind.GenericReply],
      },
      {
        ...replyOptions,
        validate: (event) => {
          // Skip messages before the target message
          if (afterMessageIndex >= 0 && this.messages.length <= afterMessageIndex + 1) {
            return false;
          }
          
          // Apply custom validation if provided
          if (replyOptions.validate) {
            return replyOptions.validate(event);
          }
          
          return true;
        }
      }
    );
    
    this.messages.push(event);
    this.lastEvent = event; // Track the last event for replies
    return event;
  }
  
  /**
   * Waits for the conversation to reach a completion state.
   * Looks for common completion indicators in agent responses.
   * 
   * @param options - Completion wait options
   * @param options.timeout - Maximum time to wait in milliseconds (default: 60000)
   * @param options.indicators - Custom completion indicators (default: ['done', 'completed', 'finished', 'created', 'implemented'])
   * @throws {Error} If no completion indicator is found within the timeout
   * 
   * @example
   * ```typescript
   * // Wait with default indicators
   * await conversation.waitForCompletion();
   * 
   * // Wait with custom indicators
   * await conversation.waitForCompletion({
   *   indicators: ['task complete', 'all done'],
   *   timeout: 120000
   * });
   * ```
   */
  async waitForCompletion(options: CompletionOptions = {}): Promise<void> {
    const config = getConfig();
    const { timeout = config.timeouts.conversationCompletion, indicators = config.conversation.completionIndicators } = options;
    
    await this.waitForReply({
      timeout,
      validate: (event) => {
        const content = event.content.toLowerCase();
        return indicators.some(ind => content.includes(ind.toLowerCase()));
      }
    });
  }
  
  /**
   * Gets all messages in this conversation.
   * 
   * @returns A copy of the messages array
   * 
   * @example
   * ```typescript
   * const messages = conversation.getMessages();
   * console.log(`Total messages: ${messages.length}`);
   * messages.forEach(msg => console.log(msg.content));
   * ```
   */
  getMessages(): NDKEvent[] {
    return [...this.messages];
  }
}