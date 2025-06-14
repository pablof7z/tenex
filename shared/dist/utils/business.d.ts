/**
 * Common business logic utilities
 * Consolidates repeated patterns found across the codebase
 */
/**
 * String manipulation utilities
 */
export declare const StringUtils: {
    /**
     * Truncate text with ellipsis
     */
    truncate(text: string, maxLength: number, suffix?: string): string;
    /**
     * Get initials from a name
     */
    getInitials(name: string): string;
    /**
     * Extract first line from text content
     */
    getFirstLine(content: string, maxLength?: number): string;
};
/**
 * LocalStorage utilities for common patterns
 */
export declare class LocalStorageUtils {
    /**
     * Generic utility for tracking "seen" items
     */
    static createSeenTracker(storageKey: string): {
        /**
         * Check if an item has been seen
         */
        isSeen(itemId: string): boolean;
        /**
         * Mark an item as seen
         */
        markSeen(itemId: string): void;
        /**
         * Mark multiple items as seen
         */
        markMultipleSeen(itemIds: string[]): void;
        /**
         * Get all seen item IDs
         */
        getAllSeen(): string[];
        /**
         * Clear all seen items
         */
        clearSeen(): void;
    };
    /**
     * Secure storage for API keys and sensitive data
     */
    static createSecureStorage(storageKey: string): {
        get(): string | null;
        set(value: string): void;
        remove(): void;
        exists(): boolean;
    };
    /**
     * Type-safe preferences storage
     */
    static createPreferencesStorage<T extends Record<string, unknown>>(storageKey: string, defaults: T): {
        get(): T;
        set(preferences: Partial<T>): void;
        reset(): void;
    };
}
/**
 * Profile and avatar utilities
 */
export declare const ProfileUtils: {
    /**
     * Get avatar URL from profile
     */
    getAvatarUrl(profile: {
        image?: string;
        picture?: string;
    } | null): string | undefined;
    /**
     * Get display name from profile
     */
    getDisplayName(profile: {
        displayName?: string;
        name?: string;
    } | null, pubkey?: string, fallback?: string): string;
    /**
     * Generate initials from profile or pubkey
     */
    getInitials(profile: {
        displayName?: string;
        name?: string;
    } | null, pubkey?: string): string;
};
/**
 * Status utilities for tasks and other items
 */
export declare const StatusUtils: {
    /**
     * Status color mappings
     */
    getStatusColor(status: string): string;
    /**
     * Status icon names for consistent icon usage
     */
    getStatusIcon(status: string): string;
};
/**
 * Task-specific utilities
 */
export declare const TaskUtils: {
    /**
     * Extract task title from tags or content
     */
    getTaskTitle(task: {
        tags?: string[][];
        content?: string;
    }): string;
    /**
     * Extract complexity from task tags
     */
    getComplexity(task: {
        tags?: string[][];
    }): number | null;
};
/**
 * Array manipulation utilities
 */
export declare const ArrayUtils: {
    /**
     * Add item to array if not already present
     */
    addUnique<T>(array: T[], item: T): T[];
    /**
     * Remove item from array
     */
    remove<T>(array: T[], item: T): T[];
    /**
     * Toggle item in array (add if not present, remove if present)
     */
    toggle<T>(array: T[], item: T): T[];
    /**
     * Move item from one index to another
     */
    move<T>(array: T[], fromIndex: number, toIndex: number): T[];
};
/**
 * Validation utilities
 */
export declare const ValidationUtils: {
    /**
     * Check if string is a valid URL
     */
    isValidUrl(str: string): boolean;
    /**
     * Check if string is a valid email
     */
    isValidEmail(email: string): boolean;
    /**
     * Check if string is not empty after trimming
     */
    isNonEmptyString(str: string): boolean;
    /**
     * Validate field with custom rules
     */
    validateField(value: unknown, rules: ValidationRule[]): string | null;
};
/**
 * Validation rule type
 */
export type ValidationRule = (value: unknown) => string | null;
/**
 * Common validation rules
 */
export declare const ValidationRules: {
    required: (message?: string) => ValidationRule;
    minLength: (min: number, message?: string) => ValidationRule;
    maxLength: (max: number, message?: string) => ValidationRule;
    email: (message?: string) => ValidationRule;
    url: (message?: string) => ValidationRule;
};
/**
 * CSS utility functions
 */
export declare const CSSUtils: {
    /**
     * Combine class names, filtering out falsy values
     */
    classNames(...classes: (string | undefined | null | false)[]): string;
    /**
     * Avatar size class mappings
     */
    getAvatarClasses(size?: "sm" | "md" | "lg" | "xl"): {
        avatar: string;
        text: string;
    } | {
        avatar: string;
        text: string;
    } | {
        avatar: string;
        text: string;
    } | {
        avatar: string;
        text: string;
    };
};
//# sourceMappingURL=business.d.ts.map