"use client";

import React from "react";
import { ProjectSettings } from "./ProjectSettings";
import { NDKProject } from "@/lib/nostr/events/project";

interface ProjectSettingsTabProps {
    project: NDKProject;
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
