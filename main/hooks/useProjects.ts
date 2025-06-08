import { NDKProject } from "@/lib/nostr/events/project";
import ndk from "@/lib/nostr/ndk"; // Import the singleton NDK instance
import { filterFromId, type NDKFilter, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { nip19 } from "nostr-tools";
import useSWR from "swr";

export type LoadedProject = {
    slug: string;
    title: string;
    nsec: string;
    hashtags: string[];
    pubkey: string;
    repoUrl: string;
    signer: NDKPrivateKeySigner;
    projectNaddr: string;
    filter: NDKFilter;
    event?: NDKProject;
};

// Define the fetcher function
// Define the fetcher function to handle raw NDKEvent data and map to NDKProject
const fetcher = async (url: string): Promise<LoadedProject[]> => {
    const res = await fetch(url);
    if (!res.ok) {
        const error = new Error("An error occurred while fetching the project data.");
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
    for (const projectConfig of projectConfigs) {
        const { projectNaddr } = projectConfig;
        if (!projectNaddr) continue;
        const filter = filterFromId(projectNaddr);

        const data = nip19.decode(projectNaddr);
        if (data.type !== "naddr") {
            console.warn("Invalid projectNaddr format", projectNaddr, data);
            continue;
        }
        const { kind, pubkey, identifier } = data.data;
        projectConfig.filter = { "#a": [`${kind}:${pubkey}:${identifier}`] };

        console.log("adding filter for projectNaddr", projectNaddr, filter);
        if (filter) {
            filters.push(filter);
        }
    }

    if (filters.length > 0) {
        const events = await ndk.fetchEvents(filters);
        console.log("fetched events for projects", events);
        projectConfigs.forEach((projectConfig) => {
            // match based on projectNaddr === event.tagId()
            const event = Array.from(events).find((event) => event.tagId() === projectConfig.projectNaddr);
            if (event) {
                projectConfig.event = NDKProject.from(event);
                console.log("foudn a match for", projectConfig.projectNaddr, event);
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
    const { data, error, isLoading, mutate } = useSWR<LoadedProject[]>("/api/projects", fetcher);

    console.log("useProjects data", data);

    return {
        projects: data,
        isLoading,
        isError: error,
        mutateProjects: mutate,
    };
}
