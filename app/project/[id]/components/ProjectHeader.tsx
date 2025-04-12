import Link from "next/link";
import { ArrowLeft, Code, GitBranch, Settings, Loader2, FolderPlus } from "lucide-react"; // Added Loader2, FolderPlus
import { Button } from "@/components/ui/button";
import { NDKProject } from "@/lib/nostr/events/project";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Added Tooltip

interface ProjectHeaderProps {
    project: NDKProject;
    onSettingsClick: () => void;
    onEditorLaunch: () => void;
    onProjectCreate: () => void; // Changed from Promise<void> to void for simplicity here, parent handles async
    projectExists: boolean | null; // null = loading, true = exists, false = doesn't exist
    isCreatingProject: boolean; // To disable button while creating
    isConfigReady: boolean; // Added prop to indicate if backend config is ready
}

export function ProjectHeader({
    project,
    onSettingsClick,
    onEditorLaunch,
    onProjectCreate,
    projectExists,
    isCreatingProject,
    isConfigReady, // Destructure the new prop
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
                    {/* Tagline removed */}
                    {project.repo && (
                        <>
                            <span className="text-muted-foreground hidden md:inline">•</span>
                            <p className="text-muted-foreground flex items-center">
                                <GitBranch className="h-3.5 w-3.5 mr-1.5" />
                                <a
                                    href={`https://${project.repo}`} // Use project.repo
                                    className="hover:underline"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {project.repo} {/* Use project.repo */}
                                </a>
                            </p>
                        </>
                    )}
                </div>
            </div>
            <div className="ml-auto flex items-center gap-2 mt-2 md:mt-0">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            {/* Disable Settings button if config not ready */}
                            <Button variant="outline" size="sm" className="rounded-md" onClick={onSettingsClick} disabled={!isConfigReady}>
                                <Settings className="mr-2 h-4 w-4" />
                                Settings
                            </Button>
                        </TooltipTrigger>
                        {!isConfigReady && <TooltipContent>{configNotReadyTooltip}</TooltipContent>}
                    </Tooltip>
                </TooltipProvider>

                {/* Conditional rendering for Launch/Create button */}
                {projectExists === null && (
                    <Button size="sm" className="rounded-md w-[140px]" disabled>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Checking...
                    </Button>
                )}
                {projectExists === true && (
                     <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                {/* Disable Launch Editor button if config not ready */}
                                <Button size="sm" className="rounded-md w-[140px]" onClick={onEditorLaunch} disabled={!isConfigReady}>
                                    <Code className="mr-2 h-4 w-4" />
                                    Launch Editor
                                </Button>
                            </TooltipTrigger>
                            {!isConfigReady && <TooltipContent>{configNotReadyTooltip}</TooltipContent>}
                        </Tooltip>
                    </TooltipProvider>
                )}
                {projectExists === false && (
                     <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                {/* Disable Create Project button if config not ready or already creating */}
                                <Button
                                    size="sm"
                                    className="rounded-md w-[140px]"
                                    onClick={onProjectCreate}
                                    disabled={isCreatingProject || !isConfigReady}
                                >
                                    {isCreatingProject ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <FolderPlus className="mr-2 h-4 w-4" />
                                    )}
                                    {isCreatingProject ? "Creating..." : "Create Project"}
                                </Button>
                            </TooltipTrigger>
                             {!isConfigReady && <TooltipContent>{configNotReadyTooltip}</TooltipContent>}
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>
        </div>
    );
}
