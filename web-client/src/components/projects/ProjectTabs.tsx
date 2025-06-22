import type { NDKProject } from "@nostr-dev-kit/ndk-hooks";
import { ArrowLeft, Edit3, MoreVertical, Copy, Info } from "lucide-react";
import { Button } from "../ui/button";
import { useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { EVENT_KINDS } from "../../lib/constants";
import { useState } from "react";

interface ProjectTabsProps {
    project: NDKProject;
    activeTab: "tasks" | "threads" | "docs";
    taskCount: number;
    threadCount: number;
    docCount: number;
    onTabChange: (tab: "tasks" | "threads" | "docs") => void;
    onBack: () => void;
    onEditProject: () => void;
}

export function ProjectTabs({
    project,
    activeTab,
    taskCount,
    threadCount,
    docCount,
    onTabChange,
    onBack,
    onEditProject,
}: ProjectTabsProps) {
    const [showProjectInfo, setShowProjectInfo] = useState(false);
    const [copiedPubkey, setCopiedPubkey] = useState(false);

    // Get project's own pubkey from status events (signed by project identity)
    const { events: statusEvents } = useSubscribe(
        project
            ? [
                  {
                      kinds: [EVENT_KINDS.PROJECT_STATUS],
                      "#a": [`31933:${project.pubkey}:${project.dTag}`],
                      limit: 1,
                  },
              ]
            : false,
        {},
        [project?.tagId()]
    );

    const projectOwnPubkey = statusEvents[0]?.pubkey;

    const copyPubkey = async (pubkey: string) => {
        try {
            await navigator.clipboard.writeText(pubkey);
            setCopiedPubkey(true);
            setTimeout(() => setCopiedPubkey(false), 2000);
        } catch (err) {
            console.error("Failed to copy pubkey:", err);
        }
    };
    return (
        <>
            {/* Header */}
            <div className="bg-card border-b border-border/60 backdrop-blur-xl bg-card/95 sticky top-0 z-40">
                <div className="flex items-center justify-between px-3 sm:px-4 py-3 sm:py-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onBack}
                            className="w-8 h-8 sm:w-9 sm:h-9 hover:bg-accent"
                        >
                            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                        </Button>
                        <div>
                            <h1 className="text-lg sm:text-xl font-semibold text-foreground truncate max-w-48">
                                {project.title || project.tagValue("title") || "Unnamed Project"}
                            </h1>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {project.description ? (
                                    <span className="truncate max-w-48">{project.description}</span>
                                ) : (
                                    <span className="italic">No description</span>
                                )}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setShowProjectInfo(!showProjectInfo)}
                            className="w-8 h-8 sm:w-9 sm:h-9"
                            title="Project Information"
                        >
                            <Info className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onEditProject}
                            className="w-8 h-8 sm:w-9 sm:h-9"
                        >
                            <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-8 h-8 sm:w-9 sm:h-9">
                            <MoreVertical className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Project Information Panel */}
            {showProjectInfo && (
                <div className="bg-card border-b border-border/60 backdrop-blur-xl bg-card/95 sticky top-[60px] sm:top-[68px] z-35">
                    <div className="px-3 sm:px-4 py-3 sm:py-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Info className="w-4 h-4 text-blue-500" />
                            <span className="text-sm font-medium text-foreground">
                                📦 Project Information
                            </span>
                        </div>
                        <div className="space-y-2 text-xs text-muted-foreground">
                            <div className="flex items-center justify-between">
                                <span className="font-medium">Project Author:</span>
                                <div className="flex items-center gap-1">
                                    <code className="bg-accent px-2 py-1 rounded text-xs font-mono">
                                        {project.pubkey.slice(0, 8)}...{project.pubkey.slice(-8)}
                                    </code>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => copyPubkey(project.pubkey)}
                                        className="w-6 h-6"
                                        title="Copy author pubkey"
                                    >
                                        <Copy className="w-3 h-3" />
                                    </Button>
                                </div>
                            </div>
                            {projectOwnPubkey && (
                                <div className="flex items-center justify-between">
                                    <span className="font-medium">Project Identity:</span>
                                    <div className="flex items-center gap-1">
                                        <code className="bg-accent px-2 py-1 rounded text-xs font-mono">
                                            {projectOwnPubkey.slice(0, 8)}...
                                            {projectOwnPubkey.slice(-8)}
                                        </code>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => copyPubkey(projectOwnPubkey)}
                                            className="w-6 h-6"
                                            title="Copy project pubkey"
                                        >
                                            <Copy className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center justify-between">
                                <span className="font-medium">Project ID:</span>
                                <code className="bg-accent px-2 py-1 rounded text-xs font-mono">
                                    {project.dTag || "N/A"}
                                </code>
                            </div>
                            {copiedPubkey && (
                                <div className="text-green-600 text-xs">
                                    Pubkey copied to clipboard!
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Tab Navigation */}
            <div
                className={`bg-card/80 backdrop-blur-sm sticky z-30 border-b border-border/60 ${
                    showProjectInfo ? "top-[170px] sm:top-[190px]" : "top-[60px] sm:top-[68px]"
                }`}
            >
                <div className="flex px-1 sm:px-2">
                    <button
                        className={`flex-1 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-all duration-200 border-b-2 ${
                            activeTab === "tasks"
                                ? "border-blue-500 text-blue-600"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => onTabChange("tasks")}
                        type="button"
                    >
                        Tasks ({taskCount})
                    </button>
                    <button
                        className={`flex-1 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-all duration-200 border-b-2 ${
                            activeTab === "threads"
                                ? "border-blue-500 text-blue-600"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => onTabChange("threads")}
                        type="button"
                    >
                        Threads ({threadCount})
                    </button>
                    <button
                        className={`flex-1 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-all duration-200 border-b-2 ${
                            activeTab === "docs"
                                ? "border-blue-500 text-blue-600"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => onTabChange("docs")}
                        type="button"
                    >
                        Docs ({docCount})
                    </button>
                </div>
            </div>
        </>
    );
}
