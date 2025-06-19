import type { SpecSummary } from "@/agents/core/types";
import type { NDKEvent } from "@nostr-dev-kit/ndk";

export interface SpecMetadata {
    id: string;
    title: string;
    summary?: string;
    author: string;
    createdAt: number;
    updatedAt: number;
    lastUpdated?: number;
    contentSize?: number;
}

export class SpecCache {
    private specs = new Map<string, NDKEvent>();
    private metadata = new Map<string, SpecMetadata>();

    async updateSpecs(events: NDKEvent[]): Promise<void> {
        for (const event of events) {
            const dTag = event.tagValue("d");
            if (!dTag) continue;

            this.specs.set(dTag, event);

            // Extract metadata
            const title = event.tagValue("title") || dTag;
            const summary = event.tagValue("summary");

            this.metadata.set(dTag, {
                id: dTag,
                title,
                summary,
                author: event.pubkey,
                createdAt: event.created_at || Date.now() / 1000,
                updatedAt: event.created_at || Date.now() / 1000,
                lastUpdated: event.created_at || Date.now() / 1000,
                contentSize: event.content?.length || 0,
            });
        }
    }

    getSpec(id: string): NDKEvent | undefined {
        return this.specs.get(id);
    }

    getAllSpecs(): NDKEvent[] {
        return Array.from(this.specs.values());
    }

    getAllSpecMetadata(): SpecMetadata[] {
        return Array.from(this.metadata.values());
    }

    /**
     * Get spec summaries for agent system prompts
     */
    getSpecSummaries(): SpecSummary[] {
        return Array.from(this.metadata.values()).map((metadata) => ({
            title: metadata.title,
            summary: metadata.summary || "No summary available",
            dTag: metadata.id,
        }));
    }

    clear(): void {
        this.specs.clear();
        this.metadata.clear();
    }
}
