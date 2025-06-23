import NDK, { type NDKEvent, type NDKFilter, type NDKSubscription } from '@nostr-dev-kit/ndk';
import { getConfig } from './config';
import { NostrEventKinds } from './constants';
import { retry } from './utils/Retry';
import { Logger } from './utils/Logger';

export class NostrMonitor {
  private ndk: NDK;
  private subscriptions: Map<string, NDKSubscription> = new Map();
  private logger: Logger;
  
  constructor(relays: string[]) {
    this.ndk = new NDK({
      explicitRelayUrls: relays,
      autoConnectUserRelays: false
    });
    this.logger = new Logger({ component: 'NostrMonitor' });
  }
  
  async connect(): Promise<void> {
    await retry(
      async () => {
        this.logger.debug('Attempting to connect to Nostr relays');
        await this.ndk.connect();
        this.logger.info('Successfully connected to Nostr relays');
      },
      {
        maxAttempts: 3,
        initialDelay: 2000,
        logger: this.logger,
        isRetryable: (error) => {
          // Connection errors are always retryable
          return error.message.toLowerCase().includes('connect') ||
                 error.message.toLowerCase().includes('network');
        }
      }
    );
  }
  
  async disconnect(): Promise<void> {
    try {
      for (const sub of this.subscriptions.values()) {
        sub.stop();
      }
      this.subscriptions.clear();
      // NDK doesn't have a destroy method, but we can disconnect from all relays
      for (const relay of this.ndk.pool.relays.values()) {
        relay.disconnect();
      }
    } catch (error: any) {
      // Log but don't throw - cleanup should not fail
      this.logger.warn('Error during Nostr disconnect', { error: error.message });
    }
  }
  
  async waitForEvent(
    filter: NDKFilter,
    options: { timeout?: number; validate?: (event: NDKEvent) => boolean } = {}
  ): Promise<NDKEvent> {
    const config = getConfig();
    const { timeout = config.timeouts.eventWait, validate } = options;
    
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
  
  async waitForProjectEvent(
    projectNaddr: string,
    additionalFilter: Partial<NDKFilter>,
    options: { timeout?: number; validate?: (event: NDKEvent) => boolean } = {}
  ): Promise<NDKEvent> {
    // Fetch the project event first to get its proper filter
    const projectEvent = await this.ndk.fetchEvent(projectNaddr);
    
    if (!projectEvent) {
      throw new Error(`Failed to fetch project event for naddr: ${projectNaddr}`);
    }
    
    // Combine the project's filter with additional filters
    const filter: NDKFilter = {
      ...projectEvent.filter(),
      ...additionalFilter
    };
    
    return this.waitForEvent(filter, options);
  }
  
  async subscribeToProject(projectNaddr: string): Promise<AsyncIterableIterator<NDKEvent>> {
    // Fetch the project event first to get its proper filter
    const projectEvent = await this.ndk.fetchEvent(projectNaddr);
    
    if (!projectEvent) {
      throw new Error(`Failed to fetch project event for naddr: ${projectNaddr}`);
    }
    
    // Use the project's filter and add the kinds we want to monitor
    const filter: NDKFilter = {
      ...projectEvent.filter(),
      kinds: [NostrEventKinds.NOTE, NostrEventKinds.BUILD_STATUS, NostrEventKinds.BUILD_RESULT] // messages, status updates
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
            resolveNext = (result) => resolve(result.value as NDKEvent);
          });
        }
      }
    } finally {
      sub.stop();
    }
  }
}