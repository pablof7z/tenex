import type { LoadedProject } from "@/hooks/useProjects";
import { NDKProject } from "@/lib/nostr/events/project";
import { MessageSquare, Users } from "lucide-react";

interface ProjectStatCardsProps {
    project: LoadedProject;
}

export function ProjectStatCards({ project }: ProjectStatCardsProps) {
    return (
        <div className="grid grid-cols-2 gap-4 mb-6 md:hidden">
            <div className="stat-card p-3">
                <div className="flex items-center justify-between mb-1">
                    <Users className="h-4 w-4" />
                    <span className="text-xs text-muted-foreground">Community</span>
                </div>
                {/* <div className="text-2xl font-medium text-center">{project.peopleTalking || 0}</div> */}
                <div className="text-2xl font-medium text-center">0</div> {/* Placeholder */}
                <div className="text-xs text-center text-muted-foreground">People Talking</div>
            </div>
            <div className="stat-card p-3">
                <div className="flex items-center justify-between mb-1">
                    <MessageSquare className="h-4 w-4" />
                    <span className="text-xs text-muted-foreground">Tasks</span>
                </div>
                {/* <div className="text-2xl font-medium text-center">{project.pendingTasks || 0}</div> */}
                <div className="text-2xl font-medium text-center">0</div> {/* Placeholder */}
                <div className="text-xs text-center text-muted-foreground">Pending</div>
            </div>
        </div>
    );
}
