import { ArrowLeft, Bot, Copy, Edit3, MoreVertical } from "lucide-react";
import { useState } from "react";
import { NDKAgent } from "../../lib/ndk-setup";
import { Button } from "../ui/button";

interface AgentDetailHeaderProps {
    agent: NDKAgent;
    activeTab: "details" | "lessons";
    lessonCount: number;
    onTabChange: (tab: "details" | "lessons") => void;
    onBack: () => void;
}

export function AgentDetailHeader({
    agent,
    activeTab,
    lessonCount,
    onTabChange,
    onBack,
}: AgentDetailHeaderProps) {
    const [copiedId, setCopiedId] = useState(false);

    const copyAgentId = async () => {
        try {
            await navigator.clipboard.writeText(agent.id);
            setCopiedId(true);
            setTimeout(() => setCopiedId(false), 2000);
        } catch (err) {
            console.error("Failed to copy agent ID:", err);
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
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                            <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg sm:text-xl font-semibold text-foreground truncate max-w-48">
                                {agent.title || "Unnamed Agent"}
                            </h1>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-muted-foreground">by</span>
                                <span className="text-xs text-muted-foreground">
                                    {agent.pubkey?.slice(0, 8)}...
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={copyAgentId}
                            className="w-8 h-8 sm:w-9 sm:h-9"
                            title="Copy Agent ID"
                        >
                            <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 sm:w-9 sm:h-9"
                            title="Edit Agent"
                        >
                            <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-8 h-8 sm:w-9 sm:h-9">
                            <MoreVertical className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
                {copiedId && (
                    <div className="px-3 sm:px-4 pb-2">
                        <div className="text-green-600 text-xs">Agent ID copied to clipboard!</div>
                    </div>
                )}
            </div>

            {/* Tab Navigation */}
            <div className="bg-card/80 backdrop-blur-sm sticky z-30 border-b border-border/60 top-[60px] sm:top-[68px]">
                <div className="flex px-1 sm:px-2">
                    <button
                        className={`flex-1 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-all duration-200 border-b-2 ${
                            activeTab === "details"
                                ? "border-blue-500 text-blue-600"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => onTabChange("details")}
                        type="button"
                    >
                        Details
                    </button>
                    <button
                        className={`flex-1 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-all duration-200 border-b-2 ${
                            activeTab === "lessons"
                                ? "border-blue-500 text-blue-600"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => onTabChange("lessons")}
                        type="button"
                    >
                        Lessons ({lessonCount})
                    </button>
                </div>
            </div>
        </>
    );
}