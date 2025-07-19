import type { NDKProject } from "@nostr-dev-kit/ndk-hooks";
import type { ProjectProfileTab } from "./ProjectProfile";
import { HomeTabContent } from "./HomeTabContent";
import { AgentsTabContent } from "./AgentsTabContent";
import { DocsTabContent } from "./DocsTabContent";

interface ProjectProfileContentProps {
    project: NDKProject;
    activeTab: ProjectProfileTab;
}

export function ProjectProfileContent({ project, activeTab }: ProjectProfileContentProps) {
    return (
        <main className="flex-1 px-4 py-6">
            <div className="max-w-2xl">
                {activeTab === "home" && <HomeTabContent project={project} />}
                {activeTab === "agents" && <AgentsTabContent project={project} />}
                {activeTab === "docs" && <DocsTabContent project={project} />}
            </div>
        </main>
    );
}