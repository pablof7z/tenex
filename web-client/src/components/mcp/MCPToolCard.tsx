import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { NDKMCPTool } from "@tenex/cli/events";
import { CheckIcon, Server, Terminal } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface MCPToolCardProps {
    tool: NDKMCPTool;
    isSelected: boolean;
    onSelect: (tool: NDKMCPTool) => void;
    onDeselect: (tool: NDKMCPTool) => void;
}

export function MCPToolCard({ tool, isSelected, onSelect, onDeselect }: MCPToolCardProps) {
    const handleClick = () => {
        if (isSelected) {
            onDeselect(tool);
        } else {
            onSelect(tool);
        }
    };

    const tags = tool.tags
        .filter((tag) => tag[0] === "t" && tag[1])
        .map((tag) => tag[1] as string);

    return (
        <Card
            className={`cursor-pointer transition-all hover:shadow-md ${
                isSelected ? "ring-2 ring-primary" : ""
            }`}
            onClick={handleClick}
        >
            <CardContent className="p-4">
                <div className="flex items-start space-x-4">
                    <div className="relative">
                        <Avatar className="h-12 w-12">
                            {tool.image ? (
                                <AvatarImage src={tool.image} alt={tool.name} />
                            ) : null}
                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600">
                                <Server className="h-6 w-6 text-white" />
                            </AvatarFallback>
                        </Avatar>
                        {isSelected && (
                            <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-0.5">
                                <CheckIcon className="h-3 w-3 text-primary-foreground" />
                            </div>
                        )}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                            <h3 className="font-medium text-base truncate">{tool.name || "Unnamed Tool"}</h3>
                            <Checkbox
                                checked={isSelected}
                                onClick={(e) => e.stopPropagation()}
                                className="ml-2"
                                aria-label={`Select ${tool.name}`}
                            />
                        </div>

                        {tool.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                {tool.description}
                            </p>
                        )}

                        {tool.command && (
                            <div className="flex items-center gap-2 mb-2">
                                <Terminal className="h-3 w-3 text-muted-foreground" />
                                <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                                    {tool.command}
                                </code>
                            </div>
                        )}

                        <div className="flex items-center justify-between">
                            <div className="flex flex-wrap gap-1">
                                {tags.slice(0, 3).map((tag) => (
                                    <Badge key={tag} variant="secondary" className="text-xs">
                                        {tag}
                                    </Badge>
                                ))}
                                {tags.length > 3 && (
                                    <Badge variant="secondary" className="text-xs">
                                        +{tags.length - 3}
                                    </Badge>
                                )}
                            </div>

                            {tool.created_at && (
                                <span className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(tool.created_at * 1000), {
                                        addSuffix: true,
                                    })}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}