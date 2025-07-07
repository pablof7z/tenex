import { useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { useState } from "react";
import { useAgentActions } from "../hooks/useAgentActions";
import { useAgentForm } from "../hooks/useAgentForm";
import { NDKAgent } from "../lib/ndk-setup";
import { AgentList } from "./agents/AgentList";
import { AgentMainContent } from "./agents/AgentMainContent";
import { AgentDetailPage } from "./agents/AgentDetailPage";

interface AgentsPageProps {
    onBack: () => void;
}

export function AgentsPage({ onBack }: AgentsPageProps) {
    const [selectedAgent, setSelectedAgent] = useState<NDKAgent | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [showDetailView, setShowDetailView] = useState(false);

    // Custom hooks
    const {
        data: formData,
        reset,
        loadAgent,
        saveAgent,
        updateField,
        addTag,
        removeTag,
    } = useAgentForm();

    const { copiedId, copyAgentId, deleteAgent } = useAgentActions();

    // Fetch agent events (kind 4199)
    const { events: agents } = useSubscribe<NDKAgent>(
        [{ kinds: NDKAgent.kinds, limit: 100 }],
        { wrap: true },
        []
    );

    const handleAgentSelect = (agent: NDKAgent) => {
        setSelectedAgent(agent);
        setIsEditing(false);
        setIsCreatingNew(false);
        setShowDetailView(true);
    };

    const handleBackFromDetail = () => {
        setShowDetailView(false);
        setSelectedAgent(null);
    };

    const handleCreateNew = () => {
        setSelectedAgent(null);
        setIsCreatingNew(true);
        setIsEditing(true);
        setShowDetailView(false);
        reset();
    };

    const handleEdit = () => {
        if (selectedAgent) {
            loadAgent(selectedAgent);
            setIsEditing(true);
            setShowDetailView(false);
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
                setShowDetailView(false);
            }
        });
    };

    return (
        <div className="h-screen bg-background flex flex-col md:flex-row">
            {/* Left Sidebar - Agents List */}
            <AgentList
                agents={agents}
                selectedAgent={selectedAgent}
                onBack={onBack}
                onAgentSelect={handleAgentSelect}
                onCreateNew={handleCreateNew}
            />

            {/* Main Content - Agent Details */}
            {showDetailView && selectedAgent ? (
                <AgentDetailPage
                    agent={selectedAgent}
                    onBack={handleBackFromDetail}
                    onEdit={handleEdit}
                />
            ) : (
                <AgentMainContent
                    selectedAgent={selectedAgent}
                    isCreatingNew={isCreatingNew}
                    isEditing={isEditing}
                    lessons={[]}
                    copiedId={copiedId}
                    formData={formData}
                    onEdit={handleEdit}
                    onCancel={handleCancel}
                    onSave={handleSave}
                    onCopyAgentId={handleCopyAgentId}
                    onDeleteAgent={handleDeleteAgent}
                    onFormChange={(field, value) => updateField(field, value)}
                    onAddTag={addTag}
                    onRemoveTag={removeTag}
                />
            )}
        </div>
    );
}
