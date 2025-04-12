import { create } from 'zustand';
import { NDKProject } from '@/lib/nostr/events/project'; // Assuming we store the full NDKProject object

// Define the structure of the project data we might get from the API initially
// This might differ slightly from NDKProject until it's fully parsed
interface RawProjectData {
    id: string;
    name: string;
    description?: string;
    repo?: string;
    tags?: string[];
    // Add other relevant fields fetched from the API
    // For now, let's assume the API returns objects compatible with NDKProject structure
    // or that we transform them before storing.
}

interface ProjectState {
    projects: NDKProject[]; // Store the parsed NDKProject objects
    rawProjectsData: RawProjectData[]; // Store the initial raw data from API if needed
    isLoading: boolean;
    error: string | null;
    setProjects: (projects: NDKProject[]) => void;
    setRawProjectsData: (data: RawProjectData[]) => void;
    findProjectById: (id: string) => NDKProject | undefined;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
    projects: [],
    rawProjectsData: [],
    isLoading: false,
    error: null,
    setProjects: (projects) => set({ projects, isLoading: false, error: null }),
    setRawProjectsData: (data) => set({ rawProjectsData: data }),
    findProjectById: (id) => get().projects.find((p) => p.dTag === id),
    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error, isLoading: false }),
}));

// Example usage:
// const { projects, isLoading, error, setProjects, findProjectById } = useProjectStore();
//
// // In dashboard:
// useEffect(() => {
//   const fetchProjects = async () => {
//     setLoading(true);
//     try {
//       const response = await fetch('/api/projects'); // Adjust API endpoint
//       if (!response.ok) throw new Error('Failed to fetch');
//       const data = await response.json();
//       // Assuming data needs transformation to NDKProject instances
//       const ndkProjects = data.map(p => NDKProject.from(p)); // This might need adjustment based on API response
//       setProjects(ndkProjects);
//       // Optionally store raw data too
//       // setRawProjectsData(data);
//     } catch (err) {
//       setError(err instanceof Error ? err.message : 'An unknown error occurred');
//     }
//   };
//   fetchProjects();
// }, [setLoading, setProjects, setError, setRawProjectsData]);
//
// // In project page:
// const project = useProjectStore(state => state.findProjectById(projectId));