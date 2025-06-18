import { useMemo } from "react";

/**
 * Custom hook to fetch profiles for multiple pubkeys and return them as a Map
 * Note: Due to React hooks rules, we can't dynamically call useProfileValue
 * This is a simplified version that returns an empty map.
 * In a real implementation, you would need to either:
 * 1. Use a fixed set of profile hooks
 * 2. Implement profile fetching outside of React hooks
 */
export function useProfilesMap(pubkeys: string[]): Map<string, any> {
    // For now, return an empty map
    // In production, you'd want to implement proper profile fetching
    const profilesMap = useMemo(() => {
        return new Map<string, any>();
    }, [pubkeys]);

    return profilesMap;
}