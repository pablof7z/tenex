import useSWR from 'swr';
import { NDKProject } from '@/lib/nostr/events/project';
import { NDKEvent, NDKFilter, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import ndk from '@/lib/nostr/ndk'; // Import the singleton NDK instance
import { ProjectConfig } from '@/app/api/projects/route';

export type LoadedProject = {
    slug: string;
    title: string;
    nsec: string;
    hashtags: string;
    pubkey: string;
    repoUrl: string;
    signer: NDKPrivateKeySigner;
    eventId: string;
    event?: NDKProject;
}

// Define the fetcher function
// Define the fetcher function to handle raw NDKEvent data and map to NDKProject
const fetcher = async (url: string): Promise<LoadedProject[]> => {
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
    const projectConfigs: LoadedProject[] = await res.json();

    projectConfigs.forEach((projectConfig) => {
      projectConfig.signer = new NDKPrivateKeySigner(projectConfig.nsec);
    });

    const filters: NDKFilter[] = [];
    for (const { eventId } of projectConfigs) {
        if (!eventId) continue;
        const [ kind, pubkey, dTag ] = eventId.split(':');
        if (kind && pubkey && dTag) {
          filters.push({ kinds: [Number(kind)], authors: [pubkey], '#d': [dTag] });
        }
    }

    if (filters.length > 0) {
      const events = await ndk.fetchEvents(filters);
      projectConfigs.forEach((projectConfig) => {
        // match based on eventId === event.tagId()
        const event = Array.from(events).find((event) => event.tagId() === projectConfig.eventId);
        if (event) {
          projectConfig.event = NDKProject.from(event);
          console.log('foudn a match for', projectConfig.eventId, event);
        }
      });
    }

    return projectConfigs;

    // // Map raw events to NDKProject instances using the singleton NDK
    // const projects = rawEvents.map(eventData => {
    //     const event = new NDKEvent(ndk, eventData); // Re-hydrate event with our NDK instance
    //     return NDKProject.from(event);
    // });

    // return projects;
};

export function useProjects() {
  const { data, error, isLoading, mutate } = useSWR<LoadedProject[]>('/api/projects', fetcher);

  return {
    projects: data,
    isLoading,
    isError: error,
    mutateProjects: mutate,
  };
}