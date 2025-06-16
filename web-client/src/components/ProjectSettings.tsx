import { NDKProject, useNDK } from "@nostr-dev-kit/ndk-hooks";
import { ArrowLeft, FileText, Info, Settings, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../lib/utils";
import { AgentsSettings } from "./settings/AgentsSettings";
import { MetadataSettings } from "./settings/MetadataSettings";
import { RulesSettings } from "./settings/RulesSettings";
import { Button } from "./ui/button";

interface ProjectSettingsProps {
    project: NDKProject | null;
    onBack: () => void;
    onProjectUpdated?: () => void;
}

type SettingsTab = "metadata" | "agents" | "rules";

export function ProjectSettings({ project, onBack, onProjectUpdated }: ProjectSettingsProps) {
    const { ndk } = useNDK();
    const [activeTab, setActiveTab] = useState<SettingsTab>("metadata");
    const [hasChanges, setHasChanges] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    // Clone the project for editing
    const [editedProject, setEditedProject] = useState<NDKProject | null>(null);

    useEffect(() => {
        if (project && ndk) {
            const cloned = new NDKProject(ndk);
            cloned.tags = [...project.tags];
            cloned.title = project.title;
            cloned.content = project.content;
            cloned.hashtags = project.hashtags ? [...project.hashtags] : [];
            cloned.repo = project.repo;
            cloned.picture = project.picture;
            setEditedProject(cloned);
        }
    }, [project, ndk]);

    if (!project || !editedProject) return null;

    const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
        { id: "metadata", label: "Metadata", icon: <Info className="w-4 h-4" /> },
        { id: "agents", label: "Agents", icon: <Users className="w-4 h-4" /> },
        { id: "rules", label: "Rules", icon: <FileText className="w-4 h-4" /> },
    ];

    const handleSaveAll = async () => {
        if (!hasChanges || isUpdating || !editedProject) return;

        setIsUpdating(true);
        try {
            // Preserve the 'd' tag
            const dTag = project.tagValue("d");
            if (dTag) {
                editedProject.removeTag("d");
                editedProject.tags.push(["d", dTag]);
            }

            // Publish the edited project
            await editedProject.publish();

            setHasChanges(false);
            onProjectUpdated?.();
        } catch (_error) {
            // console.error("Failed to save project settings:", error);
        } finally {
            setIsUpdating(false);
        }
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case "metadata":
                return (
                    <MetadataSettings
                        project={project}
                        editedProject={editedProject}
                        onProjectChanged={() => setHasChanges(true)}
                    />
                );
            case "agents":
                return (
                    <AgentsSettings
                        project={project}
                        editedProject={editedProject}
                        onProjectChanged={() => setHasChanges(true)}
                    />
                );
            case "rules":
                return (
                    <RulesSettings
                        project={project}
                        editedProject={editedProject}
                        onProjectChanged={() => setHasChanges(true)}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-50">
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onBack}
                            className="w-9 h-9 text-slate-700 hover:bg-slate-100 lg:hidden"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div className="flex items-center gap-2">
                            <Settings className="w-5 h-5 text-slate-600" />
                            <h1 className="text-lg font-semibold text-slate-900">
                                Project Settings
                            </h1>
                        </div>
                    </div>
                    {hasChanges && (
                        <Button
                            variant="primary"
                            onClick={handleSaveAll}
                            disabled={isUpdating}
                            size="sm"
                        >
                            {isUpdating ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                    Saving
                                </>
                            ) : (
                                <>Save</>
                            )}
                        </Button>
                    )}
                </div>

                {/* Tab Navigation */}
                <div className="flex border-t border-slate-200">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
                                "border-b-2 hover:bg-slate-50",
                                activeTab === tab.id
                                    ? "border-blue-600 text-blue-600"
                                    : "border-transparent text-slate-600 hover:text-slate-900"
                            )}
                        >
                            {tab.icon}
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">{renderTabContent()}</div>
        </div>
    );
}
