import type { NDKProject } from "@nostr-dev-kit/ndk-hooks";
import { ArrowLeft, Edit2 } from "lucide-react";
import { Button } from "../ui/button";
import { ParticipantAvatar } from "../common/ParticipantAvatar";
import { useState } from "react";
import { EditProjectModal } from "../dialogs/EditProjectModal";

interface ProjectProfileHeaderProps {
    project: NDKProject;
    onBack: () => void;
}

export function ProjectProfileHeader({ project, onBack }: ProjectProfileHeaderProps) {
    const [showEditModal, setShowEditModal] = useState(false);

    return (
        <>
            <div className="border-b border-border bg-card">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between py-4">
                        <div className="flex items-center space-x-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onBack}
                                className="flex items-center space-x-2"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <span>Back</span>
                            </Button>
                            
                            <div className="flex items-center space-x-3">
                                <ParticipantAvatar 
                                    pubkey={project.author.pubkey}
                                    className="w-12 h-12 flex-shrink-0"
                                />
                                <div>
                                    <h1 className="text-xl font-semibold text-foreground">
                                        {project.title || "Untitled Project"}
                                    </h1>
                                    <p className="text-sm text-muted-foreground">
                                        Created by {project.author.profile?.displayName || project.author.npub}
                                    </p>
                                </div>
                            </div>
                        </div>
                        
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowEditModal(true)}
                            className="flex items-center space-x-2"
                        >
                            <Edit2 className="w-4 h-4" />
                            <span>Edit</span>
                        </Button>
                    </div>
                    
                    {project.description && (
                        <div className="pb-4">
                            <p className="text-muted-foreground max-w-2xl">
                                {project.description}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <EditProjectModal
                project={project}
                open={showEditModal}
                onOpenChange={setShowEditModal}
                onProjectUpdated={() => {
                    setShowEditModal(false);
                }}
            />
        </>
    );
}