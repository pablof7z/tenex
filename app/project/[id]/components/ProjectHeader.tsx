import Link from "next/link";
import { ArrowLeft, Code, GitBranch, Settings, Loader2, FolderPlus } from "lucide-react"; // Added Loader2, FolderPlus
import { Button } from "@/components/ui/button";
import { NDKProject } from "@/lib/nostr/events/project";

interface ProjectHeaderProps {
    project: NDKProject;
    onSettingsClick: () => void;
    onEditorLaunch: () => void;
    onProjectCreate: () => void; // Changed from Promise<void> to void for simplicity here, parent handles async
    projectExists: boolean | null; // null = loading, true = exists, false = doesn't exist
    isCreatingProject: boolean; // To disable button while creating
}

export function ProjectHeader({ project, onSettingsClick, onEditorLaunch, onProjectCreate, projectExists, isCreatingProject }: ProjectHeaderProps) {
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
                    <p className="text-muted-foreground">{project.tagline || "No tagline"}</p>
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
                                    {project.repo} // Use project.repo
                                </a>
                            </p>
                        </>
                    )}
                </div>
            </div>
            <div className="ml-auto flex items-center gap-2 mt-2 md:mt-0">
                <Button variant="outline" size="sm" className="rounded-md" onClick={onSettingsClick}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                </Button>
                {projectExists === null && (
                   <Button size="sm" className="rounded-md w-[140px]" disabled>
                       <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                       Checking...
                   </Button>
                )}
                {projectExists === true && (
                   <Button size="sm" className="rounded-md w-[140px]" onClick={onEditorLaunch}>
                       <Code className="mr-2 h-4 w-4" />
                       Launch Editor
                   </Button>
                )}
                {projectExists === false && (
                   <Button size="sm" className="rounded-md w-[140px]" onClick={onProjectCreate} disabled={isCreatingProject}>
                       {isCreatingProject ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderPlus className="mr-2 h-4 w-4" />}
                       {isCreatingProject ? "Creating..." : "Create Project"}
                   </Button>
                )}
            </div>
        </div>
    );
}
