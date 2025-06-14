import type { NDKEvent } from "@nostr-dev-kit/ndk-hooks";
import { Info } from "lucide-react";
import { Button } from "../ui/button";

interface ChatTypingIndicatorProps {
    activeIndicators: NDKEvent[];
    onDebugClick: (indicator: NDKEvent) => void;
}

export function ChatTypingIndicator({ activeIndicators, onDebugClick }: ChatTypingIndicatorProps) {
    if (activeIndicators.length === 0) return null;

    return (
        <div className="px-4 py-2 space-y-1">
            {activeIndicators.map((indicator) => {
                // Extract system prompt and prompt from tags
                const systemPromptTag = indicator.tags.find((tag) => tag[0] === "system-prompt");
                const promptTag = indicator.tags.find((tag) => tag[0] === "prompt");
                const hasDebugInfo = systemPromptTag || promptTag;

                return (
                    <div
                        key={indicator.id}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                        <div className="flex gap-0.5">
                            <span
                                className="w-1.5 h-1.5 bg-muted-foreground/70 rounded-full animate-typing-bounce"
                                style={{ animationDelay: "0ms" }}
                            />
                            <span
                                className="w-1.5 h-1.5 bg-muted-foreground/70 rounded-full animate-typing-bounce"
                                style={{ animationDelay: "200ms" }}
                            />
                            <span
                                className="w-1.5 h-1.5 bg-muted-foreground/70 rounded-full animate-typing-bounce"
                                style={{ animationDelay: "400ms" }}
                            />
                        </div>
                        <span className="italic">{indicator.content}</span>
                        {hasDebugInfo && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 hover:bg-muted"
                                onClick={() => onDebugClick(indicator)}
                            >
                                <Info className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
