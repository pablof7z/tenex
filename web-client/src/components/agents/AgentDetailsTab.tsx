import { Bot, Sparkles, Tag, User } from "lucide-react";
import type { NDKAgent } from "../../lib/ndk-setup";
import { Badge } from "../ui/badge";
import { ProfileDisplay } from "../ProfileDisplay";

interface AgentDetailsTabProps {
    agent: NDKAgent;
}

export function AgentDetailsTab({ agent }: AgentDetailsTabProps) {
    return (
        <div className="bg-card rounded-xl shadow-sm border border-border p-8">
            <div className="space-y-6">
                {/* Agent Header */}
                <div className="border-b border-border pb-6">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                            <Bot className="w-7 h-7 text-white" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-2xl font-bold text-foreground mb-2">
                                {agent.title || "Unnamed Agent"}
                            </h3>
                            {agent.description && (
                                <p className="text-muted-foreground text-base leading-relaxed mb-3">
                                    {agent.description}
                                </p>
                            )}
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Created by:</span>
                                <ProfileDisplay
                                    pubkey={agent.pubkey}
                                    size="sm"
                                    className="text-sm"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Role & Tags */}
                <div className="space-y-4">
                    {agent.role && (
                        <div className="flex items-center gap-2">
                            <User className="w-5 h-5 text-green-600" />
                            <span className="inline-block bg-green-500/10 text-green-600 dark:text-green-400 px-4 py-2 rounded-full text-sm font-medium">
                                {agent.role}
                            </span>
                        </div>
                    )}
                    {agent.tags.filter((tag) => tag[0] === "t").length > 0 && (
                        <div className="flex items-start gap-2">
                            <Tag className="w-5 h-5 text-orange-600 mt-0.5" />
                            <div className="flex flex-wrap gap-2">
                                {agent.tags
                                    .filter((tag) => tag[0] === "t")
                                    .map((tag) => (
                                        <Badge
                                            key={tag[1]}
                                            variant="outline"
                                            className="text-sm px-3 py-1 bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400"
                                        >
                                            {tag[1]}
                                        </Badge>
                                    ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Instructions */}
                {agent.content && (
                    <div className="mt-8">
                        <div className="flex items-center gap-2 mb-4">
                            <Sparkles className="w-5 h-5 text-indigo-600" />
                            <h4 className="text-lg font-semibold text-foreground">Instructions</h4>
                        </div>
                        <div className="bg-muted/50 p-6 rounded-xl border border-border">
                            <pre className="whitespace-pre-wrap text-sm text-foreground font-mono leading-relaxed">
                                {agent.content}
                            </pre>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}