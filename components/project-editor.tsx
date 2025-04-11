"use client";

import { useState } from "react";

import { Textarea } from "@/components/ui/textarea";

interface ProjectEditorProps {
    initialContent: string;
}

export function ProjectEditor({ initialContent }: ProjectEditorProps) {
    const [content, setContent] = useState(initialContent);

    // In a real implementation, this would use TipTap or another WYSIWYG editor
    // For this example, we're using a simple textarea
    return (
        <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[500px] font-mono rounded-md border-border focus-visible:ring-ring"
        />
    );
}
