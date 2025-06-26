import type { NDKKind } from "@nostr-dev-kit/ndk";
import { useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { useState, useMemo } from "react";
import { EVENT_KINDS } from "../../lib/constants";
import { NDKAgent, NDKAgentLesson } from "../../lib/ndk-setup";
import { AgentDetailHeader } from "./AgentDetailHeader";
import { AgentDetailsTab } from "./AgentDetailsTab";
import { AgentLessonsTab } from "./AgentLessonsTab";

interface AgentDetailPageProps {
    agent: NDKAgent;
    onBack: () => void;
}

type TabType = "details" | "lessons";

export function AgentDetailPage({ agent, onBack }: AgentDetailPageProps) {
    const [activeTab, setActiveTab] = useState<TabType>("details");

    // Fetch lessons for this agent (kind 4129)
    const { events: rawLessons } = useSubscribe(
        [{ kinds: [EVENT_KINDS.AGENT_LESSON as NDKKind], "#e": [agent.id] }],
        {},
        [agent.id]
    );

    // Convert raw lessons to typed lessons with memoization
    const lessons = useMemo(
        () => (rawLessons || []).map((event) => new NDKAgentLesson(undefined, event)),
        [rawLessons]
    );

    return (
        <div className="flex-1 flex flex-col">
            {/* Header */}
            <AgentDetailHeader
                agent={agent}
                activeTab={activeTab}
                lessonCount={lessons.length}
                onTabChange={setActiveTab}
                onBack={onBack}
            />

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto bg-background">
                <div className="max-w-2xl mx-auto p-4 md:p-6 lg:p-8">
                    {activeTab === "details" ? (
                        <AgentDetailsTab agent={agent} />
                    ) : (
                        <AgentLessonsTab agent={agent} lessons={lessons} />
                    )}
                </div>
            </div>
        </div>
    );
}