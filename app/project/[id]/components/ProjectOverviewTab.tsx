"use client";

import React from 'react';
import { NDKProject } from '@/lib/nostr/events/project';
import { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk-hooks';
import { ActivityFeed } from './ActivityFeed';
import { RelatedTweets } from './RelatedTweets';
import { QuoteData } from '@/components/events/note/card';

interface ProjectOverviewTabProps {
  project: NDKProject;
  projectSigner: NDKPrivateKeySigner | null;
  // Event Handlers from parent
  // onCreatePost removed as ActivityFeed handles it internally
  onReply: (itemId: string, content: string) => void;
  onRepost: (itemId: string) => void;
  onQuote: (quoteData: QuoteData) => void;
  onZap: (itemId: string) => void;
}

export function ProjectOverviewTab({
  project,
  projectSigner,
  // onCreatePost removed from destructuring
  onReply,
  onRepost,
  onQuote,
  onZap,
}: ProjectOverviewTabProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6"> {/* Adjusted grid to 2 cols */}
      {projectSigner && (
        <ActivityFeed
          project={project}
          signer={projectSigner}
          // onCreatePost prop removed from here
          onReply={onReply}
          onRepost={onRepost}
          onQuote={onQuote}
          onZap={onZap}
        />
      )}
      {/* If no signer, maybe show a placeholder or adjust grid? */}
      {!projectSigner && <div className="text-muted-foreground">Activity feed requires project signer.</div>}

      <RelatedTweets
        project={project}
        onReply={onReply}
        onRepost={onRepost}
        onQuote={onQuote}
        onZap={onZap}
      />
    </div>
  );
}