import NDK, { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk"; // Import NDKPrivateKeySigner
import { create } from "zustand";
import { NDKProject } from "@/lib/nostr/events/project";

// Define the structure for storing signer and pubkey together
interface ProjectDetails {
    signer: NDKPrivateKeySigner;
    pubkey: string;
}

interface ProjectState {
    projects: NDKProject[]; // Store the parsed NDKProject objects
    projectDetails: Map<string, ProjectDetails>; // Map slug to signer and pubkey
    isLoading: boolean;
    error: string | null;
    setProjects: (projects: NDKProject[]) => void;
    findProjectById: (id: string) => NDKProject | undefined; // Assuming 'id' here is the dTag/slug
    loadProjectDetails: (slug: string, nsec: string, pubkey: string) => void; // Action to load details
    getPubkeyBySlug: (slug: string) => string | undefined; // Getter for pubkey
    getSignerBySlug: (slug: string) => NDKPrivateKeySigner | undefined; // Getter for signer
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
    projects: [],
    projectDetails: new Map(), // Initialize the map
    isLoading: false,
    error: null,
    setProjects: (projects) => set({ projects, isLoading: false, error: null }),
    findProjectById: (id) => get().projects.find((p) => p.dTag === id), // Assuming dTag is the slug/id used
    loadProjectDetails: (slug, nsec, pubkey) => {
        const signer = new NDKPrivateKeySigner(nsec);
        // It's generally good practice to update the map immutably
        set((state) => ({
            projectDetails: new Map(state.projectDetails).set(slug, { signer, pubkey }),
        }));
    },
    getPubkeyBySlug: (slug) => get().projectDetails.get(slug)?.pubkey,
    getSignerBySlug: (slug) => get().projectDetails.get(slug)?.signer,
    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error, isLoading: false }),
}));
