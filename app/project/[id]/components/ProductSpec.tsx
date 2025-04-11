import { useState } from "react"; // Added
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectEditor } from "@/components/project-editor";
import { NDKProject } from "@/lib/nostr/events/project";

interface ProductSpecProps {
    project: NDKProject;
    onSave?: (content: string) => void;
}

export function ProductSpec({ project, onSave }: ProductSpecProps) {
    // State to hold the current editor content
    const [editorContent, setEditorContent] = useState(
        project.description || "# Project Specification\n\nAdd your project details here."
    );

    const handleSave = () => { // Removed content arg, uses state now
        if (onSave) {
            onSave(editorContent); // Use state variable
        }
    };

    // Callback for ProjectEditor to update local state
    const handleContentChange = (newContent: string) => {
        setEditorContent(newContent);
    };

    return (
        <Card className="md:col-span-1 rounded-md border-border">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-xl">Product Spec</CardTitle>
                    <CardDescription>Project specification document</CardDescription>
                </div>
                {/* Updated onClick to use state */}
                <Button size="sm" className="rounded-md" onClick={handleSave}>
                    <Save className="mr-2 h-4 w-4" />
                    Save
                </Button>
            </CardHeader>
            <CardContent>
                <ProjectEditor
                    initialContent={editorContent} // Use state for initial (though it's set above)
                    projectName={project.title || "Untitled Project"} // Pass project title (from NDKArticle)
                    projectTagline={project.tagline || ""} // Pass project tagline
                    onContentChange={handleContentChange} // Pass callback
                />
            </CardContent>
        </Card>
    );
}
