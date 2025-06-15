import type { NDKKind } from "@nostr-dev-kit/ndk";
import { useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { useState } from "react";
import { useAgentActions } from "../hooks/useAgentActions";
import { useAgentForm } from "../hooks/useAgentForm";
import { NDKAgent } from "../lib/ndk-setup";
import { AgentList } from "./agents/AgentList";
import { AgentMainContent } from "./agents/AgentMainContent";

interface AgentsPageProps {
    onBack: () => void;
}

export function AgentsPage({ onBack }: AgentsPageProps) {
    const [selectedAgent, setSelectedAgent] = useState<NDKAgent | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isCreatingNew, setIsCreatingNew] = useState(false);

    // Custom hooks
    const { formData, reset, loadAgent, saveAgent, updateField, addTag, removeTag } =
        useAgentForm();

    const { copiedId, copyAgentId, deleteAgent } = useAgentActions();

    // Fetch agent events (kind 4199)
    const { events: agents } = useSubscribe<NDKAgent>(
        [{ kinds: NDKAgent.kinds, limit: 100 }],
        { wrap: true },
        []
    );

    // Fetch lessons for selected agent (kind 4124)
    const { events: lessons } = useSubscribe(
        selectedAgent ? [{ kinds: [4124 as NDKKind], "#e": [selectedAgent.id] }] : false,
        {},
        [selectedAgent?.id]
    );

    const handleAgentSelect = (agent: NDKAgent) => {
        setSelectedAgent(agent);
        setIsEditing(false);
        setIsCreatingNew(false);
    };

    const handleCreateNew = () => {
        setSelectedAgent(null);
        setIsCreatingNew(true);
        setIsEditing(true);
        reset();
    };

    const handleEdit = () => {
        if (selectedAgent) {
            loadAgent(selectedAgent);
            setIsEditing(true);
        }
    };

    const handleSave = async () => {
        const success = await saveAgent(selectedAgent, isCreatingNew);
        if (success) {
            setIsEditing(false);
            setIsCreatingNew(false);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setIsCreatingNew(false);
        reset();
    };

    const handleCopyAgentId = (agent: NDKAgent) => {
        copyAgentId(agent);
    };

    const handleDeleteAgent = (agent: NDKAgent) => {
        deleteAgent(agent, () => {
            // Clear selection if the deleted agent was selected
            if (selectedAgent?.id === agent.id) {
                setSelectedAgent(null);
                setIsEditing(false);
                setIsCreatingNew(false);
            }
        });
    };

    return (
        <div className="h-screen bg-background flex">
            {/* Left Sidebar - Agents List */}
            <AgentList
                agents={agents}
                selectedAgent={selectedAgent}
                onBack={onBack}
                onAgentSelect={handleAgentSelect}
                onCreateNew={handleCreateNew}
            />

            {/* Main Content - Agent Details */}
            <AgentMainContent
                selectedAgent={selectedAgent}
                isCreatingNew={isCreatingNew}
                isEditing={isEditing}
                lessons={lessons}
                copiedId={copiedId}
                formData={formData}
                onEdit={handleEdit}
                onCancel={handleCancel}
                onSave={handleSave}
                onCopyAgentId={handleCopyAgentId}
                onDeleteAgent={handleDeleteAgent}
                onFormChange={(field, value) => updateField(field as keyof typeof formData, value)}
                onAddTag={addTag}
                onRemoveTag={removeTag}
            />
        </div>
    );
}
