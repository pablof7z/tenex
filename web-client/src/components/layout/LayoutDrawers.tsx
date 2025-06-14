import type { NDKArticle, NDKEvent, NDKProject, NDKTask } from "@nostr-dev-kit/ndk-hooks";
import type { ProjectAgent } from "../../hooks/useProjectAgents";
import { ChatInterface } from "../ChatInterface";
import { DocumentationView } from "../documentation/DocumentationView";
import { ProjectDetail } from "../projects/ProjectDetail";
import { TaskUpdates } from "../tasks/TaskUpdates";
import { Sheet, SheetContent } from "../ui/sheet";

interface LayoutDrawersProps {
    // Selected items
    selectedTask: NDKTask | null;
    selectedThread: NDKEvent | null;
    selectedProject: NDKProject | null;
    selectedArticle: NDKArticle | null;

    // Data arrays
    projects: NDKProject[];

    // Setters
    onTaskClose: () => void;
    onThreadClose: () => void;
    onProjectClose: () => void;
    onArticleClose: () => void;

    // Event handlers
    onTaskSelect: (project: NDKProject, taskId: string) => void;
    onEditProject?: (project: NDKProject) => void;
    onThreadStart: (
        project: NDKProject,
        threadTitle: string,
        selectedAgents: ProjectAgent[]
    ) => void;
    onThreadSelect: (project: NDKProject, threadId: string) => void;
    onArticleSelect: (project: NDKProject, article: NDKArticle) => void;
}

export function LayoutDrawers({
    selectedTask,
    selectedThread,
    selectedProject,
    selectedArticle,
    projects,
    onTaskClose,
    onThreadClose,
    onProjectClose,
    onArticleClose,
    onTaskSelect,
    onEditProject,
    onThreadStart,
    onThreadSelect,
    onArticleSelect,
}: LayoutDrawersProps) {
    return (
        <>
            {/* Task Detail Drawer */}
            <Sheet open={!!selectedTask} onOpenChange={(open) => !open && onTaskClose()}>
                <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
                    {selectedTask &&
                        (() => {
                            // Find the project for this task
                            const project = projects.find((p) => {
                                const projectReference = selectedTask.tags?.find(
                                    (tag) => tag[0] === "a"
                                )?.[1];
                                if (projectReference) {
                                    const parts = projectReference.split(":");
                                    if (parts.length >= 3) {
                                        const projectTagId = parts[2];
                                        return p.tagValue("d") === projectTagId;
                                    }
                                }
                                return false;
                            });

                            if (!project) return null;

                            return (
                                <TaskUpdates
                                    project={project}
                                    taskId={selectedTask.id}
                                    onBack={onTaskClose}
                                    embedded={true}
                                />
                            );
                        })()}
                </SheetContent>
            </Sheet>

            {/* Thread Detail Drawer */}
            <Sheet open={!!selectedThread} onOpenChange={(open) => !open && onThreadClose()}>
                <SheetContent
                    side="right"
                    className="w-full sm:max-w-2xl p-0 flex flex-col overflow-hidden"
                >
                    {selectedThread &&
                        (() => {
                            // Find the project for this thread
                            const project = projects.find((p) => {
                                const projectRef = selectedThread.tags?.find(
                                    (tag) => tag[0] === "a"
                                )?.[1];
                                if (projectRef) {
                                    const parts = projectRef.split(":");
                                    if (parts.length >= 3) {
                                        const projectTagId = parts[2];
                                        return p.tagValue("d") === projectTagId;
                                    }
                                }
                                return false;
                            });

                            if (!project) return null;

                            const threadTitle =
                                selectedThread.tags?.find(
                                    (tag: string[]) => tag[0] === "title"
                                )?.[1] ||
                                selectedThread.content?.split("\n")[0] ||
                                "Thread";

                            // Extract selected agents from temporary thread object
                            const tempThread = selectedThread as NDKEvent & {
                                selectedAgents?: ProjectAgent[];
                            };
                            const initialAgentPubkeys =
                                tempThread.selectedAgents?.map((a) => a.pubkey) || [];

                            return (
                                <ChatInterface
                                    project={project}
                                    threadId={selectedThread.id}
                                    threadTitle={threadTitle}
                                    initialAgentPubkeys={initialAgentPubkeys}
                                    onBack={onThreadClose}
                                    className="h-full overflow-hidden"
                                />
                            );
                        })()}
                </SheetContent>
            </Sheet>

            {/* Project Detail Drawer */}
            <Sheet open={!!selectedProject} onOpenChange={(open) => !open && onProjectClose()}>
                <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
                    {selectedProject && (
                        <ProjectDetail
                            project={selectedProject}
                            onBack={onProjectClose}
                            onTaskSelect={onTaskSelect}
                            onEditProject={onEditProject || (() => {})}
                            onThreadStart={onThreadStart}
                            onThreadSelect={onThreadSelect}
                            onArticleSelect={onArticleSelect}
                        />
                    )}
                </SheetContent>
            </Sheet>

            {/* Documentation Drawer */}
            <Sheet open={!!selectedArticle} onOpenChange={(open) => !open && onArticleClose()}>
                <SheetContent side="right" className="w-full sm:max-w-4xl p-0">
                    {selectedArticle && selectedProject && (
                        <DocumentationView
                            project={selectedProject}
                            article={selectedArticle}
                            onBack={onArticleClose}
                        />
                    )}
                </SheetContent>
            </Sheet>
        </>
    );
}
