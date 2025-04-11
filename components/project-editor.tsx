"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast"; // Assuming useToast is here
import { Loader2, Undo2, Wand2 } from "lucide-react"; // Icons

interface ProjectEditorProps {
    initialContent: string;
    projectName: string; // Added
    projectTagline: string; // Added
    onContentChange: (newContent: string) => void; // Callback for parent
}

export function ProjectEditor({
    initialContent,
    projectName,
    projectTagline,
    onContentChange,
}: ProjectEditorProps) {
    const [content, setContent] = useState(initialContent);
    const [previousContent, setPreviousContent] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isAiContent, setIsAiContent] = useState(false); // Track if current content is from AI
    const { toast } = useToast();

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newContent = e.target.value;
        setContent(newContent);
        setIsAiContent(false); // Manual edit resets AI content flag
        setPreviousContent(null); // Clear previous content on manual edit
        onContentChange(newContent); // Notify parent
    };

    const handleImproveSpec = async () => {
        setIsLoading(true);
        setPreviousContent(content); // Store current content for undo
        setIsAiContent(false); // Reset flag before new attempt

        try {
            const response = await fetch("/api/run?cmd=improve-project-spec", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: projectName,
                    tagline: projectTagline,
                    productSpec: content,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: "Failed to parse error response" }));
                throw new Error(errorData.error || `API request failed with status ${response.status}`);
            }

            // API returns plain text if output wasn't valid JSON
            const improvedSpec = await response.text();

            if (improvedSpec) {
                 setContent(improvedSpec);
                 setIsAiContent(true); // Mark content as AI-generated
                 onContentChange(improvedSpec); // Notify parent
                 toast({
                    title: "Specification Improved",
                    description: "The product specification has been updated by AI.",
                });
            } else {
                 throw new Error("Received empty response from AI.");
            }

        } catch (error: any) {
            console.error("Failed to improve spec:", error);
            toast({
                variant: "destructive",
                title: "Improvement Failed",
                description: error.message || "An unexpected error occurred.",
            });
            // Optionally restore previous content on failure?
            // setContent(previousContent ?? initialContent);
            setPreviousContent(null); // Clear undo state on failure
        } finally {
            setIsLoading(false);
        }
    };

    const handleUndo = () => {
        if (previousContent !== null) {
            setContent(previousContent);
            onContentChange(previousContent); // Notify parent
            setIsAiContent(false);
            setPreviousContent(null); // Clear undo state after undoing
            toast({
                title: "Undo Successful",
                description: "Reverted to the previous specification.",
            });
        }
    };

    // In a real implementation, this would use TipTap or another WYSIWYG editor
    // For this example, we're using a simple textarea
    return (
        <div className="space-y-4">
             <div className="flex justify-end space-x-2">
                 {isAiContent && !isLoading && previousContent !== null && (
                     <Button variant="outline" size="sm" onClick={handleUndo}>
                         <Undo2 className="mr-2 h-4 w-4" />
                         Undo AI Improvement
                     </Button>
                 )}
                 <Button
                    onClick={handleImproveSpec}
                    disabled={isLoading}
                    size="sm"
                 >
                    {isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                         <Wand2 className="mr-2 h-4 w-4" />
                    )}
                    Improve with AI
                </Button>
            </div>
            <Textarea
                value={content}
                onChange={handleContentChange}
                placeholder="Describe your project specification here..."
                className="min-h-[500px] font-mono rounded-md border-border focus-visible:ring-ring"
                disabled={isLoading} // Disable textarea while loading
            />
        </div>
    );
}
