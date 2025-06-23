import { describe, test, expect, beforeEach } from 'bun:test';
import { Conversation } from '../src/Conversation';
import type { Orchestrator } from '../src/Orchestrator';
import type { Project } from '../src/Project';
import type { NDKEvent } from '@nostr-dev-kit/ndk';

// Create mock NDKEvent
function createMockEvent(content: string, tags: string[][] = []): NDKEvent {
  return {
    content,
    tags,
    id: `event-${Date.now()}`,
    pubkey: 'mock-pubkey',
    created_at: Math.floor(Date.now() / 1000),
    kind: 1,
    sig: 'mock-signature'
  } as NDKEvent;
}

describe('Conversation', () => {
  let conversation: Conversation;
  let mockOrchestrator: Orchestrator;
  let mockProject: Project;
  const threadId = 'thread123';
  
  beforeEach(() => {
    // Create mock orchestrator
    mockOrchestrator = {
      client: {
        sendMessage: async (naddr: string, message: string) => {
          mockOrchestrator['lastMessage'] = { naddr, message };
          return threadId;
        }
      },
      monitor: {
        waitForProjectEvent: async (naddr: string, filter: any, options?: any) => {
          mockOrchestrator['waitCall'] = { naddr, filter, options };
          
          // Simulate different responses based on filter
          if (options?.validate) {
            // For completion test
            const mockEvent = createMockEvent('Task completed successfully');
            if (options.validate(mockEvent)) {
              return mockEvent;
            }
          }
          
          return createMockEvent('Reply message', [['e', threadId]]);
        }
      }
    } as any;
    
    // Create mock project
    mockProject = {
      naddr: 'naddr456',
      name: 'test-project',
      directory: '/tmp/test-project'
    } as Project;
    
    conversation = new Conversation(
      mockOrchestrator,
      mockProject,
      threadId,
      'Test Conversation'
    );
  });
  
  describe('constructor', () => {
    test('should initialize with empty messages', () => {
      expect(conversation.getMessages()).toEqual([]);
    });
  });
  
  describe('sendMessage', () => {
    test('should send message through orchestrator client', async () => {
      await conversation.sendMessage('Hello from conversation');
      
      expect(mockOrchestrator['lastMessage']).toEqual({
        naddr: 'naddr456',
        message: 'Hello from conversation'
      });
    });
  });
  
  describe('waitForReply', () => {
    test('should wait for event with correct filter', async () => {
      const reply = await conversation.waitForReply();
      
      expect(mockOrchestrator['waitCall']).toEqual({
        naddr: 'naddr456',
        filter: {
          kinds: [1],
          '#e': ['thread123']
        },
        options: {}
      });
      
      expect(reply.content).toBe('Reply message');
    });
    
    test('should pass options to monitor', async () => {
      const options = { 
        timeout: 5000,
        validate: (event: NDKEvent) => event.content.includes('specific')
      };
      
      await conversation.waitForReply(options);
      
      expect(mockOrchestrator['waitCall'].options).toEqual(options);
    });
    
    test('should store messages in conversation', async () => {
      const reply1 = await conversation.waitForReply();
      const reply2 = await conversation.waitForReply();
      
      const messages = conversation.getMessages();
      expect(messages.length).toBe(2);
      expect(messages[0]).toBe(reply1);
      expect(messages[1]).toBe(reply2);
    });
  });
  
  describe('waitForCompletion', () => {
    test('should wait for completion indicators', async () => {
      await conversation.waitForCompletion();
      
      const { options } = mockOrchestrator['waitCall'];
      expect(options.timeout).toBe(60000); // Default timeout
      expect(options.validate).toBeDefined();
      
      // Test the validate function
      const validate = options.validate;
      expect(validate(createMockEvent('Task is done'))).toBe(true);
      expect(validate(createMockEvent('Completed successfully'))).toBe(true);
      expect(validate(createMockEvent('Finished processing'))).toBe(true);
      expect(validate(createMockEvent('Still working...'))).toBe(false);
    });
    
    test('should use custom completion indicators', async () => {
      await conversation.waitForCompletion({
        indicators: ['Ready', 'Success']
      });
      
      const validate = mockOrchestrator['waitCall'].options.validate;
      expect(validate(createMockEvent('Task ready'))).toBe(true);
      expect(validate(createMockEvent('Operation success'))).toBe(true);
      expect(validate(createMockEvent('Done'))).toBe(false); // Not in custom list
    });
    
    test('should use custom timeout', async () => {
      await conversation.waitForCompletion({ timeout: 30000 });
      
      expect(mockOrchestrator['waitCall'].options.timeout).toBe(30000);
    });
    
    test('should be case insensitive', async () => {
      await conversation.waitForCompletion();
      
      const validate = mockOrchestrator['waitCall'].options.validate;
      expect(validate(createMockEvent('DONE'))).toBe(true);
      expect(validate(createMockEvent('completed'))).toBe(true);
      expect(validate(createMockEvent('FiNiShEd'))).toBe(true);
    });
  });
  
  describe('getMessages', () => {
    test('should return copy of messages array', async () => {
      await conversation.waitForReply();
      
      const messages1 = conversation.getMessages();
      const messages2 = conversation.getMessages();
      
      expect(messages1).not.toBe(messages2); // Different arrays
      expect(messages1).toEqual(messages2); // Same content
    });
    
    test('should not allow external modification', async () => {
      await conversation.waitForReply();
      
      const messages = conversation.getMessages();
      messages.push(createMockEvent('External message'));
      
      // Original messages should be unchanged
      expect(conversation.getMessages().length).toBe(1);
    });
  });
});