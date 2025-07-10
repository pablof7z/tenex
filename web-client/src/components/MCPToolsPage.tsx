import { useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { useState } from "react";
import { useMCPToolActions } from "../hooks/useMCPToolActions";
import { useMCPToolForm } from "../hooks/useMCPToolForm";
import { NDKMCPTool } from "@tenex/cli/events";
import { MCPToolList } from "./mcp/MCPToolList";
import { MCPToolMainContent } from "./mcp/MCPToolMainContent";
import { MCPToolDetailPage } from "./mcp/MCPToolDetailPage";

interface MCPToolsPageProps {
    onBack: () => void;
}

export function MCPToolsPage({ onBack }: MCPToolsPageProps) {
    const [selectedTool, setSelectedTool] = useState<NDKMCPTool | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [showDetailView, setShowDetailView] = useState(false);

    // Custom hooks
    const {
        data: formData,
        reset,
        loadMCPTool,
        saveMCPTool,
        updateField,
        addTag,
        removeTag,
    } = useMCPToolForm();

    const { copiedId, copyToolId, deleteTool } = useMCPToolActions();

    // Fetch MCP tool events (kind 4200)
    const { events: tools } = useSubscribe<NDKMCPTool>(
        [{ kinds: [NDKMCPTool.kind], limit: 100 }],
        { wrap: true },
        []
    );

    const handleToolSelect = (tool: NDKMCPTool) => {
        setSelectedTool(tool);
        setIsEditing(false);
        setIsCreatingNew(false);
        setShowDetailView(true);
    };

    const handleBackFromDetail = () => {
        setShowDetailView(false);
        setSelectedTool(null);
    };

    const handleCreateNew = () => {
        setSelectedTool(null);
        setIsCreatingNew(true);
        setIsEditing(true);
        setShowDetailView(false);
        reset();
    };

    const handleEdit = () => {
        if (selectedTool) {
            loadMCPTool(selectedTool);
            setIsEditing(true);
            setShowDetailView(false);
        }
    };

    const handleSave = async () => {
        const success = await saveMCPTool(selectedTool, isCreatingNew);
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

    const handleCopyToolId = (tool: NDKMCPTool) => {
        copyToolId(tool);
    };

    const handleDeleteTool = (tool: NDKMCPTool) => {
        deleteTool(tool, () => {
            // Clear selection if the deleted tool was selected
            if (selectedTool?.id === tool.id) {
                setSelectedTool(null);
                setIsEditing(false);
                setIsCreatingNew(false);
                setShowDetailView(false);
            }
        });
    };

    return (
        <div className="h-screen bg-background flex flex-col md:flex-row">
            {/* Left Sidebar - MCP Tools List */}
            <MCPToolList
                tools={tools}
                selectedTool={selectedTool}
                onBack={onBack}
                onToolSelect={handleToolSelect}
                onCreateNew={handleCreateNew}
            />

            {/* Main Content - MCP Tool Details */}
            {showDetailView && selectedTool ? (
                <MCPToolDetailPage
                    tool={selectedTool}
                    onBack={handleBackFromDetail}
                    onEdit={handleEdit}
                />
            ) : (
                <MCPToolMainContent
                    selectedTool={selectedTool}
                    isCreatingNew={isCreatingNew}
                    isEditing={isEditing}
                    copiedId={copiedId}
                    formData={formData}
                    onEdit={handleEdit}
                    onCancel={handleCancel}
                    onSave={handleSave}
                    onCopyToolId={handleCopyToolId}
                    onDeleteTool={handleDeleteTool}
                    onFormChange={(field, value) => updateField(field, value)}
                    onAddTag={addTag}
                    onRemoveTag={removeTag}
                />
            )}
        </div>
    );
}