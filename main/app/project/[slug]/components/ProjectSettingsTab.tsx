"use client";

import type { LoadedProject } from "@/hooks/useProjects";
import { NDKProject } from "@/lib/nostr/events/project";
import React from "react";
import { ProjectSettings } from "./ProjectSettings";

interface ProjectSettingsTabProps {
    project: LoadedProject;
    projectSlug: string;
}

export function ProjectSettingsTab({ project, projectSlug }: ProjectSettingsTabProps) {
    return <ProjectSettings project={project} projectSlug={projectSlug} />;
}
