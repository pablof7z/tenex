import { useNDKCurrentPubkey } from "@nostr-dev-kit/ndk-hooks";
import { Check, Copy, Edit, Save, Trash2, X } from "lucide-react";
import type { NDKAgent } from "../../lib/ndk-setup";
import { Button } from "../ui/button";

interface AgentHeaderProps {
    isCreatingNew: boolean;
    isEditing: boolean;
    selectedAgent: NDKAgent | null;
    copiedId: string | null;
    formTitle: string;
    onEdit: () => void;
    onCancel: () => void;
    onSave: () => void;
    onCopyAgentId: (agent: NDKAgent) => void;
    onDeleteAgent: (agent: NDKAgent) => void;
}

export function AgentHeader({
    isCreatingNew,
    isEditing,
    selectedAgent,
    copiedId,
    formTitle,
    onEdit,
    onCancel,
    onSave,
    onCopyAgentId,
    onDeleteAgent,
}: AgentHeaderProps) {
    const currentPubkey = useNDKCurrentPubkey();
    const isCurrentUserAgent = selectedAgent && selectedAgent.pubkey === currentPubkey;
    return (
        <div className="bg-card border-b border-border px-6 py-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-foreground">
                        {isCreatingNew
                            ? "Create New Agent"
                            : selectedAgent?.title || "Unnamed Agent"}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {isCreatingNew
                            ? "Version 1"
                            : `Version ${selectedAgent?.tagValue("ver") || "1"}`}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {isEditing ? (
                        <>
                            <Button variant="outline" size="sm" onClick={onCancel}>
                                <X className="w-4 h-4 mr-2" />
                                Cancel
                            </Button>
                            <Button size="sm" onClick={onSave} disabled={!formTitle.trim()}>
                                <Save className="w-4 h-4 mr-2" />
                                {isCreatingNew ? "Publish agent" : "Publish new version"}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" size="sm" onClick={onEdit}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                            </Button>
                            {selectedAgent && (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onCopyAgentId(selectedAgent)}
                                        title="Copy agent event ID"
                                    >
                                        {copiedId === selectedAgent.id ? (
                                            <Check className="w-4 h-4 text-green-600" />
                                        ) : (
                                            <Copy className="w-4 h-4" />
                                        )}
                                    </Button>
                                    {isCurrentUserAgent && (
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => onDeleteAgent(selectedAgent)}
                                            title="Delete agent"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
