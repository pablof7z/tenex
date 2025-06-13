import { type NDKEvent, type NDKProject } from "@nostr-dev-kit/ndk-hooks";
import { Plus } from "lucide-react";
import { Button } from "../ui/button";
import { ThreadItem } from "./ThreadItem";

interface ThreadsTabContentProps {
  threads: NDKEvent[];
  threadUnreadMap: Map<string, number>;
  threadRecentMessages: Map<string, { content: string; timestamp: number }>;
  project: NDKProject;
  onThreadSelect: (project: NDKProject, threadId: string, threadTitle: string) => void;
  onCreateThread: () => void;
  markThreadRepliesSeen: (threadId: string) => void;
  getThreadTitle: (thread: NDKEvent) => string;
  formatTime: (timestamp: number) => string;
}

export function ThreadsTabContent({
  threads,
  threadUnreadMap,
  threadRecentMessages,
  project,
  onThreadSelect,
  onCreateThread,
  markThreadRepliesSeen,
  getThreadTitle,
  formatTime,
}: ThreadsTabContentProps) {
  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 sm:py-32 px-4 sm:px-6 text-center">
        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center mb-4 sm:mb-6 shadow-sm">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500 rounded-full flex items-center justify-center">
            <div className="w-3 h-3 sm:w-4 sm:h-4 bg-white rounded-full" />
          </div>
        </div>
        <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2 sm:mb-3">
          No threads yet
        </h3>
        <p className="text-muted-foreground mb-6 sm:mb-8 max-w-sm leading-relaxed text-sm sm:text-base">
          Start a discussion thread to collaborate with your team.
        </p>
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm px-5 sm:px-6 py-2 rounded-full text-sm sm:text-base"
          onClick={onCreateThread}
        >
          <Plus className="w-4 h-4 mr-2" />
          Start Thread
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-0.5 sm:space-y-1 px-1 sm:px-2 pt-1 sm:pt-2">
      {threads.map((thread) => {
        const handleThreadClick = () => {
          markThreadRepliesSeen(thread.id);
          onThreadSelect(project, thread.encode(), getThreadTitle(thread));
        };

        return (
          <ThreadItem
            key={thread.id}
            thread={thread}
            unreadCount={threadUnreadMap.get(thread.id) || 0}
            recentMessage={threadRecentMessages.get(thread.id)}
            onThreadClick={handleThreadClick}
            getThreadTitle={getThreadTitle}
            formatTime={formatTime}
          />
        );
      })}
    </div>
  );
}