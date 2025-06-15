import { Bot, Check, ChevronDown, Eye, Users } from "lucide-react";
import { memo } from "react";
import type { NDKAgent } from "../../events/agent";
import type { NDKLLMRule } from "../../types/template";
import { ProfileDisplay } from "../ProfileDisplay";
import { SelectableCard } from "../common/SelectableCard";
import { Button } from "../ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";

interface InstructionCardProps {
    instruction: NDKLLMRule;
    isSelected: boolean;
    selectedAgents: NDKAgent[];
    onSelect: (instruction: NDKLLMRule, agentNames: string[]) => void;
    onDeselect: (instruction: NDKLLMRule) => void;
    onPreview: (instruction: NDKLLMRule) => void;
}

export const InstructionCard = memo(function InstructionCard({
    instruction,
    isSelected,
    selectedAgents,
    onSelect,
    onDeselect,
    onPreview,
}: InstructionCardProps) {
    const handleAgentSelect = (agentNames: string[]) => {
        onSelect(instruction, agentNames);
    };

    const handlePreview = (e: React.MouseEvent) => {
        e.stopPropagation();
        onPreview(instruction);
    };

    return (
        <SelectableCard
            item={instruction}
            isSelected={isSelected}
            onSelect={() => {}} // Handled by dropdown
            onDeselect={onDeselect}
            renderTitle={(instruction) => instruction.title || "Untitled Instruction"}
            renderDescription={(instruction) => instruction.description}
            renderMeta={(instruction) => (
                <div className="flex items-center gap-4">
                    <ProfileDisplay
                        pubkey={instruction.pubkey || ""}
                        size="sm"
                        nameClassName="text-muted-foreground"
                    />
                    {instruction.version && <span>v{instruction.version}</span>}
                </div>
            )}
            renderTags={(instruction) => instruction.hashtags || []}
            showSelectButton={false}
            renderActions={(instruction) => (
                <>
                    <Button variant="outline" size="sm" onClick={handlePreview} className="h-8">
                        <Eye className="w-3 h-3 mr-1" />
                        Preview
                    </Button>
                    {isSelected ? (
                        <Button
                            variant="default"
                            size="sm"
                            onClick={() => onDeselect(instruction)}
                            className="h-8 min-w-[80px]"
                        >
                            <Check className="w-3 h-3 mr-1" />
                            Selected
                        </Button>
                    ) : (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 min-w-[80px]">
                                    Select
                                    <ChevronDown className="w-3 h-3 ml-1" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel>Assign to agents</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleAgentSelect([])}>
                                    <Users className="w-4 h-4 mr-2" />
                                    All agents
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {selectedAgents.map((agent) => (
                                    <DropdownMenuItem
                                        key={agent.id}
                                        onClick={() => handleAgentSelect([agent.name || "unnamed"])}
                                    >
                                        <Bot className="w-4 h-4 mr-2" />
                                        {agent.name || "Unnamed Agent"}
                                    </DropdownMenuItem>
                                ))}
                                {selectedAgents.length === 0 && (
                                    <DropdownMenuItem disabled>
                                        <Bot className="w-4 h-4 mr-2" />
                                        No agents selected in project
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </>
            )}
        />
    );
});
