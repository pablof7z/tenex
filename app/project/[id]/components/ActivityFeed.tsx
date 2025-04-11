import { useState } from "react";
import { MessageSquare, Plus, Repeat, Send, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Activity, QuoteData } from "./types";

interface ActivityFeedProps {
    activities?: Activity[];
    onCreatePost: () => void;
    onReply: (activityId: string, content: string) => void;
    onRepost: (activityId: string) => void;
    onQuote: (quoteData: QuoteData) => void;
    onZap: (activityId: string) => void;
}

export function ActivityFeed({ activities = [], onCreatePost, onReply, onRepost, onQuote, onZap }: ActivityFeedProps) {
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyContent, setReplyContent] = useState("");

    // Function to format sats amount
    const formatSats = (sats: number) => {
        if (sats >= 1000) {
            return `${(sats / 1000).toFixed(1)}k`;
        }
        return sats.toString();
    };

    const handleSendReply = (activityId: string) => {
        onReply(activityId, replyContent);
        setReplyContent("");
        setReplyingTo(null);
    };

    return (
        <Card className="rounded-md border-border">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">Activity Feed</CardTitle>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-md hover:bg-secondary"
                        onClick={onCreatePost}
                    >
                        <Plus className="h-4 w-4" />
                        <span className="sr-only">Create post</span>
                    </Button>
                </div>
                <CardDescription>Updates from the project agent</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {activities.length > 0 ? (
                        activities.map((activity) => (
                            <div key={activity.id} className="border-b border-border pb-3 last:border-0">
                                <div className="flex items-start gap-3">
                                    <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                                        <Sparkles className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm">{activity.content}</p>
                                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                            <span className="font-medium">{activity.author}</span>
                                            <span>•</span>
                                            <span>{activity.timestamp}</span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-2">
                                            {replyingTo === activity.id ? (
                                                <div className="mt-3 space-y-2 w-full">
                                                    <Textarea
                                                        placeholder="Write your reply..."
                                                        className="min-h-[80px] rounded-md border-border focus-visible:ring-ring"
                                                        value={replyContent}
                                                        onChange={(e) => setReplyContent(e.target.value)}
                                                    />
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setReplyingTo(null)}
                                                            className="rounded-md"
                                                        >
                                                            Cancel
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            className="rounded-md"
                                                            onClick={() => handleSendReply(activity.id)}
                                                        >
                                                            <Send className="mr-2 h-3 w-3" />
                                                            Send
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="rounded-md hover:bg-secondary h-8 px-2"
                                                        onClick={() => setReplyingTo(activity.id)}
                                                    >
                                                        <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                                                        Reply
                                                    </Button>

                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="rounded-md hover:bg-secondary h-8 px-2"
                                                            >
                                                                <Repeat className="h-3.5 w-3.5 mr-1.5" />
                                                                {activity.reposts > 0 && (
                                                                    <span className="text-xs">{activity.reposts}</span>
                                                                )}
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-48 p-2">
                                                            <div className="grid gap-1">
                                                                <Button
                                                                    variant="ghost"
                                                                    className="justify-start h-8 px-2 text-sm"
                                                                    onClick={() => onRepost(activity.id)}
                                                                >
                                                                    <Repeat className="h-3.5 w-3.5 mr-2" />
                                                                    Repost
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    className="justify-start h-8 px-2 text-sm"
                                                                    onClick={() =>
                                                                        onQuote({
                                                                            id: activity.id,
                                                                            content: activity.content,
                                                                            author: activity.author,
                                                                        })
                                                                    }
                                                                >
                                                                    <MessageSquare className="h-3.5 w-3.5 mr-2" />
                                                                    Quote
                                                                </Button>
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>

                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="rounded-md hover:bg-secondary h-8 px-2"
                                                        onClick={() => onZap(activity.id)}
                                                    >
                                                        <Zap className="h-3.5 w-3.5 mr-1.5" />
                                                        <span className="text-xs">{formatSats(activity.zaps)}</span>
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-6 text-muted-foreground">
                            No activity yet. Create your first post!
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
