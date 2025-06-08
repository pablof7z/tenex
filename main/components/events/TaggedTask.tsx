import { NDKTask } from "@/lib/nostr/events/task";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { useNDK } from "@nostr-dev-kit/ndk-hooks";
import { useEffect, useState } from "react";

export default function TaggedTask({ event }: { event: NDKEvent }) {
    const { ndk } = useNDK();
    const [task, setTask] = useState<NDKTask | null>(null);
    const [projectSlug, setProjectSlug] = useState<string | undefined>(undefined);

    useEffect(() => {
        if (!ndk) return;
        const taskId = event.getMatchingTags("e")[0]?.[1];
        if (taskId) {
            ndk.fetchEvent([{ ids: [taskId] }]).then((taskEvent) => {
                if (!taskEvent) return;
                const task = NDKTask.from(taskEvent);
                if (task) {
                    setTask(task);

                    // project slug is the 3rd item when /:/ splitting the "a" tag value of the task
                    setProjectSlug(task.projectSlug);
                }
            });
        }
    }, [event.id]);

    if (!task) return null;

    // render a label that links to the task id
    return (
        <a href={`/project/${projectSlug}/${task.id}`} className="text-blue-500 hover:underline">
            {task.title || "Untitled Task"}
        </a>
    );
}
