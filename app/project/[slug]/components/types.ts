export interface Activity {
    id: string;
    type: string;
    content: string;
    timestamp: string;
    author: string;
    reposts: number;
    zaps: number;
}

export interface Tweet {
    id: string;
    author: string;
    authorName: string;
    content: string;
    timestamp: string;
    reposts: number;
    zaps: number;
}

export interface Comment {
    id: string;
    author: string;
    authorName: string;
    content: string;
    timestamp: string;
}

export interface Task {
    id: string;
    title: string;
    creator: string;
    creatorName: string;
    createdAt: string;
    references: number;
    comments: Comment[];
}

// ProjectData interface removed as it's replaced by NDKProject
// QuoteData interface removed, import from components/events/note/card.tsx instead
