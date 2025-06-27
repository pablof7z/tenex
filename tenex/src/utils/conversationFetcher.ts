import NDK, { NDKEvent, type NDKUser } from "@nostr-dev-kit/ndk";
import { getProjectContext } from "@/services";
import { isEventFromUser, getAgentSlugFromEvent } from "@/nostr/utils";
import chalk from "chalk";

interface ConversationEvent {
    event: NDKEvent;
    author: string;
    isHuman: boolean;
    timestamp: Date;
    content: string;
    depth: number;
}

interface ConversationTree {
    root: ConversationEvent;
    replies: Map<string, ConversationEvent[]>;
}

export async function fetchConversation(
    neventStr: string,
    ndk: NDK,
    projectPath: string
): Promise<string> {
    // Fetch the event directly using the nevent string
    const initialEvent = await ndk.fetchEvent(neventStr);
    if (!initialEvent) {
        throw new Error(`Event ${neventStr} not found`);
    }
    
    const eventId = initialEvent.id;
    
    // Get project context to identify human user
    const projectCtx = getProjectContext();
    const humanPubkey = projectCtx.project.pubkey;
    
    // Check if this is a reply by looking for "E" tag (uppercase for root reference)
    let rootEventId = eventId;
    const rootTag = initialEvent.tags.find((tag: string[]) => tag[0] === "E");
    if (rootTag && rootTag[1]) {
        rootEventId = rootTag[1];
    }
    
    // Always fetch fresh from relays (ignore cache)
    const events = await fetchConversationFromRelays(ndk, rootEventId, initialEvent);
    
    // Fetch profiles for all participants
    const participants = await fetchParticipantProfiles(events, ndk, projectCtx);
    
    // Build conversation tree
    const tree = buildConversationTree(events, participants, humanPubkey);
    
    // Format as markdown
    return formatConversationMarkdown(tree, humanPubkey);
}

async function fetchConversationFromRelays(
    ndk: NDK,
    rootEventId: string,
    initialEvent?: NDKEvent
): Promise<NDKEvent[]> {
    const events: NDKEvent[] = [];
    
    // Fetch root event if we don't have it
    if (!initialEvent || initialEvent.id !== rootEventId) {
        const rootEvent = await ndk.fetchEvent(rootEventId);
        if (rootEvent) {
            events.push(rootEvent);
        }
    } else {
        events.push(initialEvent);
    }
    
    // Fetch all replies (kind 1111 with "E" tag pointing to root)
    const replies = await ndk.fetchEvents({
        kinds: [1111],
        "#E": [rootEventId]
    });
    
    // Also fetch other conversation-related events (lowercase e tags)
    const otherReplies = await ndk.fetchEvents({
        "#e": [rootEventId]
    });
    
    // Fetch task-related events
    const taskReplies = await ndk.fetchEvents({
        kinds: [30231 as any], // NDKTask.kind
        "#e": [rootEventId]
    });
    
    // Combine all events
    events.push(...Array.from(replies) as NDKEvent[]);
    events.push(...Array.from(otherReplies) as NDKEvent[]);
    events.push(...Array.from(taskReplies) as NDKEvent[]);
    
    // Remove duplicates
    const uniqueEvents = Array.from(new Map(events.map(e => [e.id, e])).values());
    
    // Sort by created_at
    uniqueEvents.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    
    return uniqueEvents;
}

async function fetchParticipantProfiles(
    events: NDKEvent[],
    ndk: NDK,
    projectCtx: any
): Promise<Map<string, string>> {
    const participants = new Map<string, string>();
    const pubkeys = new Set<string>();
    
    // Collect unique pubkeys
    for (const event of events) {
        if (event.pubkey) {
            pubkeys.add(event.pubkey);
        }
    }
    
    // Fetch profiles
    for (const pubkey of pubkeys) {
        // Check if it's an agent first
        const agentSlug = getAgentSlugFromEvent({ pubkey } as NDKEvent);
        if (agentSlug) {
            const agent = projectCtx.agents.get(agentSlug);
            if (agent) {
                participants.set(pubkey, `@${agent.name}`);
                continue;
            }
        }
        
        // Fetch from nostr
        try {
            const user = ndk.getUser({ pubkey });
            await user.fetchProfile();
            const profile = user.profile;
            const name = profile?.displayName || profile?.name || pubkey.slice(0, 8) + "...";
            participants.set(pubkey, `@${name}`);
        } catch {
            participants.set(pubkey, `@${pubkey.slice(0, 8)}...`);
        }
    }
    
    return participants;
}

function buildConversationTree(
    events: NDKEvent[],
    participants: Map<string, string>,
    humanPubkey: string
): ConversationTree {
    const eventMap = new Map<string, ConversationEvent>();
    const replies = new Map<string, ConversationEvent[]>();
    let rootEvent: ConversationEvent | null = null;
    
    // First pass: create ConversationEvent objects
    for (const event of events) {
        const conversationEvent: ConversationEvent = {
            event,
            author: participants.get(event.pubkey) || `@${event.pubkey.slice(0, 8)}...`,
            isHuman: event.pubkey === humanPubkey,
            timestamp: new Date((event.created_at || 0) * 1000),
            content: event.content,
            depth: 0
        };
        
        if (event.id) {
            eventMap.set(event.id, conversationEvent);
        }
        
        // Find parent
        const parentTag = event.tags.find((tag: string[]) => tag[0] === "e");
        const rootTag = event.tags.find((tag: string[]) => tag[0] === "E");
        
        if (!parentTag && !rootTag) {
            // This is the root
            rootEvent = conversationEvent;
        }
    }
    
    // Second pass: build reply structure
    for (const event of events) {
        if (!event.id) continue;
        const conversationEvent = eventMap.get(event.id);
        if (!conversationEvent) continue;
        const parentTag = event.tags.find((tag: string[]) => tag[0] === "e");
        
        if (parentTag) {
            const parentId = parentTag[1];
            if (parentId && !replies.has(parentId)) {
                replies.set(parentId, []);
            }
            if (parentId) {
                replies.get(parentId)!.push(conversationEvent);
            }
        } else if (rootEvent && event.id !== rootEvent.event.id) {
            // Direct reply to root
            const rootId = rootEvent.event.id;
            if (rootId && !replies.has(rootId)) {
                replies.set(rootId, []);
            }
            if (rootId) {
                replies.get(rootId)!.push(conversationEvent);
            }
        }
    }
    
    // Calculate depths
    function setDepth(event: ConversationEvent, depth: number) {
        event.depth = depth;
        const eventReplies = event.event.id ? (replies.get(event.event.id) || []) : [];
        for (const reply of eventReplies) {
            setDepth(reply, depth + 1);
        }
    }
    
    if (rootEvent) {
        setDepth(rootEvent, 0);
    }
    
    return {
        root: rootEvent || eventMap.values().next().value!,
        replies
    };
}

function formatConversationMarkdown(tree: ConversationTree, humanPubkey: string): string {
    const lines: string[] = [];
    
    lines.push("# Conversation Thread\n");
    
    function formatEvent(event: ConversationEvent, indent: string = "") {
        const authorColor = event.isHuman ? chalk.green : chalk.cyan;
        const timestamp = event.timestamp.toLocaleString();
        
        lines.push(`${indent}${authorColor(event.author)} ${chalk.gray(`[${timestamp}]`)}`);
        
        // Format content with proper indentation
        const contentLines = event.content.split('\n');
        for (const line of contentLines) {
            lines.push(`${indent}${line}`);
        }
        
        lines.push(""); // Empty line between messages
        
        // Format replies
        const eventReplies = event.event.id ? (tree.replies.get(event.event.id) || []) : [];
        for (const reply of eventReplies) {
            formatEvent(reply, indent + "  ");
        }
    }
    
    formatEvent(tree.root);
    
    return lines.join('\n');
}