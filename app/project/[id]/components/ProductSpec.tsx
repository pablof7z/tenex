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
    const handleSave = (content: string) => {
        if (onSave) {
            onSave(content);
        }
    };

    return (
        <Card className="md:col-span-1 rounded-md border-border">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-xl">Product Spec</CardTitle>
                    <CardDescription>Project specification document</CardDescription>
                </div>
                <Button size="sm" className="rounded-md" onClick={() => handleSave(project.description || "")}>
                    <Save className="mr-2 h-4 w-4" />
                    Save
                </Button>
            </CardHeader>
            <CardContent>
                <ProjectEditor
                    initialContent={project.description || "# Project Specification\n\nAdd your project details here."}
                />
            </CardContent>
        </Card>
    );
}
