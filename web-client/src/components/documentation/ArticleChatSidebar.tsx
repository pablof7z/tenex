import { useState, useEffect, useCallback } from 'react';
import { NDKArticle, NDKEvent, NDKSubscriptionCacheUsage, useNDK, useNDKCurrentUser } from '@nostr-dev-kit/ndk-hooks';
import { ChatInterface } from '../ChatInterface';
import { useProject } from '@/hooks/useProject';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useSubscribe } from '@nostr-dev-kit/ndk-hooks';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ArticleChatSidebarProps {
  project: ReturnType<typeof useProject>;
  article: NDKArticle;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuotedText?: string | null;
  onQuoteHandled?: () => void;
}

export function ArticleChatSidebar({
  project,
  article,
  isOpen,
  onOpenChange,
  initialQuotedText,
  onQuoteHandled
}: ArticleChatSidebarProps) {
  const { ndk } = useNDK();
  const user = useNDKCurrentUser();
  const [threadId, setThreadId] = useState<string>('new');
  const [initialMessage, setInitialMessage] = useState<string>('');
  const [quotedText, setQuotedText] = useState<string | null>(null);

  // Find existing threads for this article
  const { events: existingThreads } = useSubscribe([{
    kinds: [11],
    authors: user ? [user.pubkey] : undefined,
    "#a": [article.tagId()]
  }], {
    cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
    groupable: true
  });

  // Use the most recent existing thread if available
  useEffect(() => {
    if (existingThreads && existingThreads.length > 0) {
      const sortedThreads = [...existingThreads].sort((a, b) => 
        (b.created_at || 0) - (a.created_at || 0)
      );
      setThreadId(sortedThreads[0].id);
    }
  }, [existingThreads]);

  // Handle quoted text
  useEffect(() => {
    console.log('ArticleChatSidebar received initialQuotedText:', initialQuotedText);
    if (initialQuotedText) {
      setQuotedText(initialQuotedText);
      const quotedMessage = `Regarding this section:\n\n> ${initialQuotedText}\n\n`;
      setInitialMessage(quotedMessage);
      onQuoteHandled?.();
    }
  }, [initialQuotedText, onQuoteHandled]);

  // Create the initial thread event with proper tags
  const createThreadEvent = useCallback(() => {
    if (!ndk) return undefined;
    const event = new NDKEvent(ndk);
    event.kind = 11;
    event.tags = [
      ['a', project?.tagId() || ''], // Tag the project
      ['a', article.tagId()], // Tag the article
      ['p', article.pubkey], // Tag only the article author
      ['title', `Discussion: ${article.title || article.name || 'Document'}`]
    ];
    
    // Add preamble to the content
    const preamble = `This discussion is about the spec "${article.title || article.name || 'this document'}" in the ${project?.name || 'project'}.\n\n`;
    event.content = preamble + (initialMessage || '');
    
    return event;
  }, [ndk, project, article, initialMessage]);

  const handleThreadCreated = (threadEvent: NDKEvent) => {
    setThreadId(threadEvent.id);
    setInitialMessage(''); // Clear initial message after thread creation
  };

  if (!isOpen) return null;

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h3 className="font-semibold">Discuss with Author</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Chat about "{article.title || article.name || 'this document'}"
        </p>
      </div>
      
      {/* Quoted Text Display */}
      {quotedText && (
        <div className="mx-4 mt-4 p-3 bg-muted/50 rounded-lg border-l-4 border-primary">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-1">Discussing:</p>
              <p className="text-sm italic break-words">"{quotedText}"</p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={() => {
                setQuotedText(null);
                setInitialMessage('');
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
      
      <div className="flex-1 overflow-hidden">
        {project && (
          <ChatInterface
            project={project}
            threadId={threadId}
            onThreadCreated={handleThreadCreated}
            initialThreadEvent={threadId === 'new' ? createThreadEvent() : undefined}
            initialMessage={initialMessage}
            className="h-full"
          />
        )}
      </div>
    </div>
  );
}

// Mobile-friendly sheet version
export function ArticleChatSheet({
  project,
  article,
  isOpen,
  onOpenChange,
  initialQuotedText,
  onQuoteHandled
}: ArticleChatSidebarProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-96 p-0">
        <ArticleChatSidebar
          project={project}
          article={article}
          isOpen={true}
          onOpenChange={onOpenChange}
          initialQuotedText={initialQuotedText}
          onQuoteHandled={onQuoteHandled}
        />
      </SheetContent>
    </Sheet>
  );
}