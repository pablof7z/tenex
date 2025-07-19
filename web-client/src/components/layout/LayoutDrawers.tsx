import type { NDKArticle, NDKEvent, NDKTask } from "@nostr-dev-kit/ndk-hooks";
import { useUserProjects } from "../../hooks/useUserProjects";
import { ChatInterface } from "../ChatInterface";
import { DocumentationView } from "../documentation/DocumentationView";
import { TaskUpdates } from "../tasks/TaskUpdates";
import { Sheet, SheetContent } from "../ui/sheet";

interface LayoutDrawersProps {
    // Selected items
    selectedTask: NDKTask | null;
    selectedThread: NDKEvent | null;
    selectedArticle: NDKArticle | null;

    // Setters
    onTaskClose: () => void;
    onThreadClose: () => void;
    onArticleClose: () => void;
}

export function LayoutDrawers({
    selectedTask,
    selectedThread,
    selectedArticle,
    onTaskClose,
    onThreadClose,
    onArticleClose,
}: LayoutDrawersProps) {
    // Fetch projects only when needed to find the project for a task/thread
    const projects = useUserProjects();
    return (
        <>
            {/* Task Detail Drawer */}
            <Sheet open={!!selectedTask} onOpenChange={(open) => !open && onTaskClose()}>
                <SheetContent side="right" className="p-0">
                    {selectedTask &&
                        (() => {
                            // Find the project for this task if it's a real task with tags
                            const project = selectedTask.tags
                                ? projects.find((p) => {
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
                                  })
                                : null;

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
                <SheetContent side="right" className="p-0 flex flex-col overflow-hidden">
                    {selectedThread &&
                        (() => {
                            // Find the project for this thread if it's a real thread with tags
                            const project = selectedThread.tags
                                ? projects.find((p) => {
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
                                  })
                                : null;

                            if (!project) return null;

                            const titleTag = selectedThread.tags?.find(
                                (tag: string[]) => tag[0] === "title"
                            )?.[1];

                            // For new threads with empty titles, pass undefined to trigger auto-generation
                            const threadTitle = titleTag?.trim()
                                ? titleTag
                                : selectedThread.id === "new"
                                  ? undefined
                                  : selectedThread.content?.split("\n")[0] || "Thread";

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

            {/* Documentation Drawer */}
            <Sheet open={!!selectedArticle} onOpenChange={(open) => !open && onArticleClose()}>
                <SheetContent side="right" className="p-0">
                    {selectedArticle && (() => {
                        // Find the project for this article
                        const project = projects.find((p) => {
                            const projectRef = selectedArticle.tags?.find(
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

                        return (
                            <DocumentationView
                                project={project}
                                article={selectedArticle}
                                onBack={onArticleClose}
                            />
                        );
                    })()}
                </SheetContent>
            </Sheet>
        </>
    );
}
