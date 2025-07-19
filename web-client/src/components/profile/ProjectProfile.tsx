import { useParams } from "react-router-dom";
import { useProject } from "../../hooks/useProject";
import { useNavigation } from "../../contexts/NavigationContext";
import { ProjectProfileHeader } from "./ProjectProfileHeader";
import { ProjectProfileNav } from "./ProjectProfileNav";
import { ProjectProfileContent } from "./ProjectProfileContent";
import { useState } from "react";

export type ProjectProfileTab = "home" | "agents" | "docs";

export function ProjectProfile() {
    const { projectId } = useParams<{ projectId: string }>();
    const { goBack } = useNavigation();
    const [activeTab, setActiveTab] = useState<ProjectProfileTab>("home");
    
    const project = useProject(projectId);

    if (!project) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading project...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <ProjectProfileHeader project={project} onBack={goBack} />
            
            <div className="max-w-6xl mx-auto flex">
                <ProjectProfileNav 
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />
                
                <ProjectProfileContent 
                    project={project}
                    activeTab={activeTab}
                />
            </div>
        </div>
    );
}