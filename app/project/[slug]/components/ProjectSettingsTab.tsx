"use client";

import React from "react";
import { ProjectSettings } from "./ProjectSettings";
import { NDKProject } from "@/lib/nostr/events/project";
import { LoadedProject } from "@/hooks/useProjects";

interface ProjectSettingsTabProps {
    project: LoadedProject;
    projectSlug: string;
}

export function ProjectSettingsTab({ project, projectSlug }: ProjectSettingsTabProps) {
    return (
        <ProjectSettings
            project={project}
            projectSlug={projectSlug}
        />
    );
}
