import { Brain, Copy, Cpu, DollarSign, Hash, MessageSquare, Settings, Zap } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import { ContextWindowProgressBar } from "../common/ContextWindowProgressBar";

interface LLMMetadataDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    metadata: Record<string, string>;
}

export function LLMMetadataDialog({ open, onOpenChange, metadata }: LLMMetadataDialogProps) {
    const [copiedField, setCopiedField] = useState<string | null>(null);

    const formatTokenCount = (count: string | undefined) => {
        if (!count) return "0";
        const num = Number.parseInt(count);
        if (num >= 1000) {
            return `${(num / 1000).toFixed(1)}k`;
        }
        return count;
    };

    const copyToClipboard = async (text: string, field: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedField(field);
            setTimeout(() => setCopiedField(null), 2000);
        } catch (_err) {
            // console.error("Failed to copy text:", err);
        }
    };

    const renderPromptSection = (title: string, content: string, field: string) => {
        if (!content) return null;

        return (
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">{title}</h4>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => copyToClipboard(content, field)}
                    >
                        {copiedField === field ? (
                            <span className="text-xs text-green-600">Copied!</span>
                        ) : (
                            <Copy className="w-3.5 h-3.5" />
                        )}
                    </Button>
                </div>
                <div className="bg-muted/50 rounded-md overflow-hidden">
                    <ScrollArea className="h-[300px] w-full">
                        <div className="p-4">
                            <div
                                className="prose prose-sm dark:prose-invert max-w-none 
								prose-headings:text-foreground prose-p:text-foreground 
								prose-strong:text-foreground prose-code:text-foreground
								prose-pre:bg-background/80 prose-pre:text-foreground
								prose-ul:text-foreground prose-ol:text-foreground
								prose-li:text-foreground prose-a:text-primary"
                            >
                                <ReactMarkdown
                                    components={{
                                        pre: ({ children }) => (
                                            <pre className="bg-background/80 border border-border p-3 rounded-md text-xs overflow-x-auto">
                                                {children}
                                            </pre>
                                        ),
                                        code: ({ className, children, ...props }) => {
                                            const isInline = !className;
                                            return isInline ? (
                                                <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">
                                                    {children}
                                                </code>
                                            ) : (
                                                <code
                                                    className={`text-xs font-mono ${className || ""}`}
                                                    {...props}
                                                >
                                                    {children}
                                                </code>
                                            );
                                        },
                                        p: ({ children }) => (
                                            <p className="text-sm mb-3 leading-relaxed">
                                                {children}
                                            </p>
                                        ),
                                        h1: ({ children }) => (
                                            <h1 className="text-lg font-semibold mb-3 mt-4">
                                                {children}
                                            </h1>
                                        ),
                                        h2: ({ children }) => (
                                            <h2 className="text-base font-semibold mb-2 mt-3">
                                                {children}
                                            </h2>
                                        ),
                                        h3: ({ children }) => (
                                            <h3 className="text-sm font-medium mb-2 mt-2">
                                                {children}
                                            </h3>
                                        ),
                                        ul: ({ children }) => (
                                            <ul className="text-sm list-disc pl-5 mb-3 space-y-1">
                                                {children}
                                            </ul>
                                        ),
                                        ol: ({ children }) => (
                                            <ol className="text-sm list-decimal pl-5 mb-3 space-y-1">
                                                {children}
                                            </ol>
                                        ),
                                        li: ({ children }) => (
                                            <li className="leading-relaxed">{children}</li>
                                        ),
                                        blockquote: ({ children }) => (
                                            <blockquote className="border-l-2 border-primary/50 pl-4 italic my-3">
                                                {children}
                                            </blockquote>
                                        ),
                                        hr: () => <hr className="my-4 border-border" />,
                                    }}
                                >
                                    {content}
                                </ReactMarkdown>
                            </div>
                        </div>
                    </ScrollArea>
                </div>
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Cpu className="w-5 h-5" />
                        LLM Metadata
                    </DialogTitle>
                    <DialogDescription>
                        Detailed information about the AI model response
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="h-[60vh] pr-4">
                    <div className="space-y-6">
                        {/* Model Information */}
                        <div className="space-y-3">
                            <h3 className="font-semibold text-sm flex items-center gap-2">
                                <Brain className="w-4 h-4" />
                                Model Information
                            </h3>
                            <div className="grid grid-cols-2 gap-4 ml-6">
                                {metadata["llm-model"] && (
                                    <div>
                                        <span className="text-xs text-muted-foreground">
                                            Model:
                                        </span>
                                        <p className="font-mono text-sm">{metadata["llm-model"]}</p>
                                    </div>
                                )}
                                {metadata["llm-provider"] && (
                                    <div>
                                        <span className="text-xs text-muted-foreground">
                                            Provider:
                                        </span>
                                        <p className="font-mono text-sm">
                                            {metadata["llm-provider"]}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <Separator />

                        {/* Token Usage */}
                        {(metadata["llm-total-tokens"] ||
                            metadata["llm-prompt-tokens"] ||
                            metadata["llm-completion-tokens"]) && (
                            <div className="space-y-4">
                                <h3 className="font-semibold text-sm flex items-center gap-2">
                                    <Hash className="w-4 h-4" />
                                    Token Usage
                                </h3>
                                
                                {/* Context Window Progress Bar */}
                                {metadata["llm-total-tokens"] && metadata["llm-context-window"] && (
                                    <div className="ml-6">
                                        <ContextWindowProgressBar
                                            totalTokens={Number.parseInt(metadata["llm-total-tokens"])}
                                            contextWindow={Number.parseInt(metadata["llm-context-window"])}
                                            maxCompletionTokens={
                                                metadata["llm-max-completion-tokens"] 
                                                    ? Number.parseInt(metadata["llm-max-completion-tokens"])
                                                    : undefined
                                            }
                                        />
                                    </div>
                                )}
                                
                                {/* Token Details */}
                                <div className="grid grid-cols-2 gap-4 ml-6">
                                    {metadata["llm-prompt-tokens"] && (
                                        <div>
                                            <span className="text-xs text-muted-foreground">
                                                Prompt Tokens:
                                            </span>
                                            <p className="font-mono text-sm">
                                                {formatTokenCount(metadata["llm-prompt-tokens"])}
                                            </p>
                                        </div>
                                    )}
                                    {metadata["llm-completion-tokens"] && (
                                        <div>
                                            <span className="text-xs text-muted-foreground">
                                                Completion Tokens:
                                            </span>
                                            <p className="font-mono text-sm">
                                                {formatTokenCount(
                                                    metadata["llm-completion-tokens"]
                                                )}
                                            </p>
                                        </div>
                                    )}
                                    {metadata["llm-total-tokens"] && (
                                        <div>
                                            <span className="text-xs text-muted-foreground">
                                                Total Tokens:
                                            </span>
                                            <p className="font-mono text-sm font-semibold">
                                                {formatTokenCount(metadata["llm-total-tokens"])}
                                            </p>
                                        </div>
                                    )}
                                    {metadata["llm-context-window"] && (
                                        <div>
                                            <span className="text-xs text-muted-foreground">
                                                Context Window:
                                            </span>
                                            <p className="font-mono text-sm">
                                                {formatTokenCount(metadata["llm-context-window"])}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Cache Information */}
                        {(metadata["llm-cache-read-tokens"] ||
                            metadata["llm-cache-creation-tokens"]) && (
                            <>
                                <Separator />
                                <div className="space-y-3">
                                    <h3 className="font-semibold text-sm flex items-center gap-2">
                                        <Zap className="w-4 h-4" />
                                        Cache Usage
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4 ml-6">
                                        {metadata["llm-cache-read-tokens"] && (
                                            <div>
                                                <span className="text-xs text-muted-foreground">
                                                    Cache Read:
                                                </span>
                                                <p className="font-mono text-sm text-green-600">
                                                    {formatTokenCount(
                                                        metadata["llm-cache-read-tokens"]
                                                    )}
                                                </p>
                                            </div>
                                        )}
                                        {metadata["llm-cache-creation-tokens"] && (
                                            <div>
                                                <span className="text-xs text-muted-foreground">
                                                    Cache Created:
                                                </span>
                                                <p className="font-mono text-sm text-blue-600">
                                                    {formatTokenCount(
                                                        metadata["llm-cache-creation-tokens"]
                                                    )}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Cost & Confidence */}
                        {(metadata["llm-cost"] ||
                            metadata["llm-cost-usd"] ||
                            metadata["llm-confidence"]) && (
                            <>
                                <Separator />
                                <div className="space-y-3">
                                    <h3 className="font-semibold text-sm flex items-center gap-2">
                                        <Settings className="w-4 h-4" />
                                        Performance Metrics
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4 ml-6">
                                        {(metadata["llm-cost"] || metadata["llm-cost-usd"]) && (
                                            <div>
                                                <span className="text-xs text-muted-foreground">
                                                    Cost:
                                                </span>
                                                <p className="font-mono text-sm text-green-600 flex items-center gap-1">
                                                    <DollarSign className="w-3 h-3" />
                                                    {metadata["llm-cost-usd"] ||
                                                        metadata["llm-cost"]}
                                                </p>
                                            </div>
                                        )}
                                        {metadata["llm-confidence"] && (
                                            <div>
                                                <span className="text-xs text-muted-foreground">
                                                    Confidence:
                                                </span>
                                                <div className="mt-1">
                                                    <Badge variant="secondary" className="text-xs">
                                                        {metadata["llm-confidence"]}
                                                    </Badge>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Prompts */}
                        {(metadata["llm-system-prompt"] || metadata["llm-user-prompt"]) && (
                            <>
                                <Separator />
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-sm flex items-center gap-2">
                                        <MessageSquare className="w-4 h-4" />
                                        Prompts
                                    </h3>
                                    <div className="space-y-4 ml-6">
                                        {renderPromptSection(
                                            "System Prompt",
                                            metadata["llm-system-prompt"] || "",
                                            "system-prompt"
                                        )}
                                        {renderPromptSection(
                                            "User Prompt",
                                            metadata["llm-user-prompt"] || "",
                                            "user-prompt"
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Raw Response */}
                        {metadata["llm-raw-response"] && (
                            <>
                                <Separator />
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-sm flex items-center gap-2">
                                        <MessageSquare className="w-4 h-4" />
                                        Raw LLM Response
                                    </h3>
                                    <div className="space-y-4 ml-6">
                                        {renderPromptSection(
                                            "Raw Response",
                                            metadata["llm-raw-response"],
                                            "raw-response"
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
