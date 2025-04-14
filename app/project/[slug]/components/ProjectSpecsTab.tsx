"use client";

import React, { useState, useEffect, useCallback } from "react";
import { NDKProject } from "@/lib/nostr/events/project";
import { useToast } from "@/components/ui/use-toast";
import { useConfig } from "@/hooks/useConfig";
import { SpecsSidebar } from "./SpecsSidebar"; // Import Sidebar
import { SpecsEditor } from "./SpecsEditor"; // Import Editor

interface FileData {
    name: string;
    content: string;
}

interface ProjectSpecsTabProps {
    project: NDKProject;
    projectSlug: string;
}

const DEFAULT_SPEC_FILENAME = "SPEC.md";
const DEFAULT_SPEC_CONTENT = `# Project Specification\n\nAdd your project details here.`;

export function ProjectSpecsTab({ project, projectSlug }: ProjectSpecsTabProps) {
    const { toast } = useToast();
    const { getApiUrl, isLoading: isConfigLoading, isReady: isConfigReady, error: configError } = useConfig();

    // --- State Management ---
    // File lists and loading state
    const [specFiles, setSpecFiles] = useState<FileData[]>([]);
    const [ruleFiles, setRuleFiles] = useState<FileData[]>([]);
    const [isLoadingFiles, setIsLoadingFiles] = useState(true);
    const [filesError, setFilesError] = useState<string | null>(null); // For fetch/save errors

    // Selection state
    const [selectedFileName, setSelectedFileName] = useState<string>(DEFAULT_SPEC_FILENAME);
    const [selectedGroup, setSelectedGroup] = useState<"specs" | "rules">("specs");

    // Editor state (managed here to coordinate save/AI actions)
    const [editorContent, setEditorContent] = useState<string>("");
    const [isSaving, setIsSaving] = useState(false);
    const [isEditorLoading, setIsEditorLoading] = useState(false); // AI loading
    const [previousEditorContent, setPreviousEditorContent] = useState<string | null>(null);
    const [isAiContent, setIsAiContent] = useState(false);

    // --- Data Fetching ---
    const fetchFiles = useCallback(async () => {
        if (!isConfigReady) {
            setIsLoadingFiles(false);
            setFilesError(null);
            setSpecFiles([]);
            setRuleFiles([]);
            setEditorContent("");
            return;
        }
        setIsLoadingFiles(true);
        setFilesError(null);
        const apiUrl = getApiUrl(`/projects/${projectSlug}/specs`);

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                if (response.status === 404) {
                    console.log(`Project specs/rules endpoint returned 404 for project ${projectSlug}. Assuming empty.`);
                    setSpecFiles([]);
                    setRuleFiles([]);
                } else {
                    const errorText = await response.text().catch(() => `Status ${response.status}`);
                    throw new Error(`Failed to fetch files: ${response.status} ${errorText}`);
                }
            } else {
                const data = await response.json();
                setSpecFiles(data.specs || []);
                setRuleFiles(data.rules || []);
                // Selection logic is handled by the useEffect below
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
    }, [projectSlug, isConfigReady, getApiUrl]);

    useEffect(() => {
        fetchFiles();
    }, [fetchFiles]);

    // --- Selection Validation Effect ---
    useEffect(() => {
        if (isLoadingFiles || !isConfigReady) return;

        const allFiles = [...specFiles, ...ruleFiles];
        const currentSelectionExists = allFiles.some(
            (f) =>
                f.name === selectedFileName &&
                ((selectedGroup === "specs" && specFiles.some((s) => s.name === selectedFileName)) ||
                    (selectedGroup === "rules" && ruleFiles.some((r) => r.name === selectedFileName))),
        );
        const defaultSpecExists = specFiles.some((f: FileData) => f.name === DEFAULT_SPEC_FILENAME);

        if (!currentSelectionExists) {
            // Reset selection if the currently selected file disappears
            if (defaultSpecExists) {
                setSelectedFileName(DEFAULT_SPEC_FILENAME);
                setSelectedGroup("specs");
            } else if (specFiles.length > 0) {
                setSelectedFileName(specFiles[0].name);
                setSelectedGroup("specs");
            } else if (ruleFiles.length > 0) {
                setSelectedFileName(ruleFiles[0].name);
                setSelectedGroup("rules");
            } else {
                // Fallback: Default to SPEC.md even if it doesn't exist yet
                setSelectedFileName(DEFAULT_SPEC_FILENAME);
                setSelectedGroup("specs");
            }
        }
    }, [specFiles, ruleFiles, selectedFileName, selectedGroup, isLoadingFiles, isConfigReady]);

    // --- Update Editor Content Effect ---
    useEffect(() => {
        if (!isConfigReady) {
            setEditorContent("");
            return;
        }

        let file: FileData | undefined;
        if (selectedGroup === "specs") {
            file = specFiles.find((f) => f.name === selectedFileName);
        } else {
            file = ruleFiles.find((f) => f.name === selectedFileName);
        }

        if (selectedGroup === "specs" && selectedFileName === DEFAULT_SPEC_FILENAME) {
            // Handle SPEC.md specifically (use default content if it doesn't exist)
            setEditorContent(
                file?.content ?? (specFiles.length > 0 || ruleFiles.length > 0 ? "" : DEFAULT_SPEC_CONTENT),
            );
        } else {
            setEditorContent(file?.content ?? "");
        }

        // Reset AI state when changing files (unless it's the existing SPEC.md)
        const isDefaultSpecPlaceholder =
            selectedGroup === "specs" &&
            selectedFileName === DEFAULT_SPEC_FILENAME &&
            !specFiles.some((f) => f.name === DEFAULT_SPEC_FILENAME);
        if (!(selectedGroup === "specs" && selectedFileName === DEFAULT_SPEC_FILENAME) || isDefaultSpecPlaceholder) {
            setIsAiContent(false);
            setPreviousEditorContent(null);
        }
        setIsSaving(false); // Reset saving state when selection changes
    }, [selectedFileName, selectedGroup, specFiles, ruleFiles, isConfigReady]);

    // --- Handlers ---
    const handleFileSelect = (name: string, group: "specs" | "rules") => {
        setSelectedFileName(name);
        setSelectedGroup(group);
        // Editor content update is handled by the useEffect above
    };

    const handleEditorContentChange = (newContent: string) => {
        setEditorContent(newContent);
        // Reset AI state if user edits SPEC.md after AI improvement
        if (selectedGroup === "specs" && selectedFileName === DEFAULT_SPEC_FILENAME && isAiContent) {
            setIsAiContent(false);
            // Keep previousEditorContent in case they want to save *then* undo
        }
    };

    const handleSaveFile = async () => {
        if (!isConfigReady || !selectedFileName || !selectedGroup) {
            toast({ title: "Cannot Save", description: configError || "Configuration or selection missing.", variant: "destructive" });
            return;
        }
        const apiUrl = getApiUrl(`/projects/${projectSlug}/specs`);
        setIsSaving(true);
        setFilesError(null); // Clear previous save errors

        try {
            const response = await fetch(apiUrl, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fileName: selectedFileName,
                    content: editorContent,
                    group: selectedGroup,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: "Failed to parse error response" }));
                throw new Error(errorData.error || `Failed to save ${selectedFileName}: ${response.status} ${response.statusText}`);
            }

            toast({ title: "Success", description: `${selectedFileName} saved.` });

            // Update local state optimistically
            const updatedFile = { name: selectedFileName, content: editorContent };
            if (selectedGroup === "specs") {
                setSpecFiles((prev) => {
                    const index = prev.findIndex((f) => f.name === selectedFileName);
                    if (index > -1) {
                        const updated = [...prev]; updated[index] = updatedFile; return updated;
                    }
                    return [...prev, updatedFile].sort((a, b) => a.name.localeCompare(b.name));
                });
            } else {
                setRuleFiles((prev) => {
                    const index = prev.findIndex((f) => f.name === selectedFileName);
                    if (index > -1) {
                        const updated = [...prev]; updated[index] = updatedFile; return updated;
                    }
                    return [...prev, updatedFile].sort((a, b) => a.name.localeCompare(b.name));
                });
            }
            // Reset AI state on successful save of SPEC.md
            if (selectedGroup === "specs" && selectedFileName === DEFAULT_SPEC_FILENAME) {
                setIsAiContent(false);
                setPreviousEditorContent(null);
            }
        } catch (error: unknown) {
            console.error(`Failed to save ${selectedFileName}:`, error);
            const message = error instanceof Error ? error.message : "An unknown error occurred";
            setFilesError(message); // Set file-specific error for the editor
            toast({ variant: "destructive", title: "Error Saving File", description: message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleImproveSpec = async () => {
        if (!isConfigReady || !(selectedGroup === "specs" && selectedFileName === DEFAULT_SPEC_FILENAME)) {
            toast({ title: "Cannot Improve", description: configError || "Can only improve SPEC.md.", variant: "destructive" });
            return;
        }
        const apiUrl = getApiUrl("/run?cmd=improve-project-spec");
        setIsEditorLoading(true);
        setPreviousEditorContent(editorContent); // Store current content before AI modifies it
        setIsAiContent(false);
        setFilesError(null); // Clear previous errors

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
                setIsAiContent(true); // Mark content as AI-generated
                toast({ title: "Specification Improved", description: "Review the changes and save if desired." });
            } else {
                throw new Error("Received empty response from AI.");
            }
        } catch (error: unknown) {
            console.error("Failed to improve spec:", error);
            const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
            setFilesError(errorMessage); // Show error in editor area
            toast({ variant: "destructive", title: "Improvement Failed", description: errorMessage });
            setPreviousEditorContent(null); // Clear undo state on failure
        } finally {
            setIsEditorLoading(false);
        }
    };

    const handleUndoAiImprovement = () => {
        if (previousEditorContent !== null && selectedGroup === "specs" && selectedFileName === DEFAULT_SPEC_FILENAME) {
            setEditorContent(previousEditorContent);
            setIsAiContent(false);
            setPreviousEditorContent(null); // Clear undo state
            toast({ title: "Undo Successful", description: "Reverted to the previous specification." });
        }
    };

    const handleAddNewFile = async (group: "specs" | "rules") => {
        if (!isConfigReady) {
            toast({ title: "Configuration Error", description: configError || "Configuration not ready.", variant: "destructive" });
            return;
        }
        const fileName = prompt(`Enter the name for the new ${group} file (e.g., FILENAME.md):`);
        if (!fileName || !fileName.trim()) return;

        const trimmedName = fileName.trim();
        if (!trimmedName.endsWith(".md")) {
            toast({ variant: "destructive", title: "Invalid Name", description: "File name must end with .md" }); return;
        }
        if (trimmedName.includes("/") || trimmedName.includes("..")) {
            toast({ variant: "destructive", title: "Invalid Name", description: "File name cannot contain '/' or '..'" }); return;
        }

        const fileExists = group === "specs" ? specFiles.some((f) => f.name === trimmedName) : ruleFiles.some((f) => f.name === trimmedName);
        if (fileExists) {
            toast({ variant: "destructive", title: "File Exists", description: `A file named "${trimmedName}" already exists.` }); return;
        }

        const apiUrl = getApiUrl(`/projects/${projectSlug}/specs`);
        setIsSaving(true); // Use isSaving state to indicate activity
        setFilesError(null);

        try {
            // Create the file with empty content via the PUT endpoint
            const response = await fetch(apiUrl, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileName: trimmedName, content: "", group }),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: "Failed to parse error response" }));
                throw new Error(errorData.error || `Failed to create ${trimmedName}: ${response.status} ${response.statusText}`);
            }

            // Optimistically update local state and select the new file
            const newFile = { name: trimmedName, content: "" };
            if (group === "specs") {
                setSpecFiles((prev) => [...prev, newFile].sort((a, b) => a.name.localeCompare(b.name)));
            } else {
                setRuleFiles((prev) => [...prev, newFile].sort((a, b) => a.name.localeCompare(b.name)));
            }
            setSelectedFileName(trimmedName);
            setSelectedGroup(group);
            setEditorContent(""); // Set editor to empty for the new file
            toast({ title: "Success", description: `${trimmedName} created.` });
        } catch (error: unknown) {
            console.error(`Failed to create ${trimmedName}:`, error);
            const message = error instanceof Error ? error.message : "An unknown error occurred";
            setFilesError(message); // Show error
            toast({ variant: "destructive", title: "Error Creating File", description: message });
        } finally {
            setIsSaving(false);
        }
    };

    // --- Render Logic ---
    // Removed mobile-specific rendering and renderEditor function

    return (
        <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-6 h-full">
            {/* Sidebar (Desktop) */}
            <div className="hidden md:block h-full overflow-y-auto">
                <SpecsSidebar
                    specFiles={specFiles}
                    ruleFiles={ruleFiles}
                    selectedFileName={selectedFileName}
                    selectedGroup={selectedGroup}
                    onFileSelect={handleFileSelect}
                    onAddNewFile={handleAddNewFile}
                    isLoading={isLoadingFiles}
                    isConfigReady={isConfigReady}
                    configError={configError}
                />
            </div>

            {/* Editor Area */}
            <div className="h-full">
                {/* Mobile File Selector - Rendered within Editor now if needed, or handled differently */}
                {/* TODO: Re-evaluate mobile file selection approach if needed */}
                <SpecsEditor
                    editorContent={editorContent}
                    selectedFileName={selectedFileName}
                    selectedGroup={selectedGroup}
                    onContentChange={handleEditorContentChange}
                    onSave={handleSaveFile}
                    onImproveSpec={handleImproveSpec}
                    onUndoImprovement={handleUndoAiImprovement}
                    isSaving={isSaving}
                    isEditorLoading={isEditorLoading}
                    isAiContent={isAiContent}
                    previousEditorContent={previousEditorContent}
                    isConfigReady={isConfigReady}
                    configError={configError}
                    isLoadingFiles={isLoadingFiles}
                    filesError={filesError} // Pass file-specific errors
                />
            </div>
        </div>
    );
}
