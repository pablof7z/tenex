import useSWR from 'swr';
import { NDKProject } from '@/lib/nostr/events/project';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import ndk from '@/lib/nostr/ndk'; // Import the singleton NDK instance

// Define the fetcher function
// Define the fetcher function to handle raw NDKEvent data and map to NDKProject
const fetcher = async (url: string): Promise<NDKProject[]> => {
    const res = await fetch(url);
    if (!res.ok) {
        const error = new Error('An error occurred while fetching the project data.');
        try {
            error.message = await res.text();
        } catch (e) {
            // Ignore if response body cannot be read
        }
        throw error;
    }
    const rawEvents: NDKEvent[] = await res.json();

    // Ensure NDK is connected before creating NDKProject instances
    // Although connect is called in the API route, ensure it's ready here too for safety
    await ndk.connect();

    // Map raw events to NDKProject instances using the singleton NDK
    const projects = rawEvents.map(eventData => {
        const event = new NDKEvent(ndk, eventData); // Re-hydrate event with our NDK instance
        return NDKProject.from(event);
    });

    return projects;
};

export function useProjects() {
  const { data, error, isLoading, mutate } = useSWR<NDKProject[]>('/api/projects', fetcher);

  return {
    projects: data,
    isLoading,
    isError: error,
    mutateProjects: mutate,
  };
}