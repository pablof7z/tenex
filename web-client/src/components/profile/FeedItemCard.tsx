import type { NDKEvent, NDKTask, NDKArticle, NDKProject } from "@nostr-dev-kit/ndk-hooks";
import { EVENT_KINDS } from "../../lib/constants";
import { StatusUpdate } from "../tasks/StatusUpdate";
import { TaskCard } from "../tasks/TaskCard";
import { DocCard } from "./DocCard";

interface FeedItemCardProps {
    event: NDKEvent;
    project: NDKProject;
    onTaskSelect?: (project: NDKProject, taskId: string) => void;
    onArticleSelect?: (project: NDKProject, article: NDKArticle) => void;
}

export function FeedItemCard({ event, project, onTaskSelect, onArticleSelect }: FeedItemCardProps) {
    switch (event.kind) {
        case EVENT_KINDS.TASK: // 1934 - Task
            return (
                <TaskCard
                    task={event as NDKTask}
                    onClick={onTaskSelect ? () => onTaskSelect(project, (event as NDKTask).encode()) : undefined}
                />
            );
        
        case EVENT_KINDS.ARTICLE: // 30023 - Article
            return (
                <DocCard
                    article={event as NDKArticle}
                    onClick={onArticleSelect ? () => onArticleSelect(project, event as NDKArticle) : undefined}
                />
            );
        
        case EVENT_KINDS.GENERIC_REPLY: // 1111 - Status updates, replies
        case EVENT_KINDS.CHAT: // 11 - Chat threads
        default:
            return <StatusUpdate event={event} />;
    }
}