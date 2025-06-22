import {
  NDKEvent,
  NDKPrivateKeySigner,
  type NDKRelay,
  type NDKRelaySet,
  type NDKUser,
} from "@nostr-dev-kit/ndk";
import type NDK from "@nostr-dev-kit/ndk";

export class MockNDKEvent extends NDKEvent {
  public id: string;
  public pubkey: string;
  public created_at: number;
  public kind: number;
  public tags: string[][];
  public content: string;
  public sig: string;

  constructor(ndk: NDK | undefined, event: Partial<NDKEvent> = {}) {
    super(ndk);
    this.id = event.id || `test-event-${Date.now()}`;
    this.pubkey = event.pubkey || "test-pubkey";
    this.created_at = event.created_at || Math.floor(Date.now() / 1000);
    this.kind = event.kind || 1;
    this.tags = event.tags || [];
    this.content = event.content || "";
    this.sig = event.sig || "test-signature";
  }

  async publish(): Promise<Set<NDKRelay>> {
    // Mock publish - return empty set of relays
    return Promise.resolve(new Set<NDKRelay>());
  }

  // Override the parent's property with a getter
  get getEventHash(): () => string {
    return () => this.id;
  }

  tagValue(tagName: string): string | undefined {
    const tag = this.tags.find((t) => t[0] === tagName);
    return tag?.[1];
  }
}

export class MockNDK implements Partial<NDK> {
  activeUser?: NDKUser;
  private events: Map<string, NDKEvent> = new Map();

  async connect(): Promise<void> {
    return Promise.resolve();
  }

  async fetchEvent(id: string): Promise<NDKEvent | null> {
    return this.events.get(id) || null;
  }

  async fetchEvents(filter: { kinds?: number[]; authors?: string[]; since?: number; until?: number; limit?: number }): Promise<Set<NDKEvent>> {
    const results = new Set<NDKEvent>();
    for (const event of this.events.values()) {
      if (this.matchesFilter(event, filter)) {
        results.add(event);
      }
    }
    return results;
  }

  // Helper to add events for testing
  addEvent(event: NDKEvent): void {
    const eventId = event.id || `mock-${Date.now()}-${Math.random()}`;
    this.events.set(eventId, event);
  }

  private matchesFilter(event: NDKEvent, filter: { kinds?: number[]; authors?: string[]; since?: number; until?: number; limit?: number }): boolean {
    if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
    if (filter.authors && !filter.authors.includes(event.pubkey)) return false;
    if (filter["#e"]) {
      const eTags = event.tags.filter((t) => t[0] === "e").map((t) => t[1]);
      if (!filter["#e"].some((id: string) => eTags.includes(id))) return false;
    }
    return true;
  }
}

export function createMockNDK(): MockNDK {
  return new MockNDK();
}

export function createMockSigner(privateKey?: string): NDKPrivateKeySigner {
  return privateKey ? new NDKPrivateKeySigner(privateKey) : NDKPrivateKeySigner.generate();
}
