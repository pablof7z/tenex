import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { useProfileValue } from "@nostr-dev-kit/ndk-hooks";
import {
    Cpu,
    DollarSign,
    GitCommit,
    MoreHorizontal,
    Copy,
    Eye,
    MessageCircle,
    Target,
    Play,
    CheckCircle,
    Settings,
    Reply,
    ChevronDown,
    ChevronRight,
} from "lucide-react";
import { type ReactNode, memo, useMemo, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import { useTimeFormat } from "../../hooks/useTimeFormat";
import { findNostrEntities } from "../../utils/nostrEntityParser";
import { NostrEntityCard } from "../common/NostrEntityCard";
import { LLMMetadataDialog } from "../dialogs/LLMMetadataDialog";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../ui/hover-card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

interface StatusUpdateProps {
    event: NDKEvent;
    onReply?: (event: NDKEvent) => void;
}

export const StatusUpdate = memo(function StatusUpdate({ event, onReply }: StatusUpdateProps) {
    const profile = useProfileValue(event.pubkey);
    const { formatRelativeTime } = useTimeFormat();
    const [showMetadataDialog, setShowMetadataDialog] = useState(false);
    const [showRawEventDialog, setShowRawEventDialog] = useState(false);
    const [expandedThinkingBlocks, setExpandedThinkingBlocks] = useState<Set<number>>(new Set());

    // Process content for Nostr entities and thinking blocks
    const processedContent = useMemo(() => {
        let processedText = event.content;
        
        // First, handle thinking blocks
        const thinkingRegex = /<thinking>([\s\S]*?)<\/thinking>/g;
        const thinkingBlocks: string[] = [];
        let thinkingMatch: RegExpExecArray | null;
        
        while ((thinkingMatch = thinkingRegex.exec(processedText)) !== null) {
            thinkingBlocks.push(thinkingMatch[1] || "");
        }
        
        // Replace thinking blocks with placeholders
        let thinkingIndex = 0;
        processedText = processedText.replace(thinkingRegex, () => {
            const placeholder = `[THINKING_BLOCK:${thinkingIndex}]`;
            thinkingIndex++;
            return placeholder;
        });
        
        // Then handle Nostr entities
        const entities = findNostrEntities(processedText);
        
        // Replace nostr: links with markdown links that will be rendered as entity cards
        for (const entity of entities) {
            const nostrLink = `nostr:${entity.bech32}`;
            // Replace with a placeholder that won't be processed by markdown
            processedText = processedText.replace(
                nostrLink,
                `[NOSTR_ENTITY:${entity.bech32}:${entity.type}]`
            );
        }

        return { 
            content: processedText, 
            hasEntities: entities.length > 0, 
            entities,
            thinkingBlocks 
        };
    }, [event.content]);

    // Custom components for ReactMarkdown
    const markdownComponents: Components = {
        h1({ children }) {
            return <h1 className="text-3xl font-bold mt-6 mb-4">{children}</h1>;
        },
        h2({ children }) {
            return <h2 className="text-2xl font-semibold mt-5 mb-3">{children}</h2>;
        },
        h3({ children }) {
            return <h3 className="text-xl font-semibold mt-4 mb-2">{children}</h3>;
        },
        code({ className, children }) {
            const match = /language-(\w+)/.exec(className || "");
            const isInline = !match;
            return !isInline && match ? (
                <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    className="rounded-md text-xs font-mono"
                    customStyle={{ fontSize: "0.75rem" }}
                >
                    {String(children).replace(/\n$/, "")}
                </SyntaxHighlighter>
            ) : (
                <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{children}</code>
            );
        },
        pre({ children }) {
            return (
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto font-mono text-sm mb-4 whitespace-pre">
                    {children}
                </pre>
            );
        },
        ul({ children }) {
            return <ul className="list-disc pl-6 my-2 space-y-1">{children}</ul>;
        },
        ol({ children }) {
            return <ol className="list-decimal pl-6 my-2 space-y-1">{children}</ol>;
        },
        li({ children }) {
            return <li className="pl-1">{children}</li>;
        },
        p({ children, ...props }) {
            // Process text nodes to replace entity and thinking block placeholders
            const processChildren = (children: ReactNode): ReactNode => {
                if (typeof children === "string") {
                    // Check for both entity and thinking block placeholders
                    const combinedRegex = /\[NOSTR_ENTITY:([^:]+):([^\]]+)\]|\[THINKING_BLOCK:(\d+)\]/g;
                    const parts = [];
                    let lastIndex = 0;
                    let match: RegExpExecArray | null;

                    while ((match = combinedRegex.exec(children)) !== null) {
                        // Add text before the placeholder
                        if (match.index > lastIndex) {
                            parts.push(children.slice(lastIndex, match.index));
                        }

                        if (match[0].startsWith('[NOSTR_ENTITY:')) {
                            // Handle Nostr entity
                            const bech32 = match[1];
                            const entity = processedContent.entities?.find((e) => e.bech32 === bech32);
                            if (entity) {
                                parts.push(
                                    <NostrEntityCard
                                        key={`entity-${bech32}`}
                                        entity={entity}
                                        className="inline-block mx-1 my-0.5"
                                    />
                                );
                            }
                        } else if (match[0].startsWith('[THINKING_BLOCK:')) {
                            // Handle thinking block
                            const thinkingIndex = parseInt(match[3] || "0", 10);
                            const thinkingContent = processedContent.thinkingBlocks?.[thinkingIndex];
                            if (thinkingContent !== undefined) {
                                const isExpanded = expandedThinkingBlocks.has(thinkingIndex);
                                const lines = thinkingContent.trim().split('\n');
                                const hasMultipleLines = lines.length > 2;
                                
                                parts.push(
                                    <div
                                        key={`thinking-${thinkingIndex}`}
                                        className="my-2 text-xs"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setExpandedThinkingBlocks(prev => {
                                                    const newSet = new Set(prev);
                                                    if (isExpanded) {
                                                        newSet.delete(thinkingIndex);
                                                    } else {
                                                        newSet.add(thinkingIndex);
                                                    }
                                                    return newSet;
                                                });
                                            }}
                                            className="flex items-center gap-1 text-muted-foreground hover:text-muted-foreground/80 transition-colors"
                                        >
                                            {isExpanded ? (
                                                <ChevronDown className="w-3 h-3" />
                                            ) : (
                                                <ChevronRight className="w-3 h-3" />
                                            )}
                                            <span className="font-medium">Thinking process</span>
                                            {!isExpanded && hasMultipleLines && (
                                                <span className="text-muted-foreground/60 ml-1">
                                                    ({lines.length} lines)
                                                </span>
                                            )}
                                        </button>
                                        {isExpanded ? (
                                            <div className="mt-1 ml-4 p-2 bg-muted/30 rounded border border-muted-foreground/10">
                                                <pre className="text-muted-foreground/70 whitespace-pre-wrap font-mono text-xs leading-relaxed">
                                                    {thinkingContent.trim()}
                                                </pre>
                                            </div>
                                        ) : (
                                            hasMultipleLines && (
                                                <div className="mt-1 ml-4 text-muted-foreground/60 font-mono">
                                                    {lines[0]?.slice(0, 80)}{(lines[0]?.length ?? 0) > 80 ? '...' : ''}
                                                </div>
                                            )
                                        )}
                                    </div>
                                );
                            }
                        }

                        lastIndex = match.index + match[0].length;
                    }

                    // Add remaining text
                    if (lastIndex < children.length) {
                        parts.push(children.slice(lastIndex));
                    }

                    return parts.length > 0 ? parts : children;
                }
                if (Array.isArray(children)) {
                    return children.map((child, idx) => {
                        const processed = processChildren(child);
                        return typeof processed === "string" || !processed ? (
                            processed
                        ) : (
                            <span
                                key={`child-${idx}-${typeof child === "string" ? child.slice(0, 10) : ""}`}
                            >
                                {processed}
                            </span>
                        );
                    });
                }
                if (
                    children &&
                    typeof children === "object" &&
                    "props" in children &&
                    children.props &&
                    typeof children.props === "object" &&
                    "children" in children.props
                ) {
                    return {
                        ...children,
                        props: {
                            ...children.props,
                            children: processChildren(children.props.children as React.ReactNode),
                        },
                    };
                }
                return children;
            };

            const processedChildren = processChildren(children);
            return <p {...props}>{processedChildren}</p>;
        },
    };

    const getDisplayName = () => {
        return profile?.displayName || profile?.name || `user_${event.pubkey.slice(0, 8)}`;
    };

    const getConfidenceLevel = () => {
        return event.tagValue("confidence");
    };

    const getCommitHash = () => {
        return event.tagValue("commit");
    };

    const getLLMMetadata = () => {
        const metadata: Record<string, string> = {};

        // Extract all LLM-related tags
        const llmTags = [
            "llm-model",
            "llm-provider",
            "llm-prompt-tokens",
            "llm-context-window",
            "llm-completion-tokens",
            "llm-total-tokens",
            "llm-cache-creation-tokens",
            "llm-cache-read-tokens",
            "llm-confidence",
            "llm-cost",
            "llm-cost-usd",
            "llm-system-prompt",
            "llm-user-prompt",
            "llm-raw-response",
        ];

        for (const tag of llmTags) {
            const value = event.tagValue(tag);
            if (value) {
                metadata[tag] = value;
            }
        }

        // Also check for system-prompt and user-prompt tags (without llm- prefix)
        // These are used in typing indicators and response events
        const systemPromptValue = event.tagValue("system-prompt");
        if (systemPromptValue && !metadata["llm-system-prompt"]) {
            metadata["llm-system-prompt"] = systemPromptValue;
        }

        const userPromptValue = event.tagValue("prompt");
        if (userPromptValue && !metadata["llm-user-prompt"]) {
            metadata["llm-user-prompt"] = userPromptValue;
        }

        // Check for alternative token naming conventions
        // CLI uses llm-input-tokens/llm-output-tokens instead of llm-prompt-tokens/llm-completion-tokens
        const inputTokensValue = event.tagValue("llm-input-tokens");
        if (inputTokensValue && !metadata["llm-prompt-tokens"]) {
            metadata["llm-prompt-tokens"] = inputTokensValue;
        }

        const outputTokensValue = event.tagValue("llm-output-tokens");
        if (outputTokensValue && !metadata["llm-completion-tokens"]) {
            metadata["llm-completion-tokens"] = outputTokensValue;
        }

        return Object.keys(metadata).length > 0 ? metadata : null;
    };

    const handleCopyId = async () => {
        try {
            await navigator.clipboard.writeText(event.encode());
        } catch (error) {
            console.error("Failed to copy event ID:", error);
        }
    };

    const handleCopyRawEvent = async () => {
        try {
            await navigator.clipboard.writeText(event.inspect);
        } catch (error) {
            console.error("Failed to copy raw event:", error);
        }
    };

    const getRawEventData = () => {
        return event.rawEvent();
    };

    const getPhase = () => {
        // For phase transitions, use new-phase; otherwise fall back to phase
        return event.tagValue("new-phase") || event.tagValue("phase");
    };

    const getPhaseFrom = () => {
        return event.tagValue("phase-from");
    };

    const getPhaseIcon = (phase: string | null) => {
        if (!phase) return null;

        const phaseIcons = {
            chat: MessageCircle,
            plan: Target,
            execute: Play,
            review: CheckCircle,
            chores: Settings,
        };

        const IconComponent = phaseIcons[phase as keyof typeof phaseIcons];
        return IconComponent ? <IconComponent className="w-3 h-3" /> : null;
    };

    const getPhaseColor = (phase: string | null) => {
        if (!phase) return "bg-gray-500";

        const phaseColors = {
            chat: "bg-blue-500",
            plan: "bg-purple-500",
            execute: "bg-green-500",
            review: "bg-orange-500",
            chores: "bg-gray-500",
        };

        return phaseColors[phase as keyof typeof phaseColors] || "bg-gray-500";
    };

    // Get p-tagged users
    const pTaggedPubkeys = useMemo(() => {
        const pubkeys: string[] = [];
        for (const tag of event.tags) {
            if (tag[0] === "p" && tag[1]) {
                pubkeys.push(tag[1]);
            }
        }
        return pubkeys;
    }, [event.tags]);

    // Component for rendering p-tagged avatars
    const PTaggedAvatars = () => {
        if (pTaggedPubkeys.length === 0) return null;

        return (
            <div className="flex -space-x-1">
                {pTaggedPubkeys.map((pubkey) => (
                    <PTaggedAvatar key={pubkey} pubkey={pubkey} />
                ))}
            </div>
        );
    };

    // Individual avatar component with hover
    const PTaggedAvatar = ({ pubkey }: { pubkey: string }) => {
        const profile = useProfileValue(pubkey);

        return (
            <HoverCard>
                <HoverCardTrigger asChild>
                    <Avatar className="w-4 h-4 border border-background">
                        <AvatarImage src={profile?.image} alt={profile?.name || "User"} />
                        <AvatarFallback className="text-[8px]">
                            {profile?.name?.charAt(0).toUpperCase() ||
                                pubkey.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                </HoverCardTrigger>
                <HoverCardContent className="w-48" side="top">
                    <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                            <AvatarImage src={profile?.image} alt={profile?.name || "User"} />
                            <AvatarFallback className="text-[10px]">
                                {profile?.name?.charAt(0).toUpperCase() ||
                                    pubkey.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="text-sm font-semibold">
                                {profile?.name || `user_${pubkey.slice(0, 8)}`}
                            </p>
                        </div>
                    </div>
                </HoverCardContent>
            </HoverCard>
        );
    };

    // Check if this is the task description message
    const isTaskDescription = event.tags?.some(tag => tag[0] === "task-description" && tag[1] === "true");

    if (isTaskDescription) {
        // Task description - Slack/Discord style with blue accent
        return (
            <div className="flex gap-3 p-3 bg-blue-50/30 border-l-4 border-blue-500 rounded-lg">
                {/* Icon */}
                <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <MessageCircle className="w-4 h-4 text-white" />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm text-blue-900">
                            Task Created
                        </span>
                        <span className="text-xs text-blue-600">
                            {formatRelativeTime(event.created_at!)}
                        </span>
                    </div>
                    <div className="text-sm text-blue-800 whitespace-pre-wrap leading-relaxed">
                        {event.content}
                    </div>
                </div>
            </div>
        );
    }

    // Unified message rendering
    return (
        <>
            <div className="flex gap-3 p-3 hover:bg-accent/50 rounded-lg transition-colors">
                {/* Avatar */}
                <div className="flex-shrink-0">
                    <Avatar className="w-8 h-8">
                        <AvatarImage src={profile?.image} alt={profile?.name || "User"} />
                        <AvatarFallback className="text-xs">
                            {profile?.name?.charAt(0).toUpperCase() ||
                                event.pubkey.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm text-foreground">
                            {getDisplayName()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(event.created_at!)}
                        </span>
                        {/* Phase indicator */}
                        {getPhase() && (
                            <div className="flex items-center gap-1">
                                {getPhaseFrom() && (
                                    <>
                                        <div
                                            className={`flex items-center justify-center w-5 h-5 rounded-full ${getPhaseColor(getPhaseFrom() || "")} text-white`}
                                            title={`Previous phase: ${getPhaseFrom()}`}
                                        >
                                            {getPhaseIcon(getPhaseFrom() || "")}
                                        </div>
                                        <span className="text-muted-foreground text-xs">→</span>
                                    </>
                                )}
                                <div
                                    className={`flex items-center justify-center w-5 h-5 rounded-full ${getPhaseColor(getPhase() || "")} text-white`}
                                    title={getPhaseFrom() ? `Phase transition: ${getPhaseFrom()} → ${getPhase()}` : `Phase: ${getPhase()}`}
                                >
                                    {getPhaseIcon(getPhase() || "")}
                                </div>
                            </div>
                        )}
                        <PTaggedAvatars />
                        {/* Reply button */}
                        {onReply && (
                            <button
                                type="button"
                                onClick={() => onReply(event)}
                                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-sm hover:bg-accent"
                                title="Reply to this message"
                            >
                                <Reply className="w-3.5 h-3.5" />
                            </button>
                        )}
                        {/* LLM Metadata Icon - shown when metadata exists */}
                        {getLLMMetadata() && (
                            <button
                                type="button"
                                onClick={() => setShowMetadataDialog(true)}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                                title="View LLM metadata"
                            >
                                <Cpu className="w-3.5 h-3.5" />
                            </button>
                        )}
                        {/* More options dropdown */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-sm hover:bg-accent"
                                    title="Message options"
                                >
                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-36">
                                <DropdownMenuItem onClick={handleCopyId} className="cursor-pointer">
                                    <Copy className="w-3.5 h-3.5 mr-2" />
                                    Copy ID
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={handleCopyRawEvent}
                                    className="cursor-pointer"
                                >
                                    <Copy className="w-3.5 h-3.5 mr-2 whitespace-nowrap" />
                                    Copy Raw Event
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => setShowRawEventDialog(true)}
                                    className="cursor-pointer"
                                >
                                    <Eye className="w-3.5 h-3.5 mr-2" />
                                    View Raw
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        {getConfidenceLevel() && (
                            <Badge variant="secondary" className="text-xs h-5 px-2">
                                {getConfidenceLevel()}/10
                            </Badge>
                        )}
                        {(getLLMMetadata()?.["llm-cost-usd"] || getLLMMetadata()?.["llm-cost"]) && (
                            <Badge
                                variant="outline"
                                className="text-xs h-5 px-2 text-green-600 border-green-600"
                            >
                                <DollarSign className="w-3 h-3 mr-0.5" />
                                {getLLMMetadata()?.["llm-cost-usd"] ||
                                    getLLMMetadata()?.["llm-cost"]}
                            </Badge>
                        )}
                    </div>

                    {/* Message content */}
                    <div className="text-sm text-foreground/90 leading-relaxed mb-2 prose prose-sm max-w-none prose-p:my-1 prose-headings:text-foreground prose-a:text-primary prose-strong:text-foreground prose-blockquote:text-muted-foreground prose-blockquote:border-l-primary prose-ul:list-disc prose-ol:list-decimal prose-li:marker:text-foreground">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                            {processedContent.content}
                        </ReactMarkdown>
                    </div>

                    {/* Footer with commit info */}
                    {getCommitHash() && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <GitCommit className="w-3 h-3" />
                            <span className="font-mono bg-muted px-1.5 py-0.5 rounded">
                                {getCommitHash()?.slice(0, 7)}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* LLM Metadata Dialog */}
            {getLLMMetadata() && (
                <LLMMetadataDialog
                    open={showMetadataDialog}
                    onOpenChange={setShowMetadataDialog}
                    metadata={getLLMMetadata()!}
                />
            )}

            {/* Raw Event Dialog */}
            <Dialog open={showRawEventDialog} onOpenChange={setShowRawEventDialog}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
                    <DialogHeader>
                        <DialogTitle>Raw Event Data</DialogTitle>
                    </DialogHeader>
                    <div className="overflow-auto">
                        <pre className="bg-muted p-4 rounded-lg text-xs font-mono whitespace-pre-wrap break-all">
                            {JSON.stringify(getRawEventData(), null, 2)}
                        </pre>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
});
