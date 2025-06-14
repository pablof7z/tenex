import { NDKProject, NDKTask, useNDKCurrentUser, useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { FileText, FolderOpen, MessageCircle, Search, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTimeFormat } from "../../hooks/useTimeFormat";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";

interface GlobalSearchDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function GlobalSearchDialog({ open, onOpenChange }: GlobalSearchDialogProps) {
    const navigate = useNavigate();
    const currentUser = useNDKCurrentUser();
    const [searchQuery, setSearchQuery] = useState("");
    const { formatRelativeTime } = useTimeFormat();

    // Get all user's projects
    const { events: projects } = useSubscribe<NDKProject>(
        currentUser
            ? [
                  {
                      kinds: [NDKProject.kind],
                      authors: [currentUser.pubkey],
                      limit: 100,
                  },
              ]
            : false,
        { wrap: true },
        [currentUser?.pubkey]
    );

    // Get all tasks for these projects
    const { events: tasks } = useSubscribe<NDKTask>(
        projects.length > 0
            ? [
                  {
                      kinds: [NDKTask.kind],
                      "#a": projects.map(
                          (p) => `${NDKProject.kind}:${p.pubkey}:${p.tagValue("d")}`
                      ),
                  },
              ]
            : false,
        { wrap: true },
        [projects.length]
    );

    // Get all status updates
    const { events: statusUpdates } = useSubscribe(
        tasks.length > 0
            ? [
                  {
                      kinds: [1],
                      "#e": tasks.map((t) => t.id),
                  },
              ]
            : false,
        {},
        [tasks.length]
    );

    // Helper functions
    const getTaskTitle = (task: NDKTask) => {
        const titleTag = task.tags?.find((tag) => tag[0] === "title")?.[1];
        if (titleTag) return titleTag;

        const firstLine = task.content?.split("\n")[0] || "Untitled Task";
        return firstLine.length > 40 ? `${firstLine.slice(0, 40)}...` : firstLine;
    };

    const getProjectForTask = useCallback(
        (task: NDKTask) => {
            const projectReference = task.tags?.find((tag) => tag[0] === "a")?.[1];
            if (projectReference) {
                const parts = projectReference.split(":");
                if (parts.length >= 3) {
                    const projectTagId = parts[2];
                    return projects.find((p) => p.tagValue("d") === projectTagId);
                }
            }
            return null;
        },
        [projects]
    );

    const getTaskForUpdate = useCallback(
        (update: NDKEvent) => {
            const taskId = update.tags?.find((tag) => tag[0] === "e")?.[1];
            return tasks.find((t) => t.id === taskId);
        },
        [tasks]
    );

    // Filter results based on search query
    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return { projects: [], tasks: [], updates: [] };

        const query = searchQuery.toLowerCase();

        // Search projects
        const matchedProjects = projects.filter((project) => {
            const title = project.title || project.tagValue("title") || "";
            const summary = project.tagValue("summary") || "";
            const tags = project.hashtags.join(" ");
            return (
                title.toLowerCase().includes(query) ||
                summary.toLowerCase().includes(query) ||
                tags.toLowerCase().includes(query)
            );
        });

        // Search tasks
        const matchedTasks = tasks.filter((task) => {
            const title = getTaskTitle(task);
            const content = task.content || "";
            return title.toLowerCase().includes(query) || content.toLowerCase().includes(query);
        });

        // Search updates
        const matchedUpdates = statusUpdates.filter((update) => {
            const content = update.content || "";
            return content.toLowerCase().includes(query);
        });

        return {
            projects: matchedProjects.slice(0, 5),
            tasks: matchedTasks.slice(0, 5),
            updates: matchedUpdates.slice(0, 5),
        };
    }, [searchQuery, projects, tasks, statusUpdates, getTaskTitle]);

    const handleProjectClick = (project: NDKProject) => {
        onOpenChange(false);
        navigate(`/project/${project.encode()}`);
    };

    const handleTaskClick = (task: NDKTask) => {
        const project = getProjectForTask(task);
        if (project) {
            onOpenChange(false);
            navigate(`/project/${project.encode()}/task/${task.id}`);
        }
    };

    const handleUpdateClick = (update: NDKEvent) => {
        const task = getTaskForUpdate(update);
        const project = task ? getProjectForTask(task) : null;
        if (task && project) {
            onOpenChange(false);
            navigate(`/project/${project.encode()}/task/${task.id}`);
        }
    };

    const totalResults =
        searchResults.projects.length + searchResults.tasks.length + searchResults.updates.length;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Search</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    {/* Search Input */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input
                            placeholder="Search projects, tasks, and updates..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-10"
                            autoFocus
                        />
                        {searchQuery && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 top-1/2 transform -translate-y-1/2 w-6 h-6"
                                onClick={() => setSearchQuery("")}
                            >
                                <X className="w-3 h-3" />
                            </Button>
                        )}
                    </div>

                    {/* Search Results */}
                    {searchQuery.trim() && (
                        <div className="space-y-6 max-h-[60vh] overflow-y-auto">
                            {totalResults === 0 ? (
                                <div className="text-center py-8">
                                    <p className="text-muted-foreground">
                                        No results found for "{searchQuery}"
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {/* Projects */}
                                    {searchResults.projects.length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-medium text-muted-foreground mb-2">
                                                Projects
                                            </h3>
                                            <div className="space-y-2">
                                                {searchResults.projects.map((project) => (
                                                    <button
                                                        key={project.tagId()}
                                                        onClick={() => handleProjectClick(project)}
                                                        className="w-full p-3 bg-card hover:bg-accent rounded-lg transition-colors text-left"
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <FolderOpen className="w-4 h-4 text-muted-foreground mt-0.5" />
                                                            <div className="flex-1">
                                                                <div className="font-medium">
                                                                    {project.title ||
                                                                        project.tagValue("title") ||
                                                                        "Untitled Project"}
                                                                </div>
                                                                {project.tagValue("summary") && (
                                                                    <div className="text-sm text-muted-foreground line-clamp-2">
                                                                        {project.tagValue(
                                                                            "summary"
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Tasks */}
                                    {searchResults.tasks.length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-medium text-muted-foreground mb-2">
                                                Tasks
                                            </h3>
                                            <div className="space-y-2">
                                                {searchResults.tasks.map((task) => {
                                                    const project = getProjectForTask(task);
                                                    return (
                                                        <button
                                                            key={task.id}
                                                            onClick={() => handleTaskClick(task)}
                                                            className="w-full p-3 bg-card hover:bg-accent rounded-lg transition-colors text-left"
                                                        >
                                                            <div className="flex items-start gap-3">
                                                                <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
                                                                <div className="flex-1">
                                                                    <div className="font-medium">
                                                                        {getTaskTitle(task)}
                                                                    </div>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        {project && (
                                                                            <Badge
                                                                                variant="outline"
                                                                                className="text-xs"
                                                                            >
                                                                                {project.title ||
                                                                                    "Project"}
                                                                            </Badge>
                                                                        )}
                                                                        <span className="text-xs text-muted-foreground">
                                                                            {formatRelativeTime(
                                                                                task.created_at!
                                                                            )}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Status Updates */}
                                    {searchResults.updates.length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-medium text-muted-foreground mb-2">
                                                Updates
                                            </h3>
                                            <div className="space-y-2">
                                                {searchResults.updates.map((update) => {
                                                    const task = getTaskForUpdate(update);
                                                    return (
                                                        <button
                                                            key={update.id}
                                                            onClick={() =>
                                                                handleUpdateClick(update)
                                                            }
                                                            className="w-full p-3 bg-card hover:bg-accent rounded-lg transition-colors text-left"
                                                        >
                                                            <div className="flex items-start gap-3">
                                                                <MessageCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
                                                                <div className="flex-1">
                                                                    <div className="text-sm line-clamp-2">
                                                                        {update.content}
                                                                    </div>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        {task && (
                                                                            <Badge
                                                                                variant="outline"
                                                                                className="text-xs"
                                                                            >
                                                                                {getTaskTitle(task)}
                                                                            </Badge>
                                                                        )}
                                                                        <span className="text-xs text-muted-foreground">
                                                                            {formatRelativeTime(
                                                                                update.created_at!
                                                                            )}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
