import type { NDKAgentLesson } from "../../../../tenex/src/events/NDKAgentLesson.ts";
import { Bot } from "lucide-react";
import type { NDKAgent } from "../../lib/ndk-setup";
import { AgentDetail } from "./AgentDetail";
import { AgentForm } from "./AgentForm";
import { AgentHeader } from "./AgentHeader";

interface AgentMainContentProps {
    selectedAgent: NDKAgent | null;
    isCreatingNew: boolean;
    isEditing: boolean;
    lessons: NDKAgentLesson[];
    copiedId: string | null;
    formData: {
        title: string;
        description: string;
        role: string;
        useCriteria: string;
        instructions: string;
        tags: string[];
        newTag: string;
    };
    onEdit: () => void;
    onCancel: () => void;
    onSave: () => void;
    onCopyAgentId: (agent: NDKAgent) => void;
    onDeleteAgent: (agent: NDKAgent) => void;
    onFormChange: (field: string, value: string) => void;
    onAddTag: () => void;
    onRemoveTag: (tag: string) => void;
}

export function AgentMainContent({
    selectedAgent,
    isCreatingNew,
    isEditing,
    lessons,
    copiedId,
    formData,
    onEdit,
    onCancel,
    onSave,
    onCopyAgentId,
    onDeleteAgent,
    onFormChange,
    onAddTag,
    onRemoveTag,
}: AgentMainContentProps) {
    if (!selectedAgent && !isCreatingNew) {
        return (
            <div className="flex-1 flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 mx-auto">
                        <span className="text-2xl">🤖</span>
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">Select an Agent</h3>
                    <p className="text-muted-foreground">
                        Choose an agent from the sidebar to view its definition, or create a new one
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col">
            {/* Header */}
            <AgentHeader
                isCreatingNew={isCreatingNew}
                isEditing={isEditing}
                selectedAgent={selectedAgent}
                copiedId={copiedId}
                formTitle={formData.title}
                onEdit={onEdit}
                onCancel={onCancel}
                onSave={onSave}
                onCopyAgentId={onCopyAgentId}
                onDeleteAgent={onDeleteAgent}
            />

            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-background">
                {isEditing ? (
                    <AgentForm
                        formData={formData}
                        onFormChange={onFormChange}
                        onAddTag={onAddTag}
                        onRemoveTag={onRemoveTag}
                    />
                ) : (
                    <div className="max-w-2xl mx-auto p-4 md:p-6 lg:p-8">
                        {isCreatingNew ? (
                            <div className="text-center py-12">
                                <Bot className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                                <p className="text-muted-foreground text-lg">
                                    Fill out the form above to create your agent
                                </p>
                            </div>
                        ) : selectedAgent ? (
                            <AgentDetail agent={selectedAgent} lessons={lessons} />
                        ) : (
                            <div className="text-center py-12">
                                <Bot className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                                <p className="text-muted-foreground text-lg">No agent selected</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
