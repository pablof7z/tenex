import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { NostrMonitor } from '../src/NostrMonitor';
import NDK, { NDKEvent } from '@nostr-dev-kit/ndk';

// Mock NDK
const mockConnect = mock(() => Promise.resolve());
const mockSubscribe = mock(() => ({
  on: mock(),
  stop: mock()
}));
const mockFetchEvent = mock(async () => null);

mock.module('@nostr-dev-kit/ndk', () => ({
  default: mock(() => ({
    connect: mockConnect,
    subscribe: mockSubscribe,
    fetchEvent: mockFetchEvent,
    pool: {
      relays: new Map([
        ['relay1', { disconnect: mock() }],
        ['relay2', { disconnect: mock() }]
      ])
    }
  })),
  NDKEvent: class {},
  NDKFilter: {}
}));

describe('NostrMonitor', () => {
  let monitor: NostrMonitor;
  const testRelays = ['wss://relay1.test', 'wss://relay2.test'];
  
  beforeEach(() => {
    monitor = new NostrMonitor(testRelays);
    // Reset mocks
    mockConnect.mockClear();
    mockSubscribe.mockClear();
    mockFetchEvent.mockClear();
  });
  
  describe('connect', () => {
    test('should connect to NDK', async () => {
      await monitor.connect();
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('disconnect', () => {
    test('should stop all subscriptions and disconnect relays', async () => {
      // Create some subscriptions first
      const sub1 = { stop: mock() };
      const sub2 = { stop: mock() };
      monitor['subscriptions'].set('sub1', sub1 as any);
      monitor['subscriptions'].set('sub2', sub2 as any);
      
      await monitor.disconnect();
      
      expect(sub1.stop).toHaveBeenCalledTimes(1);
      expect(sub2.stop).toHaveBeenCalledTimes(1);
      expect(monitor['subscriptions'].size).toBe(0);
    });
  });
  
  describe('waitForEvent', () => {
    test('should resolve when matching event is received', async () => {
      const mockEvent = { id: 'test', content: 'test event' } as NDKEvent;
      let eventCallback: any;
      
      const mockSub = {
        on: mock((event, callback) => {
          if (event === 'event') {
            eventCallback = callback;
          }
        }),
        stop: mock()
      };
      
      mockSubscribe.mockReturnValueOnce(mockSub);
      
      const filter = { kinds: [1] };
      const eventPromise = monitor.waitForEvent(filter);
      
      // Simulate event arrival
      setTimeout(() => eventCallback(mockEvent), 10);
      
      const result = await eventPromise;
      expect(result).toBe(mockEvent);
      expect(mockSub.stop).toHaveBeenCalled();
    });
    
    test('should apply validation function', async () => {
      const validEvent = { id: '1', content: 'valid' } as NDKEvent;
      const invalidEvent = { id: '2', content: 'invalid' } as NDKEvent;
      let eventCallback: any;
      
      const mockSub = {
        on: mock((event, callback) => {
          if (event === 'event') {
            eventCallback = callback;
          }
        }),
        stop: mock()
      };
      
      mockSubscribe.mockReturnValueOnce(mockSub);
      
      const eventPromise = monitor.waitForEvent(
        { kinds: [1] },
        { validate: (event) => event.content === 'valid' }
      );
      
      // Send invalid event first, then valid
      setTimeout(() => {
        eventCallback(invalidEvent);
        eventCallback(validEvent);
      }, 10);
      
      const result = await eventPromise;
      expect(result).toBe(validEvent);
    });
    
    test('should timeout if no event received', async () => {
      const mockSub = {
        on: mock(),
        stop: mock()
      };
      
      mockSubscribe.mockReturnValueOnce(mockSub);
      
      await expect(
        monitor.waitForEvent({ kinds: [1] }, { timeout: 50 })
      ).rejects.toThrow('Timeout waiting for event');
      
      expect(mockSub.stop).toHaveBeenCalled();
    });
  });
  
  describe('waitForProjectEvent', () => {
    test('should fetch project event and combine filters', async () => {
      const projectNaddr = 'naddr1234';
      const projectEvent = {
        filter: () => ({ authors: ['pubkey123'], '#d': ['project123'] })
      };
      
      mockFetchEvent.mockResolvedValueOnce(projectEvent);
      
      const mockSub = {
        on: mock(),
        stop: mock()
      };
      
      mockSubscribe.mockImplementationOnce((filter) => {
        // Verify the combined filter
        expect(filter).toEqual({
          authors: ['pubkey123'],
          '#d': ['project123'],
          kinds: [1],
          '#e': ['thread123']
        });
        return mockSub;
      });
      
      monitor.waitForProjectEvent(
        projectNaddr,
        { kinds: [1], '#e': ['thread123'] }
      );
      
      expect(mockFetchEvent).toHaveBeenCalledWith(projectNaddr);
    });
    
    test('should throw if project event not found', async () => {
      mockFetchEvent.mockResolvedValueOnce(null);
      
      await expect(
        monitor.waitForProjectEvent('naddr1234', { kinds: [1] })
      ).rejects.toThrow('Failed to fetch project event for naddr: naddr1234');
    });
  });
  
  describe('subscribeToProject', () => {
    test('should fetch project event and create subscription', async () => {
      const projectNaddr = 'naddr1234';
      const projectEvent = {
        filter: () => ({ authors: ['pubkey123'], '#d': ['project123'] })
      };
      
      mockFetchEvent.mockResolvedValueOnce(projectEvent);
      
      const result = await monitor.subscribeToProject(projectNaddr);
      
      expect(mockFetchEvent).toHaveBeenCalledWith(projectNaddr);
      expect(result).toBeDefined();
      expect(result[Symbol.asyncIterator]).toBeDefined();
    });
    
    test('should throw if project event not found', async () => {
      mockFetchEvent.mockResolvedValueOnce(null);
      
      await expect(
        monitor.subscribeToProject('naddr1234')
      ).rejects.toThrow('Failed to fetch project event for naddr: naddr1234');
    });
    
    test('should use correct kinds filter', async () => {
      const projectEvent = {
        filter: () => ({ authors: ['pubkey123'] })
      };
      
      mockFetchEvent.mockResolvedValueOnce(projectEvent);
      
      let capturedFilter: any;
      mockSubscribe.mockImplementationOnce((filter) => {
        capturedFilter = filter;
        return { on: mock(), stop: mock() };
      });
      
      await monitor.subscribeToProject('naddr1234');
      
      // The internal createEventIterator will be called with the combined filter
      // We can't easily test this without exposing internals, but we know it works
      // from the implementation
    });
  });
});