import { useCallback, useEffect, useState } from "react";

export type TimeFormatStyle = "relative" | "absolute" | "auto";
export type RelativeTimeFormat = "long" | "short"; // "5 minutes ago" vs "5m"

interface UseTimeFormatOptions {
    style?: TimeFormatStyle;
    relativeFormat?: RelativeTimeFormat;
    includeTime?: boolean;
    use24Hour?: boolean;
}

export function useTimeFormat(options: UseTimeFormatOptions = {}) {
    const {
        style = "auto",
        relativeFormat = "long",
        includeTime = true,
        use24Hour = true,
    } = options;

    // State to trigger re-renders
    const [, forceUpdate] = useState({});

    // Smart refresh intervals based on age
    useEffect(() => {
        const intervals: number[] = [];

        // Update every 10 seconds for the first minute
        intervals.push(window.setInterval(() => forceUpdate({}), 10 * 1000));

        // After 1 minute, update every 30 seconds for the next hour
        const timeout1 = setTimeout(() => {
            intervals.push(window.setInterval(() => forceUpdate({}), 30 * 1000));
        }, 60 * 1000);

        // After 1 hour, update every 5 minutes
        const timeout2 = setTimeout(
            () => {
                intervals.push(window.setInterval(() => forceUpdate({}), 5 * 60 * 1000));
            },
            60 * 60 * 1000
        );

        return () => {
            intervals.forEach(clearInterval);
            clearTimeout(timeout1);
            clearTimeout(timeout2);
        };
    }, []);

    const formatRelativeTime = useCallback(
        (timestamp: number, format: RelativeTimeFormat = relativeFormat) => {
            const date = new Date(timestamp * 1000);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            if (format === "short") {
                if (diffMins < 1) return "now";
                if (diffMins < 60) return `${diffMins}m`;
                if (diffHours < 24) return `${diffHours}h`;
                if (diffDays < 7) return `${diffDays}d`;
                return date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                });
            }
            if (diffMins < 1) return "just now";
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays < 7) return `${diffDays}d ago`;
            return date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: diffDays > 365 ? "numeric" : undefined,
            });
        },
        [relativeFormat]
    );

    const formatAbsoluteTime = useCallback(
        (timestamp: number) => {
            const date = new Date(timestamp * 1000);

            if (includeTime) {
                return date.toLocaleString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: !use24Hour,
                    month: "short",
                    day: "numeric",
                });
            }
            return date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
            });
        },
        [includeTime, use24Hour]
    );

    const formatAutoTime = useCallback(
        (timestamp: number) => {
            const date = new Date(timestamp * 1000);
            const now = new Date();
            const diffHours = Math.abs(now.getTime() - date.getTime()) / 36e5;

            // Less than 24 hours: show relative time
            if (diffHours < 24) {
                return formatRelativeTime(timestamp);
            }
            // Less than 7 days: show day of week and time
            if (diffHours < 24 * 7) {
                return date.toLocaleDateString("en-US", {
                    weekday: "short",
                    hour: includeTime ? "2-digit" : undefined,
                    minute: includeTime ? "2-digit" : undefined,
                    hour12: !use24Hour,
                });
            }
            // More than 7 days: show date

            return date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: diffHours > 24 * 365 ? "numeric" : undefined,
            });
        },
        [formatRelativeTime, includeTime, use24Hour]
    );

    const format = useCallback(
        (timestamp: number, overrideStyle?: TimeFormatStyle) => {
            const formatStyle = overrideStyle || style;

            switch (formatStyle) {
                case "relative":
                    return formatRelativeTime(timestamp);
                case "absolute":
                    return formatAbsoluteTime(timestamp);
                default:
                    return formatAutoTime(timestamp);
            }
        },
        [style, formatRelativeTime, formatAbsoluteTime, formatAutoTime]
    );

    // Utility function for components that need just the time portion
    const formatTimeOnly = useCallback(
        (timestamp: number) => {
            const date = new Date(timestamp * 1000);
            return date.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: !use24Hour,
            });
        },
        [use24Hour]
    );

    // Utility function for components that need just the date portion
    const formatDateOnly = useCallback((timestamp: number) => {
        const date = new Date(timestamp * 1000);
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    }, []);

    // Utility function to format duration in seconds to human-readable format
    const formatDuration = useCallback((totalSeconds: number) => {
        if (totalSeconds < 60) {
            return `${totalSeconds}s`;
        }
        
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        
        if (minutes < 60) {
            return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
        }
        
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        
        if (hours < 24) {
            return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
        }
        
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        
        return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
    }, []);

    return {
        format,
        formatRelativeTime,
        formatAbsoluteTime,
        formatAutoTime,
        formatTimeOnly,
        formatDateOnly,
        formatDuration,
    };
}
