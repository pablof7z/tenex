import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "@/utils/logger";

// State management
const processedEventIds = new Set<string>();
let saveDebounceTimeout: NodeJS.Timeout | null = null;
const SAVE_DEBOUNCE_MS = 1000; // Save at most once per second
const MAX_EVENTS_TO_KEEP = 10000; // Keep last 10k events to prevent unbounded growth

function getStorePath(projectPath: string): string {
  return join(projectPath, ".tenex", "processed-events.json");
}

export async function loadProcessedEvents(projectPath: string): Promise<void> {
  const storePath = getStorePath(projectPath);

  try {
    // Ensure .tenex directory exists
    const tenexDir = join(storePath, "..");
    if (!existsSync(tenexDir)) {
      await mkdir(tenexDir, { recursive: true });
    }

    // Load existing processed event IDs if file exists
    if (existsSync(storePath)) {
      const data = await readFile(storePath, "utf-8");
      const parsed = JSON.parse(data);

      if (Array.isArray(parsed.eventIds)) {
        processedEventIds.clear();
        for (const id of parsed.eventIds) {
          processedEventIds.add(id);
        }
        logger.info(`Loaded ${processedEventIds.size} processed event IDs from disk`);
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

export function hasProcessedEvent(eventId: string): boolean {
  return processedEventIds.has(eventId);
}

export function addProcessedEvent(projectPath: string, eventId: string): void {
  processedEventIds.add(eventId);
  debouncedSave(projectPath);
}

function debouncedSave(projectPath: string): void {
  // Clear existing timeout
  if (saveDebounceTimeout) {
    clearTimeout(saveDebounceTimeout);
  }

  // Set new timeout
  saveDebounceTimeout = setTimeout(() => {
    saveProcessedEvents(projectPath).catch((error) => {
      logger.error("Failed to save processed event IDs:", error);
    });
  }, SAVE_DEBOUNCE_MS);
}

async function saveProcessedEvents(projectPath: string): Promise<void> {
  const storePath = getStorePath(projectPath);

  try {
    // Ensure directory exists before saving
    const tenexDir = join(storePath, "..");
    if (!existsSync(tenexDir)) {
      await mkdir(tenexDir, { recursive: true });
    }

    // Implement LRU-style cleanup: keep only the most recent events
    let eventIds = Array.from(processedEventIds);

    if (eventIds.length > MAX_EVENTS_TO_KEEP) {
      // Keep the last MAX_EVENTS_TO_KEEP events
      // Since we can't sort by timestamp without additional data,
      // we'll just keep the last added ones (Set maintains insertion order)
      eventIds = eventIds.slice(-MAX_EVENTS_TO_KEEP);
      processedEventIds.clear();
      for (const id of eventIds) {
        processedEventIds.add(id);
      }
      logger.info(`Cleaned up processed events list, kept ${eventIds.length} most recent`);
    }

    const data = {
      eventIds,
      lastUpdated: new Date().toISOString(),
      totalCount: eventIds.length,
    };

    await writeFile(storePath, JSON.stringify(data, null, 2));
    logger.debug(`Saved ${eventIds.length} processed event IDs to disk`);
  } catch (error) {
    logger.error("Failed to save processed event IDs:", error);
  }
}

export async function flushProcessedEvents(projectPath: string): Promise<void> {
  // Cancel any pending saves and save immediately
  if (saveDebounceTimeout) {
    clearTimeout(saveDebounceTimeout);
    saveDebounceTimeout = null;
  }
  await saveProcessedEvents(projectPath);
}

export function clearProcessedEvents(): void {
  processedEventIds.clear();
  if (saveDebounceTimeout) {
    clearTimeout(saveDebounceTimeout);
    saveDebounceTimeout = null;
  }
}

export function getProcessedEventCount(): number {
  return processedEventIds.size;
}
