import { describe, test, expect, beforeEach, mock } from 'bun:test';
import {
  assertReplyContains,
  assertReplyMatches,
  assertConversationCompletes,
  assertMessageCount,
  assertReplyFromAgent
} from '../../src/assertions/ConversationAssertions';
import { Conversation } from '../../src/Conversation';
import { NDKEvent } from '@nostr-dev-kit/ndk';

describe('ConversationAssertions', () => {
  let mockConversation: Conversation;
  let mockEvent: NDKEvent;
  
  beforeEach(() => {
    mockEvent = {
      content: 'Test message content',
      tags: [],
      kind: 1
    } as any;
    
    mockConversation = {
      waitForReply: mock(async () => mockEvent),
      getMessages: mock(() => [mockEvent])
    } as any;
  });
  
  describe('assertReplyContains', () => {
    test('should pass when reply contains expected text', async () => {
      mockEvent.content = 'Hello World';
      
      const result = await assertReplyContains(mockConversation, 'Hello');
      expect(result).toBe(mockEvent);
    });
    
    test('should handle case-insensitive search by default', async () => {
      mockEvent.content = 'HELLO WORLD';
      
      const result = await assertReplyContains(mockConversation, 'hello');
      expect(result).toBe(mockEvent);
    });
    
    test('should handle case-sensitive search when specified', async () => {
      mockEvent.content = 'Hello World';
      mockConversation.waitForReply = mock(async ({ validate }) => {
        if (validate && validate(mockEvent)) {
          return mockEvent;
        }
        return null;
      });
      
      await expect(
        assertReplyContains(mockConversation, 'HELLO', { caseSensitive: true })
      ).rejects.toThrow('No reply containing "HELLO" received');
    });
    
    test('should respect custom timeout', async () => {
      mockConversation.waitForReply = mock(async (options) => {
        expect(options.timeout).toBe(5000);
        return mockEvent;
      });
      
      await assertReplyContains(mockConversation, 'Test', { timeout: 5000 });
    });
  });
  
  describe('assertReplyMatches', () => {
    test('should pass when reply matches pattern', async () => {
      mockEvent.content = 'Error: Something went wrong';
      
      const result = await assertReplyMatches(mockConversation, /Error:.*wrong/);
      expect(result).toBe(mockEvent);
    });
    
    test('should throw when reply does not match pattern', async () => {
      mockEvent.content = 'Success: Everything is fine';
      mockConversation.waitForReply = mock(async ({ validate }) => {
        if (validate && !validate(mockEvent)) {
          return null;
        }
        return mockEvent;
      });
      
      await expect(
        assertReplyMatches(mockConversation, /Error:.*/)
      ).rejects.toThrow(/No reply matching pattern/);
    });
  });
  
  describe('assertConversationCompletes', () => {
    test('should pass when completion indicator found', async () => {
      mockEvent.content = 'Task completed successfully';
      
      await expect(
        assertConversationCompletes(mockConversation)
      ).resolves.toBeUndefined();
    });
    
    test('should check for default indicators', async () => {
      mockEvent.content = 'All done!';
      
      await expect(
        assertConversationCompletes(mockConversation)
      ).resolves.toBeUndefined();
    });
    
    test('should use custom indicators', async () => {
      mockEvent.content = 'Task terminated';
      
      await expect(
        assertConversationCompletes(mockConversation, {
          indicators: ['terminated', 'ended']
        })
      ).resolves.toBeUndefined();
    });
    
    test('should require minimum number of indicators', async () => {
      mockEvent.content = 'Task is done and completed';
      
      let validateCalled = false;
      mockConversation.waitForReply = mock(async ({ validate }) => {
        if (validate) {
          validateCalled = true;
          const result = validate(mockEvent);
          expect(result).toBe(true); // Should pass since it has 2 indicators
        }
        return mockEvent;
      });
      
      await assertConversationCompletes(mockConversation, {
        requiredIndicators: 2
      });
      
      expect(validateCalled).toBe(true);
    });
  });
  
  describe('assertMessageCount', () => {
    test('should pass for exact count', () => {
      mockConversation.getMessages = mock(() => [mockEvent, mockEvent, mockEvent]);
      
      expect(() => 
        assertMessageCount(mockConversation, 3, 'exactly')
      ).not.toThrow();
    });
    
    test('should throw for wrong exact count', () => {
      mockConversation.getMessages = mock(() => [mockEvent, mockEvent]);
      
      expect(() => 
        assertMessageCount(mockConversation, 3, 'exactly')
      ).toThrow('Expected exactly 3 messages but got 2');
    });
    
    test('should pass for at-least count', () => {
      mockConversation.getMessages = mock(() => [mockEvent, mockEvent, mockEvent]);
      
      expect(() => 
        assertMessageCount(mockConversation, 2, 'at-least')
      ).not.toThrow();
    });
    
    test('should throw for insufficient at-least count', () => {
      mockConversation.getMessages = mock(() => [mockEvent]);
      
      expect(() => 
        assertMessageCount(mockConversation, 2, 'at-least')
      ).toThrow('Expected at least 2 messages but got 1');
    });
    
    test('should pass for at-most count', () => {
      mockConversation.getMessages = mock(() => [mockEvent, mockEvent]);
      
      expect(() => 
        assertMessageCount(mockConversation, 3, 'at-most')
      ).not.toThrow();
    });
    
    test('should throw for excessive at-most count', () => {
      mockConversation.getMessages = mock(() => [mockEvent, mockEvent, mockEvent, mockEvent]);
      
      expect(() => 
        assertMessageCount(mockConversation, 3, 'at-most')
      ).toThrow('Expected at most 3 messages but got 4');
    });
  });
  
  describe('assertReplyFromAgent', () => {
    test('should pass when agent tag matches', async () => {
      mockEvent.tags = [['agent', 'coder']];
      
      const result = await assertReplyFromAgent(mockConversation, 'coder');
      expect(result).toBe(mockEvent);
    });
    
    test('should pass when agent mentioned in content', async () => {
      mockEvent.content = 'Message from @architect about the design';
      mockEvent.tags = [];
      
      const result = await assertReplyFromAgent(mockConversation, 'architect');
      expect(result).toBe(mockEvent);
    });
    
    test('should pass when agent role mentioned', async () => {
      mockEvent.content = 'The coder agent has completed the task';
      mockEvent.tags = [];
      
      const result = await assertReplyFromAgent(mockConversation, 'coder');
      expect(result).toBe(mockEvent);
    });
    
    test('should throw when agent not found', async () => {
      mockEvent.content = 'Generic message';
      mockEvent.tags = [];
      mockConversation.waitForReply = mock(async ({ validate }) => {
        if (validate && !validate(mockEvent)) {
          return null;
        }
        return mockEvent;
      });
      
      await expect(
        assertReplyFromAgent(mockConversation, 'designer')
      ).rejects.toThrow('No reply from agent "designer" received');
    });
  });
});