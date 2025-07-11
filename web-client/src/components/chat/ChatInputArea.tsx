import { AtSign, Mic, Send } from "lucide-react";
import { forwardRef } from "react";
import type { ProjectAgent } from "../../stores/project/hooks";
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
    onVoiceRecord?: () => void;
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
                {agents.length > 0 ? (
                    agents.map((agent, index) => (
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
                    ))
                ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                        No agents available
                    </div>
                )}
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
            onVoiceRecord,
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
                            className="resize-none min-h-[40px] max-h-[50vh] overflow-y-auto text-sm"
                            rows={1}
                            disabled={isSending}
                        />

                        {/* Agent mention dropdown */}
                        {showAgentMenu && (
                            <AgentMentionDropdown
                                agents={filteredAgents}
                                selectedIndex={selectedAgentIndex}
                                onSelect={onSelectAgent}
                            />
                        )}
                    </div>
                    {onVoiceRecord && (
                        <Button
                            onClick={onVoiceRecord}
                            variant="ghost"
                            size="sm"
                            className="px-3 py-2 h-10"
                            title="Record voice message"
                        >
                            <Mic className="w-4 h-4" />
                        </Button>
                    )}
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
