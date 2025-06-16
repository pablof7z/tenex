import { logger } from "@tenex/shared/logger";
/**
 * Common business logic utilities
 * Consolidates repeated patterns found across the codebase
 */

/**
 * String manipulation utilities
 */
export const StringUtils = {
    /**
     * Truncate text with ellipsis
     */
    truncate(text: string, maxLength: number, suffix = "..."): string {
        if (text.length <= maxLength) return text;
        return text.slice(0, maxLength) + suffix;
    },

    /**
     * Get initials from a name
     */
    getInitials(name: string): string {
        if (!name) return "";

        // Handle pubkey-style names with ellipsis
        if (name.includes("...")) {
            return name.slice(0, 2).toUpperCase();
        }

        // Handle regular names
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    },

    /**
     * Extract first line from text content
     */
    getFirstLine(content: string, maxLength?: number): string {
        const firstLine = content.split("\n")[0] || "";
        return maxLength ? this.truncate(firstLine, maxLength) : firstLine;
    },
};

/**
 * LocalStorage utilities for common patterns
 */
export const LocalStorageUtils = {
    /**
     * Generic utility for tracking "seen" items
     */
    createSeenTracker(storageKey: string) {
        return {
            /**
             * Check if an item has been seen
             */
            isSeen(itemId: string): boolean {
                try {
                    const seen = JSON.parse(localStorage.getItem(storageKey) || "{}");
                    return Boolean(seen[itemId]);
                } catch {
                    return false;
                }
            },

            /**
             * Mark an item as seen
             */
            markSeen(itemId: string): void {
                try {
                    const seen = JSON.parse(localStorage.getItem(storageKey) || "{}");
                    seen[itemId] = true;
                    localStorage.setItem(storageKey, JSON.stringify(seen));
                } catch (error) {
                    logger.error("Failed to mark item as seen:", error);
                }
            },

            /**
             * Mark multiple items as seen
             */
            markMultipleSeen(itemIds: string[]): void {
                try {
                    const seen = JSON.parse(localStorage.getItem(storageKey) || "{}");
                    for (const id of itemIds) {
                        seen[id] = true;
                    }
                    localStorage.setItem(storageKey, JSON.stringify(seen));
                } catch (error) {
                    logger.error("Failed to mark items as seen:", error);
                }
            },

            /**
             * Get all seen item IDs
             */
            getAllSeen(): string[] {
                try {
                    const seen = JSON.parse(localStorage.getItem(storageKey) || "{}");
                    return Object.keys(seen).filter((key) => seen[key]);
                } catch {
                    return [];
                }
            },

            /**
             * Clear all seen items
             */
            clearSeen(): void {
                localStorage.removeItem(storageKey);
            },
        };
    },

    /**
     * Secure storage for API keys and sensitive data
     */
    createSecureStorage(storageKey: string) {
        return {
            get(): string | null {
                return localStorage.getItem(storageKey);
            },

            set(value: string): void {
                localStorage.setItem(storageKey, value);
            },

            remove(): void {
                localStorage.removeItem(storageKey);
            },

            exists(): boolean {
                return localStorage.getItem(storageKey) !== null;
            },
        };
    },

    /**
     * Type-safe preferences storage
     */
    createPreferencesStorage<T extends Record<string, unknown>>(storageKey: string, defaults: T) {
        return {
            get(): T {
                try {
                    const stored = localStorage.getItem(storageKey);
                    if (!stored) return defaults;
                    return { ...defaults, ...JSON.parse(stored) };
                } catch {
                    return defaults;
                }
            },

            set(preferences: Partial<T>): void {
                try {
                    const current = this.get();
                    const updated = { ...current, ...preferences };
                    localStorage.setItem(storageKey, JSON.stringify(updated));
                } catch (error) {
                    logger.error("Failed to save preferences:", error);
                }
            },

            reset(): void {
                localStorage.removeItem(storageKey);
            },
        };
    },
};

/**
 * Profile and avatar utilities
 */
export const ProfileUtils = {
    /**
     * Get avatar URL from profile
     */
    getAvatarUrl(profile: { image?: string; picture?: string } | null): string | undefined {
        return profile?.image || profile?.picture;
    },

    /**
     * Get display name from profile
     */
    getDisplayName(
        profile: { displayName?: string; name?: string } | null,
        pubkey?: string,
        fallback = "Anonymous"
    ): string {
        if (profile?.displayName) return profile.displayName;
        if (profile?.name) return profile.name;
        if (pubkey) return `${pubkey.slice(0, 8)}...`;
        return fallback;
    },

    /**
     * Generate initials from profile or pubkey
     */
    getInitials(profile: { displayName?: string; name?: string } | null, pubkey?: string): string {
        const name = this.getDisplayName(profile, pubkey);
        return StringUtils.getInitials(name);
    },
};

/**
 * Status utilities for tasks and other items
 */
export const StatusUtils = {
    /**
     * Status color mappings
     */
    getStatusColor(status: string): string {
        const colorMap: Record<string, string> = {
            completed: "border-green-500/20 bg-green-500/5 text-green-700",
            error: "border-red-500/20 bg-red-500/5 text-red-700",
            in_progress: "border-blue-500/20 bg-blue-500/5 text-blue-700",
            pending: "border-yellow-500/20 bg-yellow-500/5 text-yellow-700",
            default: "border-gray-300/20 bg-gray-100/5 text-gray-600",
        };
        return colorMap[status] || colorMap.default || "";
    },

    /**
     * Status icon names for consistent icon usage
     */
    getStatusIcon(status: string): string {
        const iconMap: Record<string, string> = {
            completed: "CheckCircle2",
            error: "AlertCircle",
            in_progress: "Clock",
            pending: "Circle",
            default: "Circle",
        };
        return iconMap[status] || iconMap.default || "";
    },
};

/**
 * Task-specific utilities
 */
export const TaskUtils = {
    /**
     * Extract task title from tags or content
     */
    getTaskTitle(task: { tags?: string[][]; content?: string }): string {
        const titleTag = task.tags?.find((tag) => tag[0] === "title")?.[1];
        if (titleTag) return titleTag;

        const firstLine = StringUtils.getFirstLine(task.content || "", 60);
        return firstLine || "Untitled Task";
    },

    /**
     * Extract complexity from task tags
     */
    getComplexity(task: { tags?: string[][] }): number | null {
        const complexityTag = task.tags?.find((tag) => tag[0] === "complexity")?.[1];
        return complexityTag ? Number.parseInt(complexityTag, 10) : null;
    },
};

/**
 * Array manipulation utilities
 */
export const ArrayUtils = {
    /**
     * Add item to array if not already present
     */
    addUnique<T>(array: T[], item: T): T[] {
        return array.includes(item) ? array : [...array, item];
    },

    /**
     * Remove item from array
     */
    remove<T>(array: T[], item: T): T[] {
        return array.filter((i) => i !== item);
    },

    /**
     * Toggle item in array (add if not present, remove if present)
     */
    toggle<T>(array: T[], item: T): T[] {
        return array.includes(item) ? this.remove(array, item) : [...array, item];
    },

    /**
     * Move item from one index to another
     */
    move<T>(array: T[], fromIndex: number, toIndex: number): T[] {
        const result = [...array];
        const [removed] = result.splice(fromIndex, 1);
        if (removed !== undefined) {
            result.splice(toIndex, 0, removed);
        }
        return result;
    },
};

/**
 * Validation utilities
 */
export const ValidationUtils = {
    /**
     * Check if string is a valid URL
     */
    isValidUrl(str: string): boolean {
        try {
            new URL(str);
            return true;
        } catch {
            return false;
        }
    },

    /**
     * Check if string is a valid email
     */
    isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    /**
     * Check if string is not empty after trimming
     */
    isNonEmptyString(str: string): boolean {
        return str.trim().length > 0;
    },

    /**
     * Validate field with custom rules
     */
    validateField(value: unknown, rules: ValidationRule[]): string | null {
        for (const rule of rules) {
            const error = rule(value);
            if (error) return error;
        }
        return null;
    },
};

/**
 * Validation rule type
 */
export type ValidationRule = (value: unknown) => string | null;

/**
 * Common validation rules
 */
export const ValidationRules = {
    required:
        (message = "This field is required"): ValidationRule =>
        (value) => {
            if (value === null || value === undefined || value === "") {
                return message;
            }
            return null;
        },

    minLength:
        (min: number, message?: string): ValidationRule =>
        (value) => {
            const str = String(value || "");
            if (str.length < min) {
                return message || `Must be at least ${min} characters`;
            }
            return null;
        },

    maxLength:
        (max: number, message?: string): ValidationRule =>
        (value) => {
            const str = String(value || "");
            if (str.length > max) {
                return message || `Must be no more than ${max} characters`;
            }
            return null;
        },

    email:
        (message = "Must be a valid email address"): ValidationRule =>
        (value) => {
            const str = String(value || "");
            if (str && !ValidationUtils.isValidEmail(str)) {
                return message;
            }
            return null;
        },

    url:
        (message = "Must be a valid URL"): ValidationRule =>
        (value) => {
            const str = String(value || "");
            if (str && !ValidationUtils.isValidUrl(str)) {
                return message;
            }
            return null;
        },
};

/**
 * CSS utility functions
 */
export const CSSUtils = {
    /**
     * Combine class names, filtering out falsy values
     */
    classNames(...classes: (string | undefined | null | false)[]): string {
        return classes.filter(Boolean).join(" ");
    },

    /**
     * Avatar size class mappings
     */
    getAvatarClasses(size: "sm" | "md" | "lg" | "xl" = "md") {
        const sizeMap = {
            sm: { avatar: "w-6 h-6", text: "text-xs" },
            md: { avatar: "w-8 h-8", text: "text-sm" },
            lg: { avatar: "w-10 h-10", text: "text-base" },
            xl: { avatar: "w-12 h-12", text: "text-lg" },
        };
        return sizeMap[size];
    },
};
