import type { NDKProject, NDKArticle } from "@nostr-dev-kit/ndk-hooks";
import { useSubscribe, NDKSubscriptionCacheUsage } from "@nostr-dev-kit/ndk-hooks";
import { EVENT_KINDS } from "../../lib/constants";
import { FeedItemCard } from "./FeedItemCard";
import { useNavigation } from "../../contexts/NavigationContext";
import { useMemo, useState } from "react";
import { Button } from "../ui/button";
import { Loader2 } from "lucide-react";

interface HomeTabContentProps {
    project: NDKProject;
}

export function HomeTabContent({ project }: HomeTabContentProps) {
    const { goToTask, goToArticle } = useNavigation();
    const [feedLimit, setFeedLimit] = useState(50);
    const [oldestEventTime, setOldestEventTime] = useState<number | null>(null);

    // Subscribe to all project events for unified feed
    const { events: feedEvents } = useSubscribe(
        project ? [{
            kinds: [
                EVENT_KINDS.TASK,        // 1934 - Tasks
                EVENT_KINDS.CHAT,        // 11 - Chat threads
                EVENT_KINDS.ARTICLE,     // 30023 - Articles
                EVENT_KINDS.GENERIC_REPLY, // 1111 - Status updates/replies
            ],
            ...project.filter(),
            limit: feedLimit,
            ...(oldestEventTime && { until: oldestEventTime })
        }] : false,
        { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST },
        [project?.tagId(), feedLimit, oldestEventTime]
    );

    // Sort events by creation time (newest first)
    const sortedFeed = useMemo(() => {
        return (feedEvents || []).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    }, [feedEvents]);

    const loadMoreEvents = () => {
        if (sortedFeed.length > 0) {
            const oldestEvent = sortedFeed[sortedFeed.length - 1];
            if (oldestEvent) {
                setOldestEventTime(oldestEvent.created_at || null);
                setFeedLimit(prev => prev + 50);
            }
        }
    };

    const handleTaskSelect = (project: NDKProject, taskId: string) => {
        goToTask(project, taskId);
    };

    const handleArticleSelect = (project: NDKProject, article: NDKArticle) => {
        goToArticle(project, article);
    };

    if (!feedEvents || feedEvents.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <div className="text-2xl">📱</div>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                    No activity yet
                </h3>
                <p className="text-muted-foreground max-w-sm">
                    Project activity will appear here as tasks are created, threads are started, and documents are published.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {sortedFeed.map((event) => (
                <FeedItemCard
                    key={event.id}
                    event={event}
                    project={project}
                    onTaskSelect={handleTaskSelect}
                    onArticleSelect={handleArticleSelect}
                />
            ))}
            
            {sortedFeed.length >= feedLimit && (
                <div className="flex justify-center py-4">
                    <Button
                        variant="outline"
                        onClick={loadMoreEvents}
                        className="flex items-center space-x-2"
                    >
                        <Loader2 className="w-4 h-4" />
                        <span>Load More</span>
                    </Button>
                </div>
            )}
        </div>
    );
}