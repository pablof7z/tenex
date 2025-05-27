"use client";

import * as React from "react"; // Added React for useState
import { NewProjectButton } from "@/components/projects/buttons/new";
import { AlertTriangle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation"; // Added for navigation
import { useNDK, useNDKCurrentUser } from "@nostr-dev-kit/ndk-hooks";
import { ProjectCard } from "@/components/events/project/card"; // This will be modified later
import { useConfig } from "@/hooks/useConfig";
import { useProjects } from "@/hooks/useProjects";
import { ActivityFeed } from "@/components/ActivityFeed";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/app-layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
// import { Checkbox } from "@/components/ui/checkbox"; // Will be used in ProjectCard

export default function DashboardPage() {
    const { ndk } = useNDK();
    const currentUser = useNDKCurrentUser();

    const router = useRouter(); // Added for navigation

    const { projects, isLoading: isLoadingProjects, isError: projectsError, mutateProjects } = useProjects();
    const { isLoading: isConfigLoading, error: configError } = useConfig();

    // State for selected projects
    const [selectedProjectSlugs, setSelectedProjectSlugs] = React.useState<string[]>([]);

    // Handler to update selected projects
    const handleProjectSelect = (projectSlug: string, isSelected: boolean) => {
        setSelectedProjectSlugs((prevSelectedSlugs) => {
            if (isSelected) {
                return [...prevSelectedSlugs, projectSlug];
            } else {
                return prevSelectedSlugs.filter((slug) => slug !== projectSlug);
            }
        });
    };

    return (
        <AppLayout>
            {/* Display Configuration Error Alert if present */}
            {configError && !isConfigLoading && (
                <Alert variant="destructive" className="mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Configuration Error</AlertTitle>
                    <AlertDescription>
                        {configError} Please check{" "}
                        <Link href="/settings" className="underline">
                            Application Settings
                        </Link>
                        . API interactions may fail.
                    </AlertDescription>
                </Alert>
            )}

            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-medium tracking-tight">Projects</h1>
                <div className="flex items-center space-x-2"> {/* Added a div to group buttons */}
                    {selectedProjectSlugs.length > 0 && (
                        <Button
                            variant="outline"
                            onClick={() => {
                                const projectIds = selectedProjectSlugs.join(',');
                                router.push(`/multi-column-view?projectIds=${projectIds}`);
                            }}
                        >
                            Enter multi-column view
                        </Button>
                    )}
                    <NewProjectButton onProjectCreated={mutateProjects} />
                </div>
            </div>
            <div className="flex gap-6 w-full">
                <div className="w-2/3">
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {isLoadingProjects ? (
                            <div className="col-span-3 text-center py-10 text-muted-foreground">
                                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                                <p>Loading projects...</p>
                            </div>
                        ) : projectsError ? (
                            <div className="col-span-3">
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>Error Loading Projects</AlertTitle>
                                    <AlertDescription>
                                        {projectsError instanceof Error ? projectsError.message : String(projectsError)}
                                        <Button variant="outline" size="sm" onClick={() => mutateProjects()} className="ml-4">
                                            Retry
                                        </Button>
                                    </AlertDescription>
                                </Alert>
                            </div>
                        ) : projects && projects.length > 0 ? (
                            // Now mapping over NDKProject instances from the SWR hook
                            projects.map((project) => (
                                <ProjectCard
                                    key={project.slug}
                                    project={project}
                                    // Pass selection props
                                    isSelected={selectedProjectSlugs.includes(project.slug)}
                                    onSelectProject={handleProjectSelect}
                                />
                            ))
                        ) : !isLoadingProjects ? ( // Only show "No projects" if not loading
                            <div className="col-span-3 text-center py-10 text-muted-foreground">
                                {currentUser ? (
                                    <p>No projects found. Create your first project to get started!</p>
                                ) : (
                                    <p>Please log in to view your projects.</p>
                                )}
                            </div>
                        ) : null /* Don't show anything while loading initially */}
                    </div>
                </div>
                <div className="w-1/3">
                    <ActivityFeed
                        pubkeys={projects && projects.length > 0 ? projects.map((p) => p.pubkey) : []}
                    />
                </div>
            </div>
        </AppLayout>
    );
}
