import React from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";

interface FileData {
    name: string;
    content: string; // Keep content for potential future use (e.g., showing status)
}

interface SpecsSidebarProps {
    specFiles: FileData[];
    ruleFiles: FileData[];
    selectedFileName: string;
    selectedGroup: "specs" | "rules";
    onFileSelect: (name: string, group: "specs" | "rules") => void;
    onAddNewFile: (group: "specs" | "rules") => void;
    isLoading: boolean;
    isConfigReady: boolean;
    configError: string | null;
}

const DEFAULT_SPEC_FILENAME = "SPEC.md"; // Keep consistent with parent

export function SpecsSidebar({
    specFiles,
    ruleFiles,
    selectedFileName,
    selectedGroup,
    onFileSelect,
    onAddNewFile,
    isLoading,
    isConfigReady,
    configError,
}: SpecsSidebarProps) {
    const actionsDisabled = !isConfigReady || isLoading;

    // Ensure default SPEC.md is always in the list for rendering
    const combinedFiles = React.useCallback(() => {
        const specMdInList = specFiles.some((f) => f.name === DEFAULT_SPEC_FILENAME);
        const specsToShow = specMdInList
            ? [...specFiles]
            : [{ name: DEFAULT_SPEC_FILENAME, content: "" }, ...specFiles];

        return {
            specs: specsToShow.sort((a, b) => a.name.localeCompare(b.name)),
            rules: [...ruleFiles].sort((a, b) => a.name.localeCompare(b.name)),
        };
    }, [specFiles, ruleFiles]);

    const renderSidebarList = (files: FileData[], group: "specs" | "rules") =>
        files.map((file) => (
            <Button
                key={`${group}-${file.name}`}
                variant={selectedFileName === file.name && selectedGroup === group ? "secondary" : "ghost"}
                className="w-full justify-start text-left h-8 px-2 rounded-md"
                onClick={() => {
                    if (!isLoading) { // Prevent selection change while loading initial files
                        onFileSelect(file.name, group);
                    }
                }}
                disabled={isLoading} // Disable individual buttons while loading
            >
                {file.name}
            </Button>
        ));

    return (
        <div className="space-y-4 pr-4 border-r border-border h-full flex flex-col">
            {/* Configuration Error Alert */}
            {configError && !isLoading && (
                <Alert variant="destructive" className="mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Config Error</AlertTitle>
                    <AlertDescription>
                        {configError}{" "}
                        <Link href="/settings" className="underline">
                            Check Settings
                        </Link>
                    </AlertDescription>
                </Alert>
            )}

            {/* Specifications Section */}
            <div className="flex-shrink-0">
                <div className="flex justify-between items-center mb-2 sticky top-0 bg-background pb-2 z-10">
                    <h3 className="text-sm font-semibold text-muted-foreground">Specifications</h3>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-md"
                        onClick={() => onAddNewFile("specs")}
                        disabled={actionsDisabled}
                        title={!isConfigReady ? "Configure Backend URL first" : "Add New Specification"}
                    >
                        <Plus className="h-4 w-4" />
                        <span className="sr-only">Add Specification</span>
                    </Button>
                </div>
                <div className="space-y-1">
                    {isLoading ? (
                        <>
                            <Skeleton className="h-8 w-full rounded-md" />
                            <Skeleton className="h-8 w-full rounded-md" />
                        </>
                    ) : (
                        renderSidebarList(combinedFiles().specs, "specs")
                    )}
                </div>
            </div>

            {/* Rules Section */}
            <div className="flex-shrink-0 pt-4">
                 {/* Added sticky positioning and background for Rules header */}
                <div className="flex justify-between items-center mb-2 sticky top-[calc(2rem+1.5rem)] bg-background pb-2 z-10">
                    <h3 className="text-sm font-semibold text-muted-foreground">Rules</h3>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-md"
                        onClick={() => onAddNewFile("rules")}
                        disabled={actionsDisabled}
                        title={!isConfigReady ? "Configure Backend URL first" : "Add New Rule"}
                    >
                        <Plus className="h-4 w-4" />
                        <span className="sr-only">Add Rule</span>
                    </Button>
                </div>
                <div className="space-y-1">
                    {isLoading ? (
                        <Skeleton className="h-8 w-full rounded-md" />
                    ) : (
                        renderSidebarList(combinedFiles().rules, "rules")
                    )}
                     {/* Add a placeholder if no rules and not loading */}
                     {!isLoading && ruleFiles.length === 0 && (
                        <p className="text-xs text-muted-foreground px-2 py-1">No rules defined yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
}