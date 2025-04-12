"use client";

import React from 'react';
import { ProjectSettings } from './ProjectSettings';
import { NDKProject } from '@/lib/nostr/events/project';

interface ProjectSettingsTabProps {
  project: NDKProject;
  // Add any other props needed by ProjectSettings or this tab
}

export function ProjectSettingsTab({ project }: ProjectSettingsTabProps) {
  return (
    <ProjectSettings
      project={project}
      // Pass other necessary props if any
    />
  );
}