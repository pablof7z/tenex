import { Conversation } from '../Conversation';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { getConfig } from '../config';
import { TestError } from '../types';

/**
 * Asserts that a conversation reply contains the expected text.
 * 
 * @param conversation - The conversation to check
 * @param expected - The text that must be present in the reply
 * @param options - Assertion options
 * @param options.timeout - Maximum time to wait for reply (default: 30000ms)
 * @param options.caseSensitive - Whether to perform case-sensitive matching (default: false)
 * @returns The reply event that contains the expected text
 * @throws {TestError} If no reply containing the text is received within timeout
 * 
 * @example
 * ```typescript
 * const reply = await assertReplyContains(conversation, 'task completed');
 * console.log('Agent responded:', reply.content);
 * ```
 */
export async function assertReplyContains(
  conversation: Conversation,
  expected: string,
  options: { timeout?: number; caseSensitive?: boolean } = {}
): Promise<NDKEvent> {
  const config = getConfig();
  const { timeout = config.timeouts.conversationReply, caseSensitive = false } = options;
  
  const reply = await conversation.waitForReply({
    timeout,
    validate: (event) => {
      const content = caseSensitive ? event.content : event.content.toLowerCase();
      const searchTerm = caseSensitive ? expected : expected.toLowerCase();
      return content.includes(searchTerm);
    }
  });
  
  if (!reply) {
    throw new TestError(
      `No reply containing "${expected}" received within ${timeout}ms`,
      {
        step: 'assertReplyContains'
      }
    );
  }
  
  return reply;
}

/**
 * Asserts that a conversation reply matches the given pattern.
 * 
 * @param conversation - The conversation to check
 * @param pattern - Regular expression pattern to match
 * @param options - Assertion options
 * @param options.timeout - Maximum time to wait for reply (default: 30000ms)
 * @returns The reply event that matches the pattern
 * @throws {TestError} If no reply matching the pattern is received within timeout
 * 
 * @example
 * ```typescript
 * const reply = await assertReplyMatches(
 *   conversation,
 *   /created \d+ files?/i
 * );
 * ```
 */
export async function assertReplyMatches(
  conversation: Conversation,
  pattern: RegExp,
  options: { timeout?: number } = {}
): Promise<NDKEvent> {
  const config = getConfig();
  const { timeout = config.timeouts.conversationReply } = options;
  
  const reply = await conversation.waitForReply({
    timeout,
    validate: (event) => pattern.test(event.content)
  });
  
  if (!reply) {
    throw new TestError(
      `No reply matching pattern ${pattern} received within ${timeout}ms`,
      {
        step: 'assertReplyMatches'
      }
    );
  }
  
  return reply;
}

/**
 * Asserts that a conversation reaches a completion state.
 * Checks for common completion indicators in agent responses.
 * 
 * @param conversation - The conversation to check
 * @param options - Completion options
 * @param options.timeout - Maximum time to wait (default: 60000ms)
 * @param options.indicators - Completion indicators to look for
 * @param options.requiredIndicators - Number of indicators required (default: 1)
 * @throws {TestError} If conversation doesn't complete within timeout
 * 
 * @example
 * ```typescript
 * await assertConversationCompletes(conversation);
 * 
 * // With custom indicators
 * await assertConversationCompletes(conversation, {
 *   indicators: ['all done', 'task complete'],
 *   requiredIndicators: 2
 * });
 * ```
 */
export async function assertConversationCompletes(
  conversation: Conversation,
  options: { 
    timeout?: number; 
    indicators?: string[];
    requiredIndicators?: number;
  } = {}
): Promise<void> {
  const config = getConfig();
  const { 
    timeout = config.timeouts.conversationCompletion, 
    indicators = config.conversation.completionIndicators,
    requiredIndicators = 1
  } = options;
  
  const reply = await conversation.waitForReply({
    timeout,
    validate: (event) => {
      const content = event.content.toLowerCase();
      const matches = indicators.filter(ind => content.includes(ind.toLowerCase()));
      return matches.length >= requiredIndicators;
    }
  });
  
  if (!reply) {
    throw new TestError(
      `Conversation did not complete within ${timeout}ms. Expected indicators: ${indicators.join(', ')}`,
      {
        step: 'assertConversationCompletes'
      }
    );
  }
}

/**
 * Asserts the number of messages in a conversation.
 * 
 * @param conversation - The conversation to check
 * @param expectedCount - The expected number of messages
 * @param comparison - How to compare: 'exactly', 'at-least', or 'at-most'
 * @throws {TestError} If the message count doesn't match expectations
 * 
 * @example
 * ```typescript
 * assertMessageCount(conversation, 3, 'exactly');
 * assertMessageCount(conversation, 2, 'at-least');
 * assertMessageCount(conversation, 10, 'at-most');
 * ```
 */
export function assertMessageCount(
  conversation: Conversation,
  expectedCount: number,
  comparison: 'exactly' | 'at-least' | 'at-most' = 'exactly'
): void {
  const messages = conversation.getMessages();
  const actualCount = messages.length;
  
  switch (comparison) {
    case 'exactly':
      if (actualCount !== expectedCount) {
        throw new TestError(
          `Expected exactly ${expectedCount} messages but got ${actualCount}`,
          {
            step: 'assertMessageCount'
          }
        );
      }
      break;
    case 'at-least':
      if (actualCount < expectedCount) {
        throw new TestError(
          `Expected at least ${expectedCount} messages but got ${actualCount}`,
          {
            step: 'assertMessageCount'
          }
        );
      }
      break;
    case 'at-most':
      if (actualCount > expectedCount) {
        throw new TestError(
          `Expected at most ${expectedCount} messages but got ${actualCount}`,
          {
            step: 'assertMessageCount'
          }
        );
      }
      break;
  }
}

/**
 * Asserts that a specific agent replies in the conversation.
 * 
 * @param conversation - The conversation to check
 * @param agentName - The name of the agent expected to reply
 * @param options - Assertion options
 * @param options.timeout - Maximum time to wait for agent reply (default: 30000ms)
 * @returns The reply event from the specified agent
 * @throws {TestError} If the agent doesn't reply within timeout
 * 
 * @example
 * ```typescript
 * const reply = await assertReplyFromAgent(conversation, 'coder');
 * console.log('Coder agent said:', reply.content);
 * ```
 */
export async function assertReplyFromAgent(
  conversation: Conversation,
  agentName: string,
  options: { timeout?: number } = {}
): Promise<NDKEvent> {
  const config = getConfig();
  const { timeout = config.timeouts.conversationReply } = options;
  
  const reply = await conversation.waitForReply({
    timeout,
    validate: (event) => {
      // Check if the message is from the specified agent
      // This might need adjustment based on how agents identify themselves
      const agentTag = event.tags.find(t => t[0] === 'agent');
      if (agentTag && agentTag[1] === agentName) {
        return true;
      }
      
      // Fallback: check if agent name is mentioned in content
      return event.content.toLowerCase().includes(`@${agentName}`) ||
             event.content.toLowerCase().includes(`${agentName} agent`);
    }
  });
  
  if (!reply) {
    throw new TestError(
      `No reply from agent "${agentName}" received within ${timeout}ms`,
      {
        step: 'assertReplyFromAgent'
      }
    );
  }
  
  return reply;
}