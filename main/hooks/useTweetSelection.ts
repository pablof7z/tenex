import { NDKEvent } from "@nostr-dev-kit/ndk";
import { useCallback, useMemo, useState } from "react";

interface UseTweetSelectionReturn {
    selectedTweetIds: Set<string>;
    selectedCount: number;
    toggleTweet: (eventId: string) => void;
    clearSelection: () => void;
    getSelectedTweets: () => NDKEvent[];
}

/**
 * Custom hook for managing tweet selection state with optimal performance.
 * Uses a Set for O(1) lookup performance and memoized functions to prevent unnecessary re-renders.
 */
export function useTweetSelection(tweets: NDKEvent[]): UseTweetSelectionReturn {
    const [selectedTweetIds, setSelectedTweetIds] = useState<Set<string>>(new Set());

    // Memoize the count to avoid recalculating on every render
    const selectedCount = useMemo(() => selectedTweetIds.size, [selectedTweetIds]);

    // Memoized function to toggle tweet selection
    const toggleTweet = useCallback((eventId: string) => {
        setSelectedTweetIds((prevSelected) => {
            const newSelected = new Set(prevSelected);
            if (newSelected.has(eventId)) {
                newSelected.delete(eventId);
            } else {
                newSelected.add(eventId);
            }
            return newSelected;
        });
    }, []);

    // Memoized function to clear all selections
    const clearSelection = useCallback(() => {
        setSelectedTweetIds(new Set());
    }, []);

    // Memoized function to get selected tweet objects
    const getSelectedTweets = useCallback((): NDKEvent[] => {
        return tweets.filter((tweet) => selectedTweetIds.has(tweet.id));
    }, [tweets, selectedTweetIds]);

    return {
        selectedTweetIds,
        selectedCount,
        toggleTweet,
        clearSelection,
        getSelectedTweets,
    };
}
