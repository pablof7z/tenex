import { useState } from 'react';
import { useEvent } from '@nostr-dev-kit/ndk-hooks';
import { NDKArticle } from '@nostr-dev-kit/ndk';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '../ui/drawer';
import { Skeleton } from '../ui/skeleton';
import { FileText, ExternalLink } from 'lucide-react';
import type { NostrEntity } from '../../utils/nostrEntityParser';
import { getEntityDisplayInfo } from '../../utils/nostrEntityParser';
import ReactMarkdown from 'react-markdown';

interface NostrEntityCardProps {
  entity: NostrEntity;
}

export function NostrEntityCard({ entity }: NostrEntityCardProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const displayInfo = getEntityDisplayInfo(entity);
  
  // Fetch the event if it's an article
  const { event, loading } = useEvent(entity.bech32);
  
  const isArticle = entity.type === 'naddr' && entity.data?.kind === 30023;
  
  const handleClick = () => {
    if (isArticle && event) {
      setDrawerOpen(true);
    }
  };
  
  // Get article details if available
  let articleTitle = displayInfo.title;
  let articleSummary = displayInfo.description;
  
  if (isArticle && event) {
    const article = event as NDKArticle;
    articleTitle = article.title || `${entity.data.identifier?.toUpperCase()} Specification`;
    const summaryTag = event.tags.find(tag => tag[0] === 'summary');
    if (summaryTag) {
      articleSummary = summaryTag[1];
    }
  }
  
  return (
    <>
      <Card 
        className="inline-flex items-center gap-2 px-3 py-1.5 my-1 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={handleClick}
      >
        <span className="text-lg">{displayInfo.icon}</span>
        
        {loading ? (
          <div className="space-y-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        ) : (
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm flex items-center gap-1">
              {articleTitle}
              {isArticle && <ExternalLink className="w-3 h-3" />}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {articleSummary}
            </div>
          </div>
        )}
      </Card>
      
      {isArticle && event && (
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader>
              <DrawerTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {articleTitle}
              </DrawerTitle>
            </DrawerHeader>
            
            <div className="px-6 pb-6 overflow-y-auto">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{event.content}</ReactMarkdown>
              </div>
              
              {/* Metadata */}
              <div className="mt-6 pt-6 border-t space-y-2 text-sm text-muted-foreground">
                <div>
                  <span className="font-medium">Event ID:</span> {event.id.substring(0, 16)}...
                </div>
                <div>
                  <span className="font-medium">Published:</span> {new Date((event.created_at || 0) * 1000).toLocaleString()}
                </div>
                {event.tags.find(tag => tag[0] === 'summary') && (
                  <div>
                    <span className="font-medium">Change Summary:</span> {event.tags.find(tag => tag[0] === 'summary')?.[1]}
                  </div>
                )}
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
}