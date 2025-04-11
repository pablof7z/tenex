"use client";

import React, { useState, useEffect, useCallback } from "react";
import { NDKProject } from "@/lib/nostr/events/project";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Save, Undo2, Wand2 } from "lucide-react"; // Added Save

// Interface for fetched files
interface SpecFile {
    name: string;
    content: string;
}

// Re-add projectId prop
interface ProjectSpecsTabProps {
    project: NDKProject;
    projectId: string;
}

const DEFAULT_SPEC_FILENAME = "SPEC.md";
const DEFAULT_SPEC_CONTENT = `# Project Specification\n\nAdd your project details here.`;

export function ProjectSpecsTab({ project, projectId }: ProjectSpecsTabProps) {
    const { toast } = useToast();
    const [specFiles, setSpecFiles] = useState<SpecFile[]>([]);
    const [selectedFileName, setSelectedFileName] = useState<string>(DEFAULT_SPEC_FILENAME);
    const [isLoadingFiles, setIsLoadingFiles] = useState(true);
    const [filesError, setFilesError] = useState<string | null>(null);

    // State specifically for the SPEC.md editor
    const [editorContent, setEditorContent] = useState<string>(""); // Content of SPEC.md
    const [isEditorLoading, setIsEditorLoading] = useState(false); // Loading state for AI improve
    const [isSavingSpec, setIsSavingSpec] = useState(false); // Saving state for SPEC.md
    const [previousEditorContent, setPreviousEditorContent] = useState<string | null>(null); // For undo
    const [isAiContent, setIsAiContent] = useState(false); // Track if SPEC.md content is from AI

    // Fetch the list of spec files
    useEffect(() => {
        const fetchSpecFiles = async () => {
            setIsLoadingFiles(true);
            setFilesError(null);
            try {
                const response = await fetch(`/api/projects/${projectId}/specs`);
                if (!response.ok) {
                    if (response.status === 404) {
                        console.log(`No spec files found for project ${projectId} (404).`);
                        setSpecFiles([]); // API returns empty if dir doesn't exist
                    } else {
                        throw new Error(`Failed to fetch spec files: ${response.status} ${response.statusText}`);
                    }
                } else {
                    const data = await response.json();
                    setSpecFiles(data.files || []);
                }
            } catch (err: unknown) {
                // Changed any to unknown
                console.error("Error fetching spec files:", err);
                const message = err instanceof Error ? err.message : "An unknown error occurred";
                setFilesError(message);
                setSpecFiles([]);
            } finally {
                setIsLoadingFiles(false);
            }
        };

        fetchSpecFiles();
    }, [projectId]);

    // Effect to manage editor content based on selected file and fetched files
    useEffect(() => {
        if (selectedFileName === DEFAULT_SPEC_FILENAME) {
            const specMdFile = specFiles.find((f) => f.name === DEFAULT_SPEC_FILENAME);
            setEditorContent(specMdFile?.content ?? DEFAULT_SPEC_CONTENT);
            // Reset AI-related state when switching back to SPEC.md or on initial load
            setIsAiContent(false);
            setPreviousEditorContent(null);
        }
        // No need for an else clause, editorContent is only relevant for SPEC.md
    }, [selectedFileName, specFiles]);

    // --- Handlers for SPEC.md Editor ---

    const handleEditorContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newContent = e.target.value;
        setEditorContent(newContent);
        setIsAiContent(false);
        setPreviousEditorContent(null);
    };

    const handleImproveSpec = async () => {
        setIsEditorLoading(true);
        setPreviousEditorContent(editorContent);
        setIsAiContent(false);

        try {
            const response = await fetch("/api/run?cmd=improve-project-spec", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: project.title || "Untitled Project",
                    productSpec: editorContent,
                }),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: "Failed to parse error response" }));
                throw new Error(errorData.error || `API request failed with status ${response.status}`);
            }
            const improvedSpec = await response.text();
            if (improvedSpec) {
                setEditorContent(improvedSpec);
                setIsAiContent(true);
                toast({
                    title: "Specification Improved",
                    description: "The product specification has been updated by AI.",
                });
            } else {
                throw new Error("Received empty response from AI.");
            }
        } catch (error: unknown) {
            console.error("Failed to improve spec:", error);
            const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
            toast({ variant: "destructive", title: "Improvement Failed", description: errorMessage });
            setPreviousEditorContent(null); // Clear undo state on failure
        } finally {
            setIsEditorLoading(false);
        }
    };

    const handleUndoAiImprovement = () => {
        if (previousEditorContent !== null) {
            setEditorContent(previousEditorContent);
            setIsAiContent(false);
            setPreviousEditorContent(null);
            toast({ title: "Undo Successful", description: "Reverted to the previous specification." });
        }
    };

    const handleSaveSpec = async () => {
        setIsSavingSpec(true);
        try {
            const response = await fetch(`/api/projects/${projectId}/specs`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileName: DEFAULT_SPEC_FILENAME, content: editorContent }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: "Failed to parse error response" }));
                throw new Error(
                    errorData.error ||
                        `Failed to save ${DEFAULT_SPEC_FILENAME}: ${response.status} ${response.statusText}`,
                );
            }
            toast({ title: "Success", description: `${DEFAULT_SPEC_FILENAME} saved.` });
            // Optimistically update the specFiles state if needed, or refetch
            setSpecFiles((currentFiles) => {
                const existingIndex = currentFiles.findIndex((f) => f.name === DEFAULT_SPEC_FILENAME);
                if (existingIndex > -1) {
                    const updatedFiles = [...currentFiles];
                    updatedFiles[existingIndex] = { name: DEFAULT_SPEC_FILENAME, content: editorContent };
                    return updatedFiles;
                } else {
                    return [...currentFiles, { name: DEFAULT_SPEC_FILENAME, content: editorContent }];
                }
            });
        } catch (error: unknown) {
            // Changed any to unknown
            console.error(`Failed to save ${DEFAULT_SPEC_FILENAME}:`, error);
            const message = error instanceof Error ? error.message : "An unknown error occurred";
            toast({
                variant: "destructive",
                title: "Error",
                description: `Failed to save ${DEFAULT_SPEC_FILENAME}: ${message}`,
            });
        } finally {
            setIsSavingSpec(false);
        }
    };

    // --- End Handlers ---

    // --- Render Logic ---

    const renderEditor = () => (
        <div className="space-y-4">
            <div className="flex justify-end space-x-2">
                {/* Save Button */}
                <Button onClick={handleSaveSpec} disabled={isSavingSpec || isEditorLoading} size="sm">
                    {isSavingSpec ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="mr-2 h-4 w-4" />
                    )}
                    {isSavingSpec ? "Saving..." : "Save SPEC.md"}
                </Button>
                {/* AI Buttons */}
                {isAiContent && !isEditorLoading && previousEditorContent !== null && (
                    <Button variant="outline" size="sm" onClick={handleUndoAiImprovement}>
                        <Undo2 className="mr-2 h-4 w-4" />
                        Undo AI Improvement
                    </Button>
                )}
                <Button onClick={handleImproveSpec} disabled={isEditorLoading || isSavingSpec} size="sm">
                    {isEditorLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Wand2 className="mr-2 h-4 w-4" />
                    )}
                    Improve with AI
                </Button>
            </div>
            <Textarea
                value={editorContent}
                onChange={handleEditorContentChange}
                placeholder="Describe your project specification here..."
                className="min-h-[500px] font-mono rounded-md border-border focus-visible:ring-ring"
                disabled={isEditorLoading || isSavingSpec}
            />
        </div>
    );

    const renderReadOnlyContent = (file: SpecFile) => (
        <Card>
            <CardHeader>
                <CardTitle>{file.name}</CardTitle>
            </CardHeader>
            <CardContent>
                <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-4 rounded">{file.content}</pre>
            </CardContent>
        </Card>
    );

    const renderContent = () => {
        if (selectedFileName === DEFAULT_SPEC_FILENAME) {
            return renderEditor();
        }
        const file = specFiles.find((f) => f.name === selectedFileName);
        return file ? renderReadOnlyContent(file) : <p>Select a file.</p>; // Handle case where file might not be found
    };

    // Ensure SPEC.md is always in the list for the sidebar/select
    const filesForSidebar = useCallback(() => {
        const hasSpecMd = specFiles.some((f) => f.name === DEFAULT_SPEC_FILENAME);
        const otherFiles = specFiles.filter((f) => f.name !== DEFAULT_SPEC_FILENAME);
        const specMdEntry = { name: DEFAULT_SPEC_FILENAME, content: "" }; // Content doesn't matter for sidebar list
        return hasSpecMd ? [specMdEntry, ...otherFiles] : [specMdEntry, ...otherFiles];
    }, [specFiles]);

    return (
        <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0">
            {" "}
            {/* Ensure flex container allows children to scroll */}
            {/* Sidebar for mobile */}
            <div className="md:hidden mb-4">
                <select
                    value={selectedFileName}
                    onChange={(e) => setSelectedFileName(e.target.value)}
                    className="w-full p-2 border rounded bg-background"
                    disabled={isLoadingFiles}
                >
                    {isLoadingFiles && <option disabled>Loading files...</option>}
                    {filesError && <option disabled>Error loading files</option>}
                    {!isLoadingFiles &&
                        !filesError &&
                        filesForSidebar().map((file) => (
                            <option key={file.name} value={file.name}>
                                {file.name}
                            </option>
                        ))}
                </select>
                {filesError && <p className="text-red-500 text-xs mt-1">Error: {filesError}</p>}
            </div>
            {/* Sidebar for Desktop */}
            <div className="w-full md:w-64 lg:w-72 flex-shrink-0 hidden md:block border-r pr-4 self-stretch overflow-y-auto">
                <h3 className="text-lg font-semibold mb-4 sticky top-0 bg-background pb-2 z-10">Specifications</h3>
                <ul className="space-y-1">
                    {isLoadingFiles && (
                        <>
                            <Skeleton className="h-7 w-full mt-1" />
                            <Skeleton className="h-7 w-full mt-1" />
                            <Skeleton className="h-7 w-full mt-1" />
                        </>
                    )}
                    {filesError && !isLoadingFiles && (
                        <li className="text-red-500 text-xs px-3 py-1">Error: {filesError}</li>
                    )}
                    {!isLoadingFiles &&
                        !filesError &&
                        filesForSidebar().map((file) => (
                            <li key={file.name}>
                                <button
                                    type="button" // Ensured type="button"
                                    onClick={() => setSelectedFileName(file.name)}
                                    className={`w-full text-left px-3 py-1.5 rounded truncate text-sm ${selectedFileName === file.name ? "bg-muted font-medium" : "hover:bg-muted/50"}`}
                                    title={file.name}
                                >
                                    {file.name}
                                </button>
                            </li>
                        ))}
                    {!isLoadingFiles &&
                        !filesError &&
                        filesForSidebar().length === 0 && ( // Should not happen due to filesForSidebar logic, but safe fallback
                            <li className="text-sm text-muted-foreground px-3 py-1 italic">No context files found.</li>
                        )}
                </ul>
            </div>
            {/* Main Content Area */}
            <div className="flex-1 min-w-0 overflow-y-auto">
                {" "}
                {/* Allow content to scroll */}
                {isLoadingFiles ? (
                    <div className="space-y-4 p-4">
                        <Skeleton className="h-8 w-48" /> {/* Simulate buttons */}
                        <Skeleton className="h-[500px] w-full" /> {/* Simulate textarea */}
                    </div>
                ) : filesError ? (
                    <p className="text-red-500 p-4">Could not load specification files: {filesError}</p>
                ) : (
                    renderContent()
                )}
            </div>
        </div>
    );
}
