import { ArrowLeft, Edit, Terminal } from "lucide-react";
import { NDKMCPTool } from "@tenex/cli/events";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ProfileDisplay } from "../ProfileDisplay";

interface MCPToolDetailPageProps {
    tool: NDKMCPTool;
    onBack: () => void;
    onEdit: () => void;
}

export function MCPToolDetailPage({ tool, onBack, onEdit }: MCPToolDetailPageProps) {
    const tags = tool.tags
        .filter((tag) => tag[0] === "t" && tag[1])
        .map((tag) => tag[1] as string);

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <Button variant="ghost" size="sm" onClick={onBack}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                    </Button>
                    <Button onClick={onEdit} size="sm">
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                    </Button>
                </div>

                {/* Tool Info */}
                <div className="space-y-6">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">{tool.name || "Unnamed MCP Tool"}</h1>
                        {tool.description && (
                            <p className="text-lg text-muted-foreground">{tool.description}</p>
                        )}
                    </div>

                    {/* Installation Command */}
                    {tool.command && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <Terminal className="w-4 h-4" />
                                Installation Command
                            </div>
                            <div className="bg-muted rounded-lg p-4">
                                <code className="text-sm font-mono">{tool.command}</code>
                            </div>
                        </div>
                    )}


                    {/* Tags */}
                    {tags.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-sm font-medium">Tags</h3>
                            <div className="flex flex-wrap gap-2">
                                {tags.map((tag) => (
                                    <Badge key={tag} variant="secondary">
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Metadata */}
                    <div className="pt-6 border-t space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <span>Published by:</span>
                            <ProfileDisplay pubkey={tool.pubkey} size="sm" />
                        </div>
                        {tool.created_at && (
                            <div>
                                Published: {new Date(tool.created_at * 1000).toLocaleDateString()}
                            </div>
                        )}
                        {tool.id && (
                            <div className="font-mono text-xs">
                                ID: {tool.id}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}