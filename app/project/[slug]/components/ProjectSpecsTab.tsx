"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link"; // Added Link import
import { NDKProject } from "@/lib/nostr/events/project";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useConfig } from "@/hooks/useConfig"; // Import useConfig
import { Loader2, Save, Undo2, Wand2, Plus, AlertTriangle } from "lucide-react"; // Added AlertTriangle
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Added Alert components

// Interface for file data
interface FileData {
    name: string;
    content: string;
}

// Props interface
interface ProjectSpecsTabProps {
    project: NDKProject;
    projectSlug: string; // Changed from projectId
}

const DEFAULT_SPEC_FILENAME = "SPEC.md";
const DEFAULT_SPEC_CONTENT = `# Project Specification\n\nAdd your project details here.`;

export function ProjectSpecsTab({ project, projectSlug }: ProjectSpecsTabProps) { // Changed projectId to projectSlug
    const { toast } = useToast();
    // Use isReady and error directly from the hook
    const { getApiUrl, isLoading: isConfigLoading, isReady: isConfigReady, error: configError } = useConfig();
    const [specFiles, setSpecFiles] = useState<FileData[]>([]);
    const [ruleFiles, setRuleFiles] = useState<FileData[]>([]);
    const [selectedFileName, setSelectedFileName] = useState<string>(DEFAULT_SPEC_FILENAME);
    const [selectedGroup, setSelectedGroup] = useState<'specs' | 'rules'>('specs');
    const [isLoadingFiles, setIsLoadingFiles] = useState(true);
    const [filesError, setFilesError] = useState<string | null>(null); // Error specific to file loading/saving

    // State for the editor
    const [editorContent, setEditorContent] = useState<string>("");
    const [isEditorLoading, setIsEditorLoading] = useState(false); // Loading state for AI improve
    const [isSaving, setIsSaving] = useState(false);
    const [previousEditorContent, setPreviousEditorContent] = useState<string | null>(null);
    const [isAiContent, setIsAiContent] = useState(false);

    // Removed local useEffect for isConfigReady/configError

    // --- Fetch Files ---
    const fetchFiles = useCallback(async () => {
        // Use hook's isReady state
        if (!isConfigReady) {
             setIsLoadingFiles(false);
             setFilesError(null);
             // Clear files if config becomes not ready
             setSpecFiles([]);
             setRuleFiles([]);
             setEditorContent(""); // Clear editor too
             return;
        }
        setIsLoadingFiles(true);
        setFilesError(null);

        const apiUrl = getApiUrl(`/projects/${projectSlug}/specs`); // Use projectSlug
        // getApiUrl now always returns a string

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                if (response.status === 404) {
                    console.log(`Project specs/rules endpoint returned 404 for project ${projectSlug}. Assuming empty.`); // Use projectSlug
                    setSpecFiles([]);
                    setRuleFiles([]);
                } else {
                     const errorText = await response.text().catch(() => `Status ${response.status}`);
                    throw new Error(`Failed to fetch files: ${response.status} ${errorText}`);
                }
            } else {
                const data = await response.json();
                const fetchedSpecs = data.specs || [];
                const fetchedRules = data.rules || [];
                setSpecFiles(fetchedSpecs);
                setRuleFiles(fetchedRules);

                // Determine initial selection logic remains the same
                const allFiles = [...fetchedSpecs, ...fetchedRules];
                const currentSelectionValid = allFiles.some(f => f.name === selectedFileName);
                const defaultSpecExists = fetchedSpecs.some((f: FileData) => f.name === DEFAULT_SPEC_FILENAME);

                if (!currentSelectionValid) {
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
                // If current selection is valid, it remains unchanged
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
// Only re-run fetchFiles if projectSlug, config readiness, or the API URL getter changes
}, [projectSlug, isConfigReady, getApiUrl]); // REMOVED selectedFileName, selectedGroup

useEffect(() => {
    fetchFiles();
}, [fetchFiles]);

// --- Effect for Selection Validation ---
useEffect(() => {
    // Don't run validation if files are loading or config isn't ready
    if (isLoadingFiles || !isConfigReady) return;

    const allFiles = [...specFiles, ...ruleFiles];
    const currentSelectionExists = allFiles.some(f => f.name === selectedFileName && (
        (selectedGroup === 'specs' && specFiles.some(s => s.name === selectedFileName)) ||
        (selectedGroup === 'rules' && ruleFiles.some(r => r.name === selectedFileName))
    ));
    const defaultSpecExists = specFiles.some((f: FileData) => f.name === DEFAULT_SPEC_FILENAME);

    if (!currentSelectionExists) {
        // If current selection is no longer valid, reset it
        if (defaultSpecExists) {
            setSelectedFileName(DEFAULT_SPEC_FILENAME);
            setSelectedGroup('specs');
        } else if (specFiles.length > 0) {
            setSelectedFileName(specFiles[0].name);
            setSelectedGroup('specs');
        } else if (ruleFiles.length > 0) {
            setSelectedFileName(ruleFiles[0].name);
            setSelectedGroup('rules');
        } else {
            // Default to SPEC.md even if it doesn't exist in fetched data yet
            setSelectedFileName(DEFAULT_SPEC_FILENAME);
            setSelectedGroup('specs');
        }
    }
    // If current selection is still valid, do nothing
// Run this logic when fetched files change, or if the user manually changes selection
}, [specFiles, ruleFiles, selectedFileName, selectedGroup, isLoadingFiles, isConfigReady]);

    // --- Update Editor Content Effect ---
    useEffect(() => {
        if (!isConfigReady) {
            // Clear editor if config is not ready
            setEditorContent("");
            return;
        };

        let file: FileData | undefined;
        if (selectedGroup === 'specs') {
            file = specFiles.find((f) => f.name === selectedFileName);
        } else {
            file = ruleFiles.find((f) => f.name === selectedFileName);
        }

    if (selectedGroup === 'specs' && selectedFileName === DEFAULT_SPEC_FILENAME) {
        // Use fetched content if available, otherwise default content
        setEditorContent(file?.content ?? (specFiles.length > 0 || ruleFiles.length > 0 ? "" : DEFAULT_SPEC_CONTENT));
    } else {
        setEditorContent(file?.content ?? "");
    }

    // Reset AI state only if the file is NOT the default spec OR if it's the default spec but doesn't exist yet
    const isDefaultSpecPlaceholder = selectedGroup === 'specs' && selectedFileName === DEFAULT_SPEC_FILENAME && !specFiles.some(f => f.name === DEFAULT_SPEC_FILENAME);
    if (!(selectedGroup === 'specs' && selectedFileName === DEFAULT_SPEC_FILENAME) || isDefaultSpecPlaceholder) {
        setIsAiContent(false);
        setPreviousEditorContent(null);
    }
    setIsSaving(false); // Reset saving state when selection changes
}, [selectedFileName, selectedGroup, specFiles, ruleFiles, isConfigReady]); // Keep dependencies as they are relevant to finding the content

    // --- Handlers ---

    const handleEditorContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setEditorContent(e.target.value);
        if (selectedGroup === 'specs' && selectedFileName === DEFAULT_SPEC_FILENAME) {
            setIsAiContent(false);
        }
    };

    // Generic Save Handler
    const handleSaveFile = async () => {
        if (!isConfigReady) {
            toast({ title: "Configuration Error", description: configError || "Configuration not ready.", variant: "destructive" });
            return;
        }
        if (!selectedFileName || !selectedGroup) return;

        const apiUrl = getApiUrl(`/projects/${projectSlug}/specs`); // Use projectSlug

        setIsSaving(true);
        setFilesError(null);
        try {
            const response = await fetch(apiUrl, {
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

            // Optimistic update
            const updatedFile = { name: selectedFileName, content: editorContent };
            if (selectedGroup === 'specs') {
                setSpecFiles((prev) => {
                    const index = prev.findIndex(f => f.name === selectedFileName);
                    if (index > -1) {
                        const updated = [...prev];
                        updated[index] = updatedFile;
                        return updated;
                    }
                    return [...prev, updatedFile].sort((a, b) => a.name.localeCompare(b.name));
                });
            } else {
                setRuleFiles((prev) => {
                    const index = prev.findIndex(f => f.name === selectedFileName);
                    if (index > -1) {
                        const updated = [...prev];
                        updated[index] = updatedFile;
                        return updated;
                    }
                     return [...prev, updatedFile].sort((a, b) => a.name.localeCompare(b.name));
                });
            }
             if (selectedGroup === 'specs' && selectedFileName === DEFAULT_SPEC_FILENAME) {
                setIsAiContent(false);
                setPreviousEditorContent(null);
            }

        } catch (error: unknown) {
            console.error(`Failed to save ${selectedFileName}:`, error);
            const message = error instanceof Error ? error.message : "An unknown error occurred";
            setFilesError(message);
            toast({ variant: "destructive", title: "Error Saving File", description: message });
        } finally {
            setIsSaving(false);
        }
    };

    // AI Improve Handler (only for SPEC.md)
    const handleImproveSpec = async () => {
        if (!isConfigReady) {
            toast({ title: "Configuration Error", description: configError || "Configuration not ready.", variant: "destructive" });
            return;
        }
        if (!(selectedGroup === 'specs' && selectedFileName === DEFAULT_SPEC_FILENAME)) return;

        const apiUrl = getApiUrl("/run?cmd=improve-project-spec");

        setIsEditorLoading(true);
        setPreviousEditorContent(editorContent);
        setIsAiContent(false);
        setFilesError(null);

        try {
            const response = await fetch(apiUrl, {
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
            setFilesError(errorMessage);
            toast({ variant: "destructive", title: "Improvement Failed", description: errorMessage });
            setPreviousEditorContent(null);
        } finally {
            setIsEditorLoading(false);
        }
    };

    // Undo AI Improvement Handler (only for SPEC.md)
    const handleUndoAiImprovement = () => {
        if (previousEditorContent !== null && selectedGroup === 'specs' && selectedFileName === DEFAULT_SPEC_FILENAME) {
            setEditorContent(previousEditorContent);
            setIsAiContent(false);
            setPreviousEditorContent(null);
            toast({ title: "Undo Successful", description: "Reverted to the previous specification." });
        }
    };

    // Add New File Handler
    const handleAddNewFile = async (group: 'specs' | 'rules') => {
         if (!isConfigReady) {
            toast({ title: "Configuration Error", description: configError || "Configuration not ready.", variant: "destructive" });
            return;
        }
        const fileName = prompt(`Enter the name for the new ${group === 'specs' ? 'specification' : 'rule'} file (e.g., FILENAME.md):`);
        if (!fileName || !fileName.trim()) {
            return;
        }

        const trimmedName = fileName.trim();

        if (!trimmedName.endsWith('.md')) {
             toast({ variant: "destructive", title: "Invalid Name", description: "File name must end with .md" });
            return;
        }
        if (trimmedName.includes('/') || trimmedName.includes('..')) {
            toast({ variant: "destructive", title: "Invalid Name", description: "File name cannot contain '/' or '..'" });
            return;
        }

        const fileExists = group === 'specs'
            ? specFiles.some(f => f.name === trimmedName)
            : ruleFiles.some(f => f.name === trimmedName);

        if (fileExists) {
            toast({ variant: "destructive", title: "File Exists", description: `A file named "${trimmedName}" already exists in ${group}.` });
            return;
        }

        const apiUrl = getApiUrl(`/projects/${projectSlug}/specs`); // Use projectSlug

        setIsSaving(true);
        setFilesError(null);
        try {
            const response = await fetch(apiUrl, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileName: trimmedName, content: "", group }),
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
            setSelectedFileName(trimmedName);
            setSelectedGroup(group);
            setEditorContent("");
            toast({ title: "Success", description: `${trimmedName} created in ${group}.` });

        } catch (error: unknown) {
            console.error(`Failed to create ${trimmedName}:`, error);
            const message = error instanceof Error ? error.message : "An unknown error occurred";
            setFilesError(message);
            toast({ variant: "destructive", title: "Error Creating File", description: message });
        } finally {
            setIsSaving(false);
        }
    };

    // --- Render Logic ---

    // Determine if actions should be disabled based on hook state and component state
    const actionsDisabled = !isConfigReady || isConfigLoading || isSaving || isEditorLoading || isLoadingFiles;
    const configErrorTooltip = configError ? `Configuration Error: ${configError}` : !isConfigReady ? "Loading configuration..." : "";

    const renderEditor = () => {
        const isSpecMd = selectedGroup === 'specs' && selectedFileName === DEFAULT_SPEC_FILENAME;
        const saveButtonText = isSaving ? "Saving..." : `Save ${selectedFileName}`;

        return (
            <div className="space-y-4">
                <div className="flex justify-end space-x-2">
                    {/* Save Button */}
                    <Button onClick={handleSaveFile} disabled={actionsDisabled} size="sm" title={configErrorTooltip || ""}>
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
                                <Button variant="outline" size="sm" onClick={handleUndoAiImprovement} disabled={actionsDisabled}>
                                    <Undo2 className="mr-2 h-4 w-4" />
                                    Undo AI
                                </Button>
                            )}
                            <Button onClick={handleImproveSpec} disabled={actionsDisabled} size="sm" title={configErrorTooltip || ""}>
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
                    placeholder={!isConfigReady ? "Configuration not ready..." : isLoadingFiles ? "Loading file content..." : `Content for ${selectedFileName}...`}
                    className="min-h-[500px] font-mono rounded-md border-border focus-visible:ring-ring"
                    disabled={actionsDisabled} // Disable textarea based on combined state
                />
                 {/* Display file-specific error */}
                 {filesError && <p className="text-sm text-red-500">{filesError}</p>}
            </div>
        );
    };

    // Combined list for sidebar rendering
    const combinedFiles = useCallback(() => {
        const specMdInList = specFiles.some(f => f.name === DEFAULT_SPEC_FILENAME);
        // Ensure default SPEC.md is shown even if empty or not yet fetched/created
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
                    disabled={actionsDisabled} // Disable selection based on combined state
                >
                    {file.name}
                </button>
            </li>
        ))
    );

    const sidebarActionsDisabled = actionsDisabled; // Use combined state for sidebar add buttons too

    return (
        <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0">
             {/* Display persistent config error Alert if any */}
             {configError && !isConfigLoading && (
                 <Alert variant="destructive" className="mb-4 md:hidden">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Configuration Error</AlertTitle>
                    <AlertDescription>
                        {configError} Please check <Link href="/settings" className="underline">Application Settings</Link>.
                    </AlertDescription>
                </Alert>
             )}

            {/* Sidebar for mobile (simplified) */}
             <div className="md:hidden mb-4">
                 <select
                     value={`${selectedGroup}:${selectedFileName}`}
                     onChange={(e) => {
                         const [group, name] = e.target.value.split(':');
                         setSelectedGroup(group as 'specs' | 'rules');
                         setSelectedFileName(name);
                     }}
                     className="w-full p-2 border rounded bg-background"
                     disabled={sidebarActionsDisabled}
                 >
                     {(isLoadingFiles || isConfigLoading) && <option disabled>Loading...</option>}
                     {/* Prioritize config error display */}
                     {configError && <option disabled>Config Error</option>}
                     {filesError && !configError && <option disabled>Error loading files</option>}
                     {!isLoadingFiles && !isConfigLoading && !configError && !filesError && (
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
                 {/* Display file error only if no config error */}
                 {filesError && !configError && <p className="text-red-500 text-xs mt-1">Error: {filesError}</p>}
                 <div className="flex justify-end space-x-2 mt-2">
                     <Button size="sm" variant="outline" onClick={() => handleAddNewFile('specs')} disabled={sidebarActionsDisabled} title={configErrorTooltip || ""}>+ Spec</Button>
                     <Button size="sm" variant="outline" onClick={() => handleAddNewFile('rules')} disabled={sidebarActionsDisabled} title={configErrorTooltip || ""}>+ Rule</Button>
                 </div>
             </div>

            {/* Sidebar for Desktop */}
            <div className="w-full md:w-64 lg:w-72 flex-shrink-0 hidden md:block border-r pr-4 self-stretch overflow-y-auto">
                 {/* Display persistent config error Alert if any */}
                 {configError && !isConfigLoading && (
                    <Alert variant="destructive" className="mb-2">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Config Error</AlertTitle>
                        <AlertDescription>
                             {configError} <Link href="/settings" className="underline">Check Settings</Link>.
                        </AlertDescription>
                    </Alert>
                 )}
                {/* Specifications Section */}
                <div className="mb-4">
                    <div className="flex justify-between items-center mb-2 sticky top-0 bg-background pb-2 z-10">
                        <h3 className="text-lg font-semibold">Specifications</h3>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="px-1 py-0 h-auto"
                            onClick={() => handleAddNewFile('specs')}
                            disabled={sidebarActionsDisabled}
                            title={configErrorTooltip || "Add new specification file"}
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                    <ul className="space-y-1">
                        {(isLoadingFiles || isConfigLoading) && <Skeleton className="h-20 w-full" />}
                        {/* Display file error only if no config error */}
                        {filesError && !configError && !isLoadingFiles && <li className="text-red-500 text-xs px-3 py-1">Error: {filesError}</li>}
                        {!isLoadingFiles && !isConfigLoading && !configError && !filesError && renderSidebarList(combinedFiles().specs, 'specs')}
                        {!isLoadingFiles && !isConfigLoading && !configError && !filesError && combinedFiles().specs.length === 0 && (
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
                            disabled={sidebarActionsDisabled}
                            title={configErrorTooltip || "Add new rule file"}
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                     <ul className="space-y-1">
                        {(isLoadingFiles || isConfigLoading) && <Skeleton className="h-12 w-full" />}
                        {/* Error shown above is enough */}
                        {!isLoadingFiles && !isConfigLoading && !configError && !filesError && renderSidebarList(combinedFiles().rules, 'rules')}
                        {!isLoadingFiles && !isConfigLoading && !configError && !filesError && combinedFiles().rules.length === 0 && (
                            <li className="text-sm text-muted-foreground px-3 py-1 italic">No rules found.</li>
                        )}
                    </ul>
                </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 min-w-0">
                {renderEditor()}
            </div>
        </div>
    );
}
