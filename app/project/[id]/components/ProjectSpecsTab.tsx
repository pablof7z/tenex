"use client";

import React, { useState, useEffect, useCallback } from "react";
import { NDKProject } from "@/lib/nostr/events/project";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Save, Undo2, Wand2, Plus } from "lucide-react"; // Added Plus

// Interface for file data
interface FileData {
    name: string;
    content: string;
}

// Props interface
interface ProjectSpecsTabProps {
    project: NDKProject;
    projectId: string;
}

const DEFAULT_SPEC_FILENAME = "SPEC.md";
const DEFAULT_SPEC_CONTENT = `# Project Specification\n\nAdd your project details here.`;

export function ProjectSpecsTab({ project, projectId }: ProjectSpecsTabProps) {
    const { toast } = useToast();
    const [specFiles, setSpecFiles] = useState<FileData[]>([]); // Files in context/
    const [ruleFiles, setRuleFiles] = useState<FileData[]>([]); // Files in .roo/rules/
    const [selectedFileName, setSelectedFileName] = useState<string>(DEFAULT_SPEC_FILENAME);
    const [selectedGroup, setSelectedGroup] = useState<'specs' | 'rules'>('specs'); // Track selected group
    const [isLoadingFiles, setIsLoadingFiles] = useState(true);
    const [filesError, setFilesError] = useState<string | null>(null);

    // State for the editor
    const [editorContent, setEditorContent] = useState<string>(""); // Content of the selected file
    const [isEditorLoading, setIsEditorLoading] = useState(false); // Loading state for AI improve (only for SPEC.md)
    const [isSaving, setIsSaving] = useState(false); // Saving state for the selected file
    const [previousEditorContent, setPreviousEditorContent] = useState<string | null>(null); // For undo (only for SPEC.md)
    const [isAiContent, setIsAiContent] = useState(false); // Track if content is from AI (only for SPEC.md)

    // --- Fetch Files ---
    const fetchFiles = useCallback(async () => {
        setIsLoadingFiles(true);
        setFilesError(null);
        try {
            const response = await fetch(`/api/projects/${projectId}/specs`);
            if (!response.ok) {
                if (response.status === 404) {
                    console.log(`Project specs/rules endpoint returned 404 for project ${projectId}. Assuming empty.`);
                    setSpecFiles([]);
                    setRuleFiles([]);
                } else {
                    throw new Error(`Failed to fetch files: ${response.status} ${response.statusText}`);
                }
            } else {
                const data = await response.json();
                const fetchedSpecs = data.specs || [];
                const fetchedRules = data.rules || [];
                setSpecFiles(fetchedSpecs);
                setRuleFiles(fetchedRules);

                // Determine initial selection
                const defaultSpecExists = fetchedSpecs.some((f: FileData) => f.name === DEFAULT_SPEC_FILENAME);
                if (selectedGroup === 'specs' && selectedFileName === DEFAULT_SPEC_FILENAME && !defaultSpecExists) {
                    // If default SPEC.md was selected but doesn't exist, try selecting first spec
                    if (fetchedSpecs.length > 0) {
                        setSelectedFileName(fetchedSpecs[0].name);
                        setSelectedGroup('specs');
                    } else if (fetchedRules.length > 0) {
                        setSelectedFileName(fetchedRules[0].name);
                        setSelectedGroup('rules');
                    } else {
                         // Keep default selection, editor will show default content
                         setSelectedFileName(DEFAULT_SPEC_FILENAME);
                         setSelectedGroup('specs');
                    }
                } else if (![...fetchedSpecs, ...fetchedRules].some(f => f.name === selectedFileName)) {
                     // If current selection is no longer valid, select default or first available
                     if (defaultSpecExists) {
                        setSelectedFileName(DEFAULT_SPEC_FILENAME);
                        setSelectedGroup('specs');
                     } else if (fetchedSpecs.length > 0) {
                        setSelectedFileName(fetchedSpecs[0].name);
                        setSelectedGroup('specs');
                    } else if (fetchedRules.length > 0) {
                        setSelectedFileName(fetchedRules[0].name);
                        setSelectedGroup('rules');
                    } else {
                         setSelectedFileName(DEFAULT_SPEC_FILENAME);
                         setSelectedGroup('specs');
                    }
                }
                // If current selection is still valid, do nothing to preserve user choice
            }
        } catch (err: unknown) {
            console.error("Error fetching files:", err);
            const message = err instanceof Error ? err.message : "An unknown error occurred";
            setFilesError(message);
            setSpecFiles([]);
            setRuleFiles([]);
        } finally {
            setIsLoadingFiles(false);
        }
    }, [projectId, selectedFileName, selectedGroup]); // Dependencies for fetch

    useEffect(() => {
        fetchFiles();
    }, [fetchFiles]); // Fetch files on initial load and when fetchFiles changes

    // --- Update Editor Content Effect ---
    useEffect(() => {
        let file: FileData | undefined;
        if (selectedGroup === 'specs') {
            file = specFiles.find((f) => f.name === selectedFileName);
        } else {
            file = ruleFiles.find((f) => f.name === selectedFileName);
        }

        // Set content or default if it's SPEC.md and doesn't exist yet
        if (selectedGroup === 'specs' && selectedFileName === DEFAULT_SPEC_FILENAME) {
            setEditorContent(file?.content ?? DEFAULT_SPEC_CONTENT);
        } else {
            setEditorContent(file?.content ?? ""); // Default to empty for other files
        }

        // Reset AI state if the selected file is not SPEC.md
        if (!(selectedGroup === 'specs' && selectedFileName === DEFAULT_SPEC_FILENAME)) {
            setIsAiContent(false);
            setPreviousEditorContent(null);
        }
        // Reset saving state when selection changes
        setIsSaving(false);
    }, [selectedFileName, selectedGroup, specFiles, ruleFiles]);

    // --- Handlers ---

    const handleEditorContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setEditorContent(e.target.value);
        // Reset AI state if user manually edits SPEC.md after AI improvement
        if (selectedGroup === 'specs' && selectedFileName === DEFAULT_SPEC_FILENAME) {
            setIsAiContent(false);
            // Optionally clear previous content to prevent accidental undo after manual edit
            // setPreviousEditorContent(null);
        }
    };

    // Generic Save Handler
    const handleSaveFile = async () => {
        if (!selectedFileName || !selectedGroup) return;

        setIsSaving(true);
        try {
            const response = await fetch(`/api/projects/${projectId}/specs`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fileName: selectedFileName,
                    content: editorContent,
                    group: selectedGroup
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: "Failed to parse error response" }));
                throw new Error(errorData.error || `Failed to save ${selectedFileName}: ${response.status} ${response.statusText}`);
            }

            toast({ title: "Success", description: `${selectedFileName} saved.` });

            // Optimistically update local state
            const updatedFile = { name: selectedFileName, content: editorContent };
            if (selectedGroup === 'specs') {
                setSpecFiles((prev) => {
                    const index = prev.findIndex(f => f.name === selectedFileName);
                    if (index > -1) {
                        const updated = [...prev];
                        updated[index] = updatedFile;
                        return updated;
                    }
                    return [...prev, updatedFile].sort((a, b) => a.name.localeCompare(b.name)); // Add if new
                });
            } else {
                setRuleFiles((prev) => {
                    const index = prev.findIndex(f => f.name === selectedFileName);
                    if (index > -1) {
                        const updated = [...prev];
                        updated[index] = updatedFile;
                        return updated;
                    }
                     return [...prev, updatedFile].sort((a, b) => a.name.localeCompare(b.name)); // Add if new
                });
            }
             // Reset AI state after saving SPEC.md
             if (selectedGroup === 'specs' && selectedFileName === DEFAULT_SPEC_FILENAME) {
                setIsAiContent(false);
                setPreviousEditorContent(null);
            }

        } catch (error: unknown) {
            console.error(`Failed to save ${selectedFileName}:`, error);
            const message = error instanceof Error ? error.message : "An unknown error occurred";
            toast({ variant: "destructive", title: "Error Saving File", description: message });
        } finally {
            setIsSaving(false);
        }
    };

    // AI Improve Handler (only for SPEC.md)
    const handleImproveSpec = async () => {
        if (!(selectedGroup === 'specs' && selectedFileName === DEFAULT_SPEC_FILENAME)) return;

        setIsEditorLoading(true);
        setPreviousEditorContent(editorContent); // Store current content for undo
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
                setIsAiContent(true); // Mark content as AI-generated
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

    // Undo AI Improvement Handler (only for SPEC.md)
    const handleUndoAiImprovement = () => {
        if (previousEditorContent !== null && selectedGroup === 'specs' && selectedFileName === DEFAULT_SPEC_FILENAME) {
            setEditorContent(previousEditorContent);
            setIsAiContent(false);
            setPreviousEditorContent(null); // Clear undo state
            toast({ title: "Undo Successful", description: "Reverted to the previous specification." });
        }
    };

    // Add New File Handler
    const handleAddNewFile = async (group: 'specs' | 'rules') => {
        const fileName = prompt(`Enter the name for the new ${group === 'specs' ? 'specification' : 'rule'} file (e.g., FILENAME.md):`);
        if (!fileName || !fileName.trim()) {
            // Allow cancellation without toast
            // toast({ variant: "destructive", title: "Cancelled", description: "File name cannot be empty." });
            return;
        }

        const trimmedName = fileName.trim();

        // Basic validation
        if (!trimmedName.endsWith('.md')) {
             toast({ variant: "destructive", title: "Invalid Name", description: "File name must end with .md" });
            return;
        }
        if (trimmedName.includes('/') || trimmedName.includes('..')) {
            toast({ variant: "destructive", title: "Invalid Name", description: "File name cannot contain '/' or '..'" });
            return;
        }

        // Check if file already exists
        const fileExists = group === 'specs'
            ? specFiles.some(f => f.name === trimmedName)
            : ruleFiles.some(f => f.name === trimmedName);

        if (fileExists) {
            toast({ variant: "destructive", title: "File Exists", description: `A file named "${trimmedName}" already exists in ${group}.` });
            return;
        }

        setIsSaving(true); // Use general saving state
        try {
            const response = await fetch(`/api/projects/${projectId}/specs`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileName: trimmedName, content: "", group }), // Send empty content initially
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: "Failed to parse error response" }));
                throw new Error(errorData.error || `Failed to create ${trimmedName}: ${response.status} ${response.statusText}`);
            }

            const newFile = { name: trimmedName, content: "" };
            if (group === 'specs') {
                setSpecFiles((prev) => [...prev, newFile].sort((a, b) => a.name.localeCompare(b.name)));
            } else {
                setRuleFiles((prev) => [...prev, newFile].sort((a, b) => a.name.localeCompare(b.name)));
            }
            // Select the newly created file
            setSelectedFileName(trimmedName);
            setSelectedGroup(group);
            setEditorContent(""); // Set editor to empty
            toast({ title: "Success", description: `${trimmedName} created in ${group}.` });

        } catch (error: unknown) {
            console.error(`Failed to create ${trimmedName}:`, error);
            const message = error instanceof Error ? error.message : "An unknown error occurred";
            toast({ variant: "destructive", title: "Error Creating File", description: message });
        } finally {
            setIsSaving(false);
        }
    };

    // --- Render Logic ---

    const renderEditor = () => {
        const isSpecMd = selectedGroup === 'specs' && selectedFileName === DEFAULT_SPEC_FILENAME;
        const saveButtonText = isSaving ? "Saving..." : `Save ${selectedFileName}`;

        return (
            <div className="space-y-4">
                <div className="flex justify-end space-x-2">
                    {/* Save Button */}
                    <Button onClick={handleSaveFile} disabled={isSaving || isEditorLoading} size="sm">
                        {isSaving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        {saveButtonText}
                    </Button>
                    {/* AI Buttons (Only for SPEC.md) */}
                    {isSpecMd && (
                        <>
                            {isAiContent && !isEditorLoading && previousEditorContent !== null && (
                                <Button variant="outline" size="sm" onClick={handleUndoAiImprovement} disabled={isSaving}>
                                    <Undo2 className="mr-2 h-4 w-4" />
                                    Undo AI
                                </Button>
                            )}
                            <Button onClick={handleImproveSpec} disabled={isEditorLoading || isSaving} size="sm">
                                {isEditorLoading ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Wand2 className="mr-2 h-4 w-4" />
                                )}
                                Improve with AI
                            </Button>
                        </>
                    )}
                </div>
                <Textarea
                    value={editorContent}
                    onChange={handleEditorContentChange}
                    placeholder={`Content for ${selectedFileName}...`}
                    className="min-h-[500px] font-mono rounded-md border-border focus-visible:ring-ring"
                    disabled={isEditorLoading || isSaving}
                />
            </div>
        );
    };

    // Combined list for sidebar rendering
    const combinedFiles = useCallback(() => {
        // Ensure SPEC.md is listed under specs if it exists or if no specs exist yet
        const specMdInList = specFiles.some(f => f.name === DEFAULT_SPEC_FILENAME);
        const specsToShow = specMdInList ? [...specFiles] : [{ name: DEFAULT_SPEC_FILENAME, content: "" }, ...specFiles];

        return {
            specs: specsToShow.sort((a, b) => a.name.localeCompare(b.name)),
            rules: [...ruleFiles].sort((a, b) => a.name.localeCompare(b.name)),
        };
    }, [specFiles, ruleFiles]);


    const renderSidebarList = (files: FileData[], group: 'specs' | 'rules') => (
        files.map((file) => (
            <li key={`${group}-${file.name}`}>
                <button
                    type="button"
                    onClick={() => {
                        setSelectedGroup(group);
                        setSelectedFileName(file.name);
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded truncate text-sm ${selectedFileName === file.name && selectedGroup === group ? "bg-muted font-medium" : "hover:bg-muted/50"}`}
                    title={file.name}
                    disabled={isSaving || isLoadingFiles} // Disable selection while saving/loading
                >
                    {file.name}
                </button>
            </li>
        ))
    );

    return (
        <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0">
            {/* Sidebar for mobile (simplified) */}
             <div className="md:hidden mb-4">
                 {/* Mobile might need a different approach, maybe two selects or a combined one */}
                 <select
                     value={`${selectedGroup}:${selectedFileName}`}
                     onChange={(e) => {
                         const [group, name] = e.target.value.split(':');
                         setSelectedGroup(group as 'specs' | 'rules');
                         setSelectedFileName(name);
                     }}
                     className="w-full p-2 border rounded bg-background"
                     disabled={isLoadingFiles || isSaving}
                 >
                     {isLoadingFiles && <option disabled>Loading files...</option>}
                     {filesError && <option disabled>Error loading files</option>}
                     {!isLoadingFiles && !filesError && (
                         <>
                             <optgroup label="Specifications">
                                 {combinedFiles().specs.map(file => (
                                     <option key={`specs-${file.name}`} value={`specs:${file.name}`}>
                                         {file.name}
                                     </option>
                                 ))}
                             </optgroup>
                             <optgroup label="Rules">
                                 {combinedFiles().rules.map(file => (
                                     <option key={`rules-${file.name}`} value={`rules:${file.name}`}>
                                         {file.name}
                                     </option>
                                 ))}
                             </optgroup>
                         </>
                     )}
                 </select>
                 {filesError && <p className="text-red-500 text-xs mt-1">Error: {filesError}</p>}
                 {/* Add buttons for mobile? */}
                 <div className="flex justify-end space-x-2 mt-2">
                     <Button size="sm" variant="outline" onClick={() => handleAddNewFile('specs')} disabled={isSaving || isLoadingFiles}>+ Spec</Button>
                     <Button size="sm" variant="outline" onClick={() => handleAddNewFile('rules')} disabled={isSaving || isLoadingFiles}>+ Rule</Button>
                 </div>
             </div>

            {/* Sidebar for Desktop */}
            <div className="w-full md:w-64 lg:w-72 flex-shrink-0 hidden md:block border-r pr-4 self-stretch overflow-y-auto">
                {/* Specifications Section */}
                <div className="mb-4">
                    <div className="flex justify-between items-center mb-2 sticky top-0 bg-background pb-2 z-10">
                        <h3 className="text-lg font-semibold">Specifications</h3>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="px-1 py-0 h-auto"
                            onClick={() => handleAddNewFile('specs')}
                            disabled={isSaving || isLoadingFiles}
                            title="Add new specification file"
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                    <ul className="space-y-1">
                        {isLoadingFiles && <Skeleton className="h-20 w-full" />}
                        {filesError && !isLoadingFiles && <li className="text-red-500 text-xs px-3 py-1">Error: {filesError}</li>}
                        {!isLoadingFiles && !filesError && renderSidebarList(combinedFiles().specs, 'specs')}
                        {!isLoadingFiles && !filesError && combinedFiles().specs.length === 0 && (
                            <li className="text-sm text-muted-foreground px-3 py-1 italic">No specifications found.</li>
                        )}
                    </ul>
                </div>

                {/* Rules Section */}
                <div>
                    <div className="flex justify-between items-center mb-2 sticky top-[calc(2rem+1.5rem)] bg-background pb-2 z-10"> {/* Adjust top offset */}
                        <h3 className="text-lg font-semibold">Rules</h3>
                         <Button
                            variant="ghost"
                            size="sm"
                            className="px-1 py-0 h-auto"
                            onClick={() => handleAddNewFile('rules')}
                            disabled={isSaving || isLoadingFiles}
                            title="Add new rule file"
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                     <ul className="space-y-1">
                        {isLoadingFiles && <Skeleton className="h-12 w-full" />}
                        {/* Error shown in specs section is enough */}
                        {!isLoadingFiles && !filesError && renderSidebarList(combinedFiles().rules, 'rules')}
                        {!isLoadingFiles && !filesError && combinedFiles().rules.length === 0 && (
                            <li className="text-sm text-muted-foreground px-3 py-1 italic">No rules found.</li>
                        )}
                    </ul>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 min-w-0 overflow-y-auto">
                {isLoadingFiles ? (
                    <div className="space-y-4 p-4">
                        <Skeleton className="h-8 w-48 ml-auto" /> {/* Simulate buttons */}
                        <Skeleton className="h-[500px] w-full" /> {/* Simulate textarea */}
                    </div>
                ) : filesError ? (
                    <p className="text-red-500 p-4">Could not load files: {filesError}</p>
                ) : (
                    renderEditor() // Always render editor now
                )}
            </div>
        </div>
    );
}
