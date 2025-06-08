import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { LoadedProject } from "@/hooks/useProjects";
import { NDKProject } from "@/lib/nostr/events/project";
import { ArrowLeft, Code, FolderPlus, GitBranch, Loader2, Settings } from "lucide-react";
import Link from "next/link";
import { ConfigAwareButton } from "./ConfigAwareButton"; // Import the new component

interface ProjectHeaderProps {
    project: LoadedProject;
    onSettingsClick: () => void;
    onEditorLaunch: () => void;
    onProjectCreate: () => void;
    projectExists: boolean | null; // null = loading, true = exists, false = doesn't exist
    isCreatingProject: boolean; // To disable button while creating
    isConfigReady: boolean;
}

export function ProjectHeader({
    project,
    onSettingsClick,
    onEditorLaunch,
    onProjectCreate,
    projectExists,
    isCreatingProject,
    isConfigReady,
}: ProjectHeaderProps) {
    const configNotReadyTooltip = "Configure Backend URL in Application Settings first";

    return (
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-8">
            <Button variant="ghost" size="icon" asChild className="h-10 w-10 rounded-md hover:bg-secondary">
                <Link href="/dashboard">
                    <ArrowLeft className="h-5 w-5" />
                    <span className="sr-only">Back to dashboard</span>
                </Link>
            </Button>
            <div>
                <h1 className="text-3xl font-medium">{project.title || "Untitled Project"}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                    {project.repo && (
                        <>
                            <span className="text-muted-foreground hidden md:inline">•</span>
                            <p className="text-muted-foreground flex items-center">
                                <GitBranch className="h-3.5 w-3.5 mr-1.5" />
                                <a
                                    href={`https://${project.repo}`}
                                    className="hover:underline"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {project.repo}
                                </a>
                            </p>
                        </>
                    )}
                </div>
            </div>
            <div className="ml-auto flex items-center gap-2 mt-2 md:mt-0">
                <ConfigAwareButton
                    variant="outline"
                    size="sm"
                    className="rounded-md"
                    onClick={onSettingsClick}
                    isConfigReady={isConfigReady}
                    configNotReadyTooltip={configNotReadyTooltip}
                >
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                </ConfigAwareButton>

                {projectExists === null && (
                    <Button size="sm" className="rounded-md w-[140px]" disabled>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Checking...
                    </Button>
                )}
                {projectExists === true && (
                    <ConfigAwareButton
                        size="sm"
                        className="rounded-md w-[140px]"
                        onClick={onEditorLaunch}
                        isConfigReady={isConfigReady}
                        configNotReadyTooltip={configNotReadyTooltip}
                    >
                        <Code className="mr-2 h-4 w-4" />
                        Launch Editor
                    </ConfigAwareButton>
                )}
                {projectExists === false && (
                    <ConfigAwareButton
                        size="sm"
                        className="rounded-md w-[140px]"
                        onClick={onProjectCreate}
                        disabled={isCreatingProject} // Config readiness handled by ConfigAwareButton
                        isConfigReady={isConfigReady}
                        configNotReadyTooltip={configNotReadyTooltip}
                    >
                        {isCreatingProject ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <FolderPlus className="mr-2 h-4 w-4" />
                        )}
                        {isCreatingProject ? "Creating..." : "Create Project"}
                    </ConfigAwareButton>
                )}
            </div>
        </div>
    );
}
