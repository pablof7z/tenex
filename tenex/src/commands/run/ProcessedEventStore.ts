import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "@tenex/shared";

export class ProcessedEventStore {
    private processedEventIds = new Set<string>();
    private storePath: string;
    private saveDebounceTimeout: NodeJS.Timeout | null = null;
    private readonly SAVE_DEBOUNCE_MS = 1000; // Save at most once per second
    private readonly MAX_EVENTS_TO_KEEP = 10000; // Keep last 10k events to prevent unbounded growth

    constructor(projectPath: string) {
        this.storePath = join(projectPath, ".tenex", "processed-events.json");
    }

    async load(): Promise<void> {
        try {
            // Ensure .tenex directory exists
            const tenexDir = join(this.storePath, "..");
            if (!existsSync(tenexDir)) {
                await mkdir(tenexDir, { recursive: true });
            }

            // Load existing processed event IDs if file exists
            if (existsSync(this.storePath)) {
                const data = await readFile(this.storePath, "utf-8");
                const parsed = JSON.parse(data);

                if (Array.isArray(parsed.eventIds)) {
                    this.processedEventIds = new Set(parsed.eventIds);
                    logger.info(
                        `Loaded ${this.processedEventIds.size} processed event IDs from disk`
                    );
                } else {
                    logger.warn("Invalid processed events file format, starting fresh");
                }
            } else {
                logger.info("No processed events file found, starting fresh");
            }
        } catch (error) {
            logger.error("Failed to load processed event IDs:", error);
            // Continue with empty set on error
        }
    }

    has(eventId: string): boolean {
        return this.processedEventIds.has(eventId);
    }

    add(eventId: string): void {
        this.processedEventIds.add(eventId);
        this.debouncedSave();
    }

    private debouncedSave(): void {
        // Clear existing timeout
        if (this.saveDebounceTimeout) {
            clearTimeout(this.saveDebounceTimeout);
        }

        // Set new timeout
        this.saveDebounceTimeout = setTimeout(() => {
            this.save().catch((error) => {
                logger.error("Failed to save processed event IDs:", error);
            });
        }, this.SAVE_DEBOUNCE_MS);
    }

    private async save(): Promise<void> {
        try {
            // Ensure directory exists before saving
            const tenexDir = join(this.storePath, "..");
            if (!existsSync(tenexDir)) {
                await mkdir(tenexDir, { recursive: true });
            }

            // Implement LRU-style cleanup: keep only the most recent events
            let eventIds = Array.from(this.processedEventIds);

            if (eventIds.length > this.MAX_EVENTS_TO_KEEP) {
                // Keep the last MAX_EVENTS_TO_KEEP events
                // Since we can't sort by timestamp without additional data,
                // we'll just keep the last added ones (Set maintains insertion order)
                eventIds = eventIds.slice(-this.MAX_EVENTS_TO_KEEP);
                this.processedEventIds = new Set(eventIds);
                logger.info(
                    `Cleaned up processed events list, kept ${eventIds.length} most recent`
                );
            }

            const data = {
                eventIds,
                lastUpdated: new Date().toISOString(),
                totalCount: eventIds.length,
            };

            await writeFile(this.storePath, JSON.stringify(data, null, 2));
            logger.debug(`Saved ${eventIds.length} processed event IDs to disk`);
        } catch (error) {
            logger.error("Failed to save processed event IDs:", error);
        }
    }

    async flush(): Promise<void> {
        // Cancel any pending saves and save immediately
        if (this.saveDebounceTimeout) {
            clearTimeout(this.saveDebounceTimeout);
            this.saveDebounceTimeout = null;
        }
        await this.save();
    }

    clear(): void {
        this.processedEventIds.clear();
        if (this.saveDebounceTimeout) {
            clearTimeout(this.saveDebounceTimeout);
            this.saveDebounceTimeout = null;
        }
    }

    get size(): number {
        return this.processedEventIds.size;
    }
}
