import NDK, { type NDKEvent, type NDKFilter, type NDKSubscription } from '@nostr-dev-kit/ndk';
import { getConfig } from './config';
import { NostrEventKinds } from './constants';
import { retry } from './utils/Retry';
import { Logger } from './utils/Logger';

export class NostrMonitor {
  public readonly ndk: NDK;
  private subscriptions: Map<string, NDKSubscription> = new Map();
  private logger: Logger;
  private globalProjectSubscription?: NDKSubscription;
  
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
      // Stop global project subscription if exists
      if (this.globalProjectSubscription) {
        this.globalProjectSubscription.stop();
        this.globalProjectSubscription = undefined;
      }
      
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
    projectEvent: NDKEvent,
    additionalFilter: Partial<NDKFilter>,
    options: { timeout?: number; validate?: (event: NDKEvent) => boolean } = {}
  ): Promise<NDKEvent> {
    // Combine the project's filter with additional filters
    const filter: NDKFilter = {
      ...projectEvent.filter(),
      ...additionalFilter
    };
    
    return this.waitForEvent(filter, options);
  }
  
  async subscribeToProject(projectEvent: NDKEvent): Promise<AsyncIterableIterator<NDKEvent>> {
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
  
  /**
   * Starts a global subscription for all project events, logging them for debugging.
   * This subscription runs for the entire session and shows all events with formatted output.
   * 
   * @param projectEvent - Optional project event to filter events. If not provided, shows all events.
   */
  async startGlobalProjectEventMonitoring(projectEvent?: NDKEvent): Promise<void> {
    // Stop existing subscription if any
    if (this.globalProjectSubscription) {
      this.globalProjectSubscription.stop();
    }
    
    let filter: NDKFilter;
    
    if (projectEvent) {
      filter = projectEvent.filter();
    } else {
      // Monitor all events - this is useful for debugging
      filter = {};
    }
    
    this.globalProjectSubscription = this.ndk.subscribe(filter, {
      closeOnEose: false
    });
    
    this.globalProjectSubscription.on('event', (event: NDKEvent) => {
      // Format the event for debugging
      const pubkeyPrefix = event.pubkey.substring(0, 6);
      const conversationId = event.tagValue('E')?.substring(0, 6) || 'N/A';
      const contentPreview = event.content ? 
        event.content.substring(0, 100) + (event.content.length > 100 ? '...' : '') : 
        '<empty>';
      
      this.logger.info('🔍 Project Event', {
        pubkey: pubkeyPrefix,
        kind: event.kind,
        conversationId,
        content: contentPreview,
        tags: event.tags.map(t => t[0]),
      });
    });
    
    this.logger.info('Started global project event monitoring', { 
      project: projectEvent?.encode() || 'all'
    });
  }
}
