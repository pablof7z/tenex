import { AtSign, Send } from "lucide-react";
import { forwardRef } from "react";
import type { ProjectAgent } from "../../hooks/useProjectAgents";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

interface ChatInputAreaProps {
    messageInput: string;
    isSending: boolean;
    placeholder: string;
    showAgentMenu: boolean;
    filteredAgents: ProjectAgent[];
    selectedAgentIndex: number;
    onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    onSendMessage: () => void;
    onSelectAgent: (agent: ProjectAgent) => void;
}

// Agent mention dropdown component
const AgentMentionDropdown = ({
    agents,
    selectedIndex,
    onSelect,
}: {
    agents: ProjectAgent[];
    selectedIndex: number;
    onSelect: (agent: ProjectAgent) => void;
}) => {
    return (
        <div className="absolute bottom-full left-0 mb-1 w-64 max-h-48 overflow-y-auto bg-popover border border-border rounded-md shadow-md z-50">
            <div className="p-1">
                {agents.map((agent, index) => (
                    <button
                        key={agent.pubkey}
                        type="button"
                        onClick={() => onSelect(agent)}
                        onMouseDown={(e) => e.preventDefault()} // Prevent blur on click
                        className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 transition-colors ${
                            index === selectedIndex
                                ? "bg-accent text-accent-foreground"
                                : "hover:bg-accent/50"
                        }`}
                    >
                        <AtSign className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{agent.name}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export const ChatInputArea = forwardRef<HTMLTextAreaElement, ChatInputAreaProps>(
    (
        {
            messageInput,
            isSending,
            placeholder,
            showAgentMenu,
            filteredAgents,
            selectedAgentIndex,
            onInputChange,
            onKeyDown,
            onSendMessage,
            onSelectAgent,
        },
        ref
    ) => {
        return (
            <div className="border-t border-border bg-card p-3 sm:p-4">
                <div className="flex gap-2 items-end">
                    <div className="flex-1 relative">
                        <Textarea
                            ref={ref}
                            value={messageInput}
                            onChange={onInputChange}
                            onKeyDown={onKeyDown}
                            placeholder={placeholder}
                            className="resize-none min-h-[40px] max-h-[120px] text-sm"
                            rows={1}
                            disabled={isSending}
                        />

                        {/* Agent mention dropdown */}
                        {showAgentMenu && filteredAgents.length > 0 && (
                            <AgentMentionDropdown
                                agents={filteredAgents}
                                selectedIndex={selectedAgentIndex}
                                onSelect={onSelectAgent}
                            />
                        )}
                    </div>
                    <Button
                        onClick={onSendMessage}
                        disabled={!messageInput.trim() || isSending}
                        size="sm"
                        className="px-3 py-2 h-10"
                    >
                        {isSending ? (
                            <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                    </Button>
                </div>
            </div>
        );
    }
);

ChatInputArea.displayName = "ChatInputArea";
