"use client";

import React from "react";
import { NDKProject } from "@/lib/nostr/events/project";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk-hooks";
import { ActivityFeed } from "./ActivityFeed";
import { RelatedTweets } from "./RelatedTweets";
import { QuoteData } from "@/components/events/note/card";

interface ProjectOverviewTabProps {
    project: NDKProject;
    projectSigner: NDKPrivateKeySigner | null;
    // onReply, onRepost, onQuote, onZap removed - handled by child components (NoteCard)
}

export function ProjectOverviewTab({
    project,
    projectSigner,
    // onReply, onRepost, onQuote, onZap removed from destructuring
}: ProjectOverviewTabProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Adjusted grid to 2 cols */}
            {projectSigner && (
                <ActivityFeed
                    project={project}
                    signer={projectSigner}
                    // onReply, onRepost, onZap removed - handled by NoteCard internally
                />
            )}
            {!projectSigner && <div className="text-muted-foreground">Activity feed requires project signer.</div>}
            {/* Keep onReply for now as RelatedTweets has its own reply UI */}
            {/* If NoteCard's internal reply is sufficient, remove onReply here too */}
            <RelatedTweets project={project} onReply={() => { /* Placeholder if needed, or remove if NoteCard handles all replies */ }} />
        </div>
    );
}
