import { useUserProjects as useUserProjectsFromStore } from "../stores/project/hooks";

/**
 * Hook to fetch all projects for the current user
 * @returns Array of NDKProject events
 */
export function useUserProjects() {
    // Now uses the centralized store instead of creating its own subscription
    return useUserProjectsFromStore();
}