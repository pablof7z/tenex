import type { NDKArticle, NDKEvent } from "@nostr-dev-kit/ndk";

/**
 * Metadata for a specification document
 */
export interface SpecMetadata {
	/** The d-tag identifier for the spec */
	id: string;
	/** Human-readable title */
	title: string;
	/** Brief description or summary of latest changes */
	summary?: string;
	/** When the spec was last updated */
	lastUpdated: number;
	/** Size estimate for the full content */
	contentSize?: number;
}

/**
 * Full specification document with content
 */
export interface SpecDocument extends SpecMetadata {
	/** The full markdown content */
	content: string;
	/** The underlying NDKEvent */
	event: NDKEvent;
}

/**
 * Cache for project specification documents
 */
export interface SpecCache {
	/** Get metadata for all available specs */
	getAllSpecMetadata(): SpecMetadata[];

	/** Get metadata for a specific spec by ID */
	getSpecMetadata(id: string): SpecMetadata | undefined;

	/** Get full spec document by ID (may fetch from network if not cached) */
	getSpecDocument(id: string): Promise<SpecDocument | undefined>;

	/** Update the cache with new spec events */
	updateSpecs(events: NDKEvent[]): Promise<void>;

	/** Check if cache has been initialized */
	isInitialized(): boolean;

	/** Clear the cache */
	clear(): void;
}

/**
 * Default implementation of SpecCache
 */
export class DefaultSpecCache implements SpecCache {
	private metadata = new Map<string, SpecMetadata>();
	private documents = new Map<string, SpecDocument>();
	private initialized = false;

	getAllSpecMetadata(): SpecMetadata[] {
		return Array.from(this.metadata.values());
	}

	getSpecMetadata(id: string): SpecMetadata | undefined {
		return this.metadata.get(id);
	}

	async getSpecDocument(id: string): Promise<SpecDocument | undefined> {
		// Return cached document if available
		const cached = this.documents.get(id);
		if (cached) {
			return cached;
		}

		// If we only have metadata, we can't fetch the full document
		// This would need to be handled by the calling code
		return undefined;
	}

	async updateSpecs(events: NDKEvent[]): Promise<void> {
		for (const event of events) {
			if (event.kind !== 30023) continue; // Only process NDKArticle events

			// Extract d-tag manually from tags
			const dTag = event.tags.find((tag) => tag[0] === "d")?.[1];
			if (!dTag) continue;

			const title = event.tags.find((tag) => tag[0] === "title")?.[1] || dTag;
			const summary = event.tags.find((tag) => tag[0] === "summary")?.[1];
			const publishedAt = event.tags.find(
				(tag) => tag[0] === "published_at",
			)?.[1];
			const lastUpdated = publishedAt
				? Number.parseInt(publishedAt)
				: event.created_at || 0;

			const metadata: SpecMetadata = {
				id: dTag,
				title,
				summary,
				lastUpdated,
				contentSize: event.content?.length || 0,
			};

			// Update metadata cache
			this.metadata.set(dTag, metadata);

			// Cache full document
			const document: SpecDocument = {
				...metadata,
				content: event.content || "",
				event,
			};
			this.documents.set(dTag, document);
		}

		this.initialized = true;
	}

	isInitialized(): boolean {
		return this.initialized;
	}

	clear(): void {
		this.metadata.clear();
		this.documents.clear();
		this.initialized = false;
	}
}
