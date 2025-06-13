import { Bot } from 'lucide-react';
import { NDKAgent } from '../../lib/ndk-setup';
import { AgentDetail } from './AgentDetail';
import { AgentForm } from './AgentForm';
import { AgentHeader } from './AgentHeader';
import type { NDKEvent } from '@nostr-dev-kit/ndk';

interface AgentMainContentProps {
  selectedAgent: NDKAgent | null;
  isCreatingNew: boolean;
  isEditing: boolean;
  lessons: NDKEvent[];
  copiedId: string | null;
  formData: {
    title: string;
    description: string;
    role: string;
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
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 mx-auto">
            <span className="text-2xl">🤖</span>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Select an Agent
          </h3>
          <p className="text-muted-foreground">
            Choose an agent from the sidebar to view its definition, or create a new one
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
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
          <div className="max-w-3xl mx-auto p-8">
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
                <p className="text-muted-foreground text-lg">
                  No agent selected
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}