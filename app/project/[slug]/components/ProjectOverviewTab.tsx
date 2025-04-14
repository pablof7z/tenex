"use client";

import React from "react";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk-hooks";
import { ActivityFeed } from "@/components/ActivityFeed";
import { RelatedTweets } from "./RelatedTweets";
import { LoadedProject } from "@/hooks/useProjects";

interface ProjectOverviewTabProps {
    project: LoadedProject;
}

export function ProjectOverviewTab({
    project,
}: ProjectOverviewTabProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Adjusted grid to 2 cols */}
            {project.signer && (
                <ActivityFeed
                    pubkeys={[project.pubkey]}
                    signer={project.signer}
                />
            )}
            <RelatedTweets project={project} />
        </div>
    );
}
