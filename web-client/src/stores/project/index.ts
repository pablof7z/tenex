import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { NDKEvent, NDKSubscription } from '@nostr-dev-kit/ndk';
import type NDK from '@nostr-dev-kit/ndk';
import { NDKProject, useNDK, useNDKCurrentPubkey } from '@nostr-dev-kit/ndk-hooks';
import { EVENT_KINDS } from '../../lib/types';
import * as React from 'react';
import { useRef } from 'react';

export interface ProjectAgent {
    pubkey: string;
    name: string;
}

export interface ProjectData {
    agents: ProjectAgent[];
    llmConfigs: Record<string, string>;
    lastSeen: number;
    isOnline: boolean;
}

export interface ProjectStore {
    // Map of projectTagId -> NDKEvent (the actual project event)
    userProjects: Map<string, NDKProject>;
    
    // Map of projectTagId -> project status data
    projectStatus: Map<string, ProjectData>;
    
    // Single subscription for user projects
    projectsSubscription: NDKSubscription | null;
    
    // Single subscription for all project status events
    statusSubscription: NDKSubscription | null;
    
    // Initialize project tracking for a user
    initializeForUser: (userPubkey: string, ndk: NDK) => void;
    
    // Update project event
    updateProject: (project: NDKProject) => void;
    
    // Update project status from a status event
    updateProjectStatus: (event: NDKEvent) => void;
    
    // Clean up all subscriptions
    cleanup: () => void;
}

export const useProjectStore = create<ProjectStore>()(
    subscribeWithSelector((set, get) => ({
        userProjects: new Map(),
        projectStatus: new Map(),
        projectsSubscription: null,
        statusSubscription: null,
        
        initializeForUser: (userPubkey: string, ndk: NDK) => {
            const { projectsSubscription, cleanup } = get();
            
            // Clean up existing subscription if any
            if (projectsSubscription) {
                cleanup();
            }

            console.log("Initializing project sub", {userPubkey})
            
            // Subscribe to user's projects
            const projectsSub = ndk.subscribe({ kinds: NDKProject.kinds, authors: [userPubkey] }, {  wrap: true }, {
                onEvent: (project: NDKEvent) => {
                    const { updateProject } = get();
                    updateProject(project as NDKProject);

                    // Open permanent subscription to retrieve all events tagging a project
                    ndk.subscribe([
                        { kinds: [1111], ...project.filter()}
                    ], { groupable: true, groupableDelay: 1000 }, {
                        onEvent: (e: NDKEvent) => {
                            console.log(`Received an event for project ${project.dTag} (kind:${e.kind})`)
                        },
                        onEose: () => {
                            console.log(`EOSE of events tagging project ${project.dTag}`)
                        }
                    });
                }
            });
            
            // Subscribe to all project status events for the user's projects
            // We need to subscribe to status events that reference the user's projects
            const statusSub = ndk.subscribe({
                kinds: [EVENT_KINDS.PROJECT_STATUS],
                // Status events can come from agents, not the user
                // So we don't filter by author, but we'll filter by project tag in updateProjectStatus
            }, {
                closeOnEose: false,
                groupable: true
            });
            
            statusSub.on('event', (event: NDKEvent) => {
                const { updateProjectStatus } = get();
                updateProjectStatus(event);
            });
            
            set({ 
                projectsSubscription: projectsSub,
                statusSubscription: statusSub
            });
        },
        
        updateProject: (project: NDKProject) => {
            const tagId = project.tagId();
            
            // Store the project
            set(state => ({
                userProjects: new Map(state.userProjects).set(tagId, project as NDKProject)
            }));
        },
        
        updateProjectStatus: (event: NDKEvent) => {
            // Find which project this status is for
            const aTag = event.tags.find(tag => tag[0] === 'a');
            if (!aTag || !aTag[1]) return;
            
            const projectTagId = aTag[1];
            const { projectStatus, userProjects } = get();
            
            // Only process status events for projects owned by this user
            if (!userProjects.has(projectTagId)) return;
            const currentData = projectStatus.get(projectTagId) || {
                agents: [],
                llmConfigs: {},
                lastSeen: 0,
                isOnline: false
            };
            
            // Parse agents from agent tags
            const agents: ProjectAgent[] = [];
            for (const tag of event.tags) {
                if (tag[0] === 'agent' && tag[1] && tag[2]) {
                    agents.push({
                        pubkey: tag[1],
                        name: tag[2]
                    });
                }
            }
            
            // Parse LLM configs from model tags
            const llmConfigs: Record<string, string> = {};
            for (const tag of event.tags) {
                if (tag[0] === 'model' && tag[1] && tag[2]) {
                    llmConfigs[tag[2]] = tag[1];
                }
            }
            
            set(state => ({
                projectStatus: new Map(state.projectStatus).set(projectTagId, {
                    agents: agents.length > 0 ? agents : currentData.agents,
                    llmConfigs: Object.keys(llmConfigs).length > 0 ? llmConfigs : currentData.llmConfigs,
                    lastSeen: event.created_at || Date.now() / 1000,
                    isOnline: true
                })
            }));
        },
        
        cleanup: () => {
            const { projectsSubscription, statusSubscription } = get();
            
            // Stop projects subscription
            if (projectsSubscription) {
                projectsSubscription.stop();
            }
            
            // Stop status subscription
            if (statusSubscription) {
                statusSubscription.stop();
            }
            
            set({
                userProjects: new Map(),
                projectStatus: new Map(),
                projectsSubscription: null,
                statusSubscription: null
            });
        }
    }))
);

// Selectors
export const useUserProjects = () => {
    const projects = useProjectStore(state => state.userProjects);
    // Convert Map to array with stable reference
    return React.useMemo(
        () => Array.from(projects.values()),
        [projects]
    );
};

export const useProject = (projectTagId: string | undefined) => 
    useProjectStore(state => projectTagId ? state.userProjects.get(projectTagId) : undefined);

// Stable empty array reference to prevent re-renders
const EMPTY_AGENTS: ProjectAgent[] = [];

export const useProjectAgents = (projectTagId: string | undefined) => 
    useProjectStore(state => projectTagId ? state.projectStatus.get(projectTagId)?.agents || EMPTY_AGENTS : EMPTY_AGENTS);

// Stable empty object reference to prevent re-renders
const EMPTY_LLM_CONFIGS = {};

export const useProjectLLMConfigs = (projectDir: string | undefined) => 
    useProjectStore(state => {
        if (!projectDir) return EMPTY_LLM_CONFIGS;
        // Find project by matching the dir part of the tagId
        for (const [tagId, data] of state.projectStatus.entries()) {
            const parts = tagId.split(':');
            if (parts.length >= 3 && parts[2] === projectDir) {
                return data.llmConfigs || EMPTY_LLM_CONFIGS;
            }
        }
        return EMPTY_LLM_CONFIGS;
    });

export const useProjectOnlineStatus = (projectTagId: string | undefined) => 
    useProjectStore(state => projectTagId ? state.projectStatus.get(projectTagId)?.isOnline || false : false);

// Get all online projects as a Set of project directories
export const useOnlineProjects = () => {
    const projectStatus = useProjectStore(state => state.projectStatus);
    
    return React.useMemo(() => {
        const onlineProjects = new Set<string>();
        for (const [tagId, data] of projectStatus.entries()) {
            if (data.isOnline) {
                // Extract the project directory from the tagId (format: 31933:pubkey:dir)
                const parts = tagId.split(':');
                if (parts.length >= 3) {
                    onlineProjects.add(parts[2] || "");
                }
            }
        }
        return onlineProjects;
    }, [projectStatus]);
};

// Initialize store for current user
export function useInitializeProjectStore() {
    const currentPubkey = useNDKCurrentPubkey();
    const { ndk } = useNDK();
    const initializeForUser = useProjectStore(state => state.initializeForUser);
    const cleanup = useProjectStore(state => state.cleanup);
    const initializedFor = useRef<string | null>(null);
    
    React.useEffect(() => {
        if (!currentPubkey || !ndk || initializedFor.current === currentPubkey) return;

        initializeForUser(currentPubkey, ndk);
        // initializedFor.current = currentPubkey;
        
        return () => {
            cleanup();
        };
    }, [currentPubkey, ndk, initializeForUser, cleanup]);
}

// Periodic cleanup of stale status
export function useProjectStatusCleanup() {
    React.useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now() / 1000;
            
            useProjectStore.setState(state => ({
                projectStatus: new Map(
                    Array.from(state.projectStatus.entries()).map(([tagId, data]) => [
                        tagId,
                        {
                            ...data,
                            isOnline: now - data.lastSeen <= 90
                        }
                    ])
                )
            }));
        }, 30000);
        
        return () => clearInterval(interval);
    }, []);
}

