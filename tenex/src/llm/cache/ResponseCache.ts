import crypto from "node:crypto";
import type { LLMMessage, LLMResponse } from "@/llm/types";
import type { LLMConfig } from "@/utils/agents/types";
import { logger } from "@tenex/shared/logger";

export interface CachedResponse {
    response: LLMResponse;
    timestamp: number;
    ttl: number;
    hitCount: number;
}

export interface CacheConfig {
    enabled: boolean;
    ttl: number; // Time to live in milliseconds
    maxSize: number; // Maximum number of cached responses
    keyGenerator?: (messages: LLMMessage[], config: LLMConfig) => string;
}

export interface CacheStats {
    hits: number;
    misses: number;
    size: number;
    hitRate: number;
}

export class ResponseCache {
    private cache = new Map<string, CachedResponse>();
    private stats = { hits: 0, misses: 0 };

    constructor(private config: CacheConfig) {}

    async get(
        messages: LLMMessage[],
        config: LLMConfig,
        generator: () => Promise<LLMResponse>
    ): Promise<LLMResponse> {
        if (!this.config.enabled) {
            return generator();
        }

        const key = this.generateKey(messages, config);
        const cached = this.cache.get(key);

        if (cached && this.isValid(cached)) {
            this.stats.hits++;
            cached.hitCount++;
            logger.debug(`Cache hit for key: ${key.substring(0, 8)}...`);
            return cached.response;
        }

        this.stats.misses++;
        logger.debug(`Cache miss for key: ${key.substring(0, 8)}...`);

        const response = await generator();
        this.set(key, response);

        return response;
    }

    private set(key: string, response: LLMResponse): void {
        // Clean up expired entries before adding new one
        this.cleanup();

        // If cache is full, remove oldest entry
        if (this.cache.size >= this.config.maxSize) {
            this.evictOldest();
        }

        this.cache.set(key, {
            response,
            timestamp: Date.now(),
            ttl: this.config.ttl,
            hitCount: 0,
        });

        logger.debug(`Cached response with key: ${key.substring(0, 8)}...`);
    }

    private generateKey(messages: LLMMessage[], config: LLMConfig): string {
        if (this.config.keyGenerator) {
            return this.config.keyGenerator(messages, config);
        }

        // Default key generation: hash of messages and relevant config
        const keyData = {
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
            model: config.model,
            temperature: config.temperature,
            maxTokens: config.maxTokens,
            provider: config.provider,
        };

        return crypto.createHash("sha256").update(JSON.stringify(keyData)).digest("hex");
    }

    private isValid(cached: CachedResponse): boolean {
        const now = Date.now();
        return now - cached.timestamp < cached.ttl;
    }

    private cleanup(): void {
        const _now = Date.now();
        const keysToDelete: string[] = [];

        for (const [key, cached] of this.cache.entries()) {
            if (!this.isValid(cached)) {
                keysToDelete.push(key);
            }
        }

        for (const key of keysToDelete) {
            this.cache.delete(key);
        }

        if (keysToDelete.length > 0) {
            logger.debug(`Cleaned up ${keysToDelete.length} expired cache entries`);
        }
    }

    private evictOldest(): void {
        let oldestKey: string | null = null;
        let oldestTimestamp = Date.now();

        for (const [key, cached] of this.cache.entries()) {
            if (cached.timestamp < oldestTimestamp) {
                oldestTimestamp = cached.timestamp;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
            logger.debug(`Evicted oldest cache entry: ${oldestKey.substring(0, 8)}...`);
        }
    }

    clear(): void {
        this.cache.clear();
        this.stats = { hits: 0, misses: 0 };
        logger.debug("Cache cleared");
    }

    getStats(): CacheStats {
        const total = this.stats.hits + this.stats.misses;
        return {
            hits: this.stats.hits,
            misses: this.stats.misses,
            size: this.cache.size,
            hitRate: total > 0 ? this.stats.hits / total : 0,
        };
    }

    // Get cache entries for debugging/monitoring
    getEntries(): Array<{ key: string; response: LLMResponse; age: number; hitCount: number }> {
        const now = Date.now();
        return Array.from(this.cache.entries()).map(([key, cached]) => ({
            key: `${key.substring(0, 8)}...`,
            response: cached.response,
            age: now - cached.timestamp,
            hitCount: cached.hitCount,
        }));
    }

    // Check if a specific key exists and is valid
    has(messages: LLMMessage[], config: LLMConfig): boolean {
        if (!this.config.enabled) return false;

        const key = this.generateKey(messages, config);
        const cached = this.cache.get(key);
        return cached ? this.isValid(cached) : false;
    }

    // Remove a specific cache entry
    delete(messages: LLMMessage[], config: LLMConfig): boolean {
        const key = this.generateKey(messages, config);
        return this.cache.delete(key);
    }

    // Update cache configuration
    updateConfig(newConfig: Partial<CacheConfig>): void {
        this.config = { ...this.config, ...newConfig };

        // If cache was disabled, clear it
        if (!this.config.enabled) {
            this.clear();
        }

        // If max size was reduced, evict entries
        while (this.cache.size > this.config.maxSize) {
            this.evictOldest();
        }
    }
}

export class CacheManager {
    private static instances = new Map<string, ResponseCache>();

    static getCache(provider: string, config?: Partial<CacheConfig>): ResponseCache {
        const key = provider.toLowerCase();

        if (!CacheManager.instances.has(key)) {
            const defaultConfig: CacheConfig = {
                enabled: true,
                ttl: 5 * 60 * 1000, // 5 minutes
                maxSize: 100,
                ...config,
            };

            CacheManager.instances.set(key, new ResponseCache(defaultConfig));
        }

        const instance = CacheManager.instances.get(key);
        if (!instance) {
            throw new Error(`Cache instance not found for key: ${key}`);
        }
        return instance;
    }

    static clearAll(): void {
        for (const cache of CacheManager.instances.values()) {
            cache.clear();
        }
        CacheManager.instances.clear();
    }

    static getGlobalStats(): Record<string, CacheStats> {
        const stats: Record<string, CacheStats> = {};
        for (const [provider, cache] of CacheManager.instances.entries()) {
            stats[provider] = cache.getStats();
        }
        return stats;
    }
}
