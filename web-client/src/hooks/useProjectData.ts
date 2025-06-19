import { type NDKArticle, type NDKProject, NDKTask, useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { EVENT_KINDS } from "@tenex/types/events";
import { useMemo } from "react";

export function useProjectData(project: NDKProject | null) {
    // Subscribe to tasks for this project
    const { events: allTasks } = useSubscribe<NDKTask>(
        project
            ? [
                  {
                      kinds: [NDKTask.kind],
                      ...project.filter(),
                      limit: 100,
                  },
              ]
            : false,
        { wrap: true, subId: "project-data-task" },
        [project?.tagId()]
    );

    // Subscribe to threads (kind 11) for this project
    const { events: threads } = useSubscribe(
        project
            ? [
                  {
                      kinds: [EVENT_KINDS.CHAT],
                      ...project.filter(),
                      limit: 50,
                  },
              ]
            : false,
        {},
        [project?.tagId()]
    );

    // Subscribe to documentation articles (kind 30023) for this project
    const { events: articles } = useSubscribe<NDKArticle>(
        project
            ? [
                  {
                      kinds: [EVENT_KINDS.ARTICLE],
                      ...project.filter(),
                      limit: 50,
                  },
              ]
            : false,
        { wrap: true },
        [project?.tagId()]
    );

    // Subscribe to thread replies (kind 1111) for all threads
    const { events: threadReplies } = useSubscribe(
        threads.length > 0
            ? [
                  {
                      kinds: [EVENT_KINDS.THREAD_REPLY],
                      "#e": threads.map((t) => t.id),
                  },
              ]
            : false,
        {},
        [threads.length]
    );

    // Get status updates for all tasks (NIP-22 replies - kind 1111 events with 'e' tag referencing any task)
    const { events: statusUpdates } = useSubscribe(
        allTasks.length > 0
            ? [
                  {
                      kinds: [EVENT_KINDS.THREAD_REPLY],
                      "#e": allTasks.map((t) => t.id),
                  },
              ]
            : false,
        {},
        [allTasks.length]
    );

    // Track unread status updates per task
    const taskUnreadMap = useMemo(() => {
        const unreadMap = new Map<string, number>();
        const seenUpdates = JSON.parse(localStorage.getItem("seenStatusUpdates") || "{}");

        for (const update of statusUpdates) {
            const taskId = update.tags?.find((tag) => tag[0] === "e" && tag[3] === "task")?.[1];
            if (taskId && !seenUpdates[update.id]) {
                const currentUnread = unreadMap.get(taskId) || 0;
                unreadMap.set(taskId, currentUnread + 1);
            }
        }

        return unreadMap;
    }, [statusUpdates]);

    // Track unread thread replies per thread
    const threadUnreadMap = useMemo(() => {
        const unreadMap = new Map<string, number>();
        const seenThreadReplies = JSON.parse(localStorage.getItem("seenThreadReplies") || "{}");

        for (const reply of threadReplies) {
            const threadId = reply.tags?.find((tag) => tag[0] === "e")?.[1];
            if (threadId && !seenThreadReplies[reply.id]) {
                const currentUnread = unreadMap.get(threadId) || 0;
                unreadMap.set(threadId, currentUnread + 1);
            }
        }

        return unreadMap;
    }, [threadReplies]);

    // Get recent message for each thread
    const threadRecentMessages = useMemo(() => {
        const recentMap = new Map<string, { content: string; timestamp: number }>();

        for (const reply of threadReplies) {
            const threadId = reply.tags?.find((tag) => tag[0] === "e")?.[1];
            if (threadId && reply.created_at) {
                const existing = recentMap.get(threadId);
                if (!existing || reply.created_at > existing.timestamp) {
                    recentMap.set(threadId, {
                        content: reply.content || "",
                        timestamp: reply.created_at,
                    });
                }
            }
        }

        return recentMap;
    }, [threadReplies]);

    return {
        tasks: allTasks,
        threads,
        articles,
        threadReplies,
        statusUpdates,
        taskUnreadMap,
        threadUnreadMap,
        threadRecentMessages,
    };
}
