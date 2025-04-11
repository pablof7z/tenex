"use client";

import React, { useState, useEffect } from 'react';
import { NDKProject } from '@/lib/nostr/events/project';
import { ProductSpec } from './ProductSpec'; // Import the original ProductSpec component
// Removed import for the complex Sidebar component: import { Sidebar } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface ProjectSpecsTabProps {
  project: NDKProject;
  projectId: string;
}

interface SpecFile {
  name: string;
  content: string;
}

export function ProjectSpecsTab({ project, projectId }: ProjectSpecsTabProps) {
  const [specFiles, setSpecFiles] = useState<SpecFile[]>([]);
  const [selectedSpec, setSelectedSpec] = useState<string>('project'); // 'project' or filename
  const [isLoadingFiles, setIsLoadingFiles] = useState(true); // Renamed for clarity
  const [filesError, setFilesError] = useState<string | null>(null); // Renamed for clarity
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSpecFiles = async () => {
      setIsLoadingFiles(true); // Use renamed state
      setFilesError(null); // Use renamed state
      try {
        const response = await fetch(`/api/projects/${projectId}/specs`);
        if (!response.ok) {
          // Handle 404 specifically - means no context dir or files, not necessarily an error
          if (response.status === 404) {
             console.log(`No spec files found for project ${projectId} (404).`);
             setSpecFiles([]);
          } else {
            throw new Error(`Failed to fetch spec files: ${response.status} ${response.statusText}`);
          }
        } else {
            const data = await response.json();
            setSpecFiles(data.files || []);
        }
      } catch (err: any) {
        console.error("Error fetching spec files:", err);
        setFilesError(err.message || 'An unknown error occurred'); // Use renamed state
        setSpecFiles([]); // Clear files on error
      } finally {
        setIsLoadingFiles(false); // Use renamed state
      }
    };

    fetchSpecFiles();
  }, [projectId]);

  const handleSaveSpec = async (content: string) => {
    console.log(`Attempting to save spec file via API for project ${projectId}...`);
    setIsSaving(true);
    setSaveError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/specs`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(errorData.error || `Failed to save spec file: ${response.status} ${response.statusText}`);
      }

      console.log("Spec file saved successfully via API.");
      // TODO: Add user feedback (e.g., toast notification)
      // toast({ title: "Success", description: "Project specification saved." });

    } catch (error: any) {
      console.error("Failed to save spec file via API:", error);
      setSaveError(error.message || 'An unknown error occurred while saving.');
      // TODO: Add user feedback for error
      // toast({ variant: "destructive", title: "Error", description: `Failed to save specification: ${error.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  const renderContent = () => {
    if (isLoadingFiles) { // Use renamed state
        return <Skeleton className="h-[400px] w-full" />; // Show skeleton while loading initial files list
    }
    if (selectedSpec === 'project') {
      // Pass saving state to ProductSpec if needed, or handle feedback here
      return <ProductSpec project={project} onSave={handleSaveSpec} />; // Consider adding isSaving prop if button needs disabling
    }
    const file = specFiles.find(f => f.name === selectedSpec);
    return file ? (
        <Card>
            <CardHeader>
                <CardTitle>{file.name}</CardTitle>
            </CardHeader>
            <CardContent>
                <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-4 rounded">{file.content}</pre>
            </CardContent>
        </Card>
    ) : (
         // This case might happen if files load but the selected one isn't found (e.g., after an error)
        <p>Select a spec file from the sidebar or check for errors.</p>
    );
  };

  return (
    // Ensure the parent flex container allows the sidebar and content to take height
    <div className="flex flex-col md:flex-row gap-6 flex-1"> {/* Added flex-1 to allow stretching */}
       {/* Sidebar for mobile (Drawer or Accordion might be better) */}
       <div className="md:hidden mb-4">
            <select
                value={selectedSpec}
                onChange={(e) => setSelectedSpec(e.target.value)}
                className="w-full p-2 border rounded bg-background"
            >
                <option value="project">Project Spec</option>
                {isLoadingFiles && <option disabled>Loading files...</option>}
                {filesError && <option disabled>Error loading files</option>}
                {!isLoadingFiles && !filesError && specFiles.map(file => (
                    <option key={file.name} value={file.name}>{file.name}</option>
                ))}
                {!isLoadingFiles && !filesError && specFiles.length === 0 && <option disabled>No context files</option>}
            </select>
             {filesError && <p className="text-red-500 text-xs mt-1">Error: {filesError}</p>}
             {/* Display save error near the save button or relevant area if needed */}
             {saveError && <p className="text-red-500 text-xs mt-1">Save Error: {saveError}</p>}
       </div>

      {/* Sidebar for Desktop - Replaced Sidebar component with a styled div */}
      {/* Use a simple div for the local sidebar */}
      <div className="w-full md:w-64 lg:w-72 flex-shrink-0 hidden md:block border-r pr-4 self-stretch overflow-y-auto"> {/* Fixed width, allow vertical scroll, stretch height */}
        <h3 className="text-lg font-semibold mb-4 sticky top-0 bg-background pb-2">Specifications</h3> {/* Make header sticky */}
        <ul className="space-y-1">
          <li>
            <button
              onClick={() => setSelectedSpec('project')}
              className={`w-full text-left px-3 py-1.5 rounded text-sm ${selectedSpec === 'project' ? 'bg-muted font-medium' : 'hover:bg-muted/50'}`}
            >
              Project Spec
            </button>
          </li>
          {isLoadingFiles && ( // Use renamed state
            <>
              <Skeleton className="h-7 w-full mt-1" />
              <Skeleton className="h-7 w-full mt-1" />
            </>
          )}
          {filesError && !isLoadingFiles && <li className="text-red-500 text-xs px-3 py-1">Error: {filesError}</li>}
          {!isLoadingFiles && !filesError && specFiles.map((file) => ( // Use renamed state
            <li key={file.name}>
              <button
                onClick={() => setSelectedSpec(file.name)}
                className={`w-full text-left px-3 py-1.5 rounded truncate text-sm ${selectedSpec === file.name ? 'bg-muted font-medium' : 'hover:bg-muted/50'}`}
                title={file.name}
              >
                {file.name}
              </button>
            </li>
          ))}
           {!isLoadingFiles && !filesError && specFiles.length === 0 && ( // Use renamed state
             <li className="text-sm text-muted-foreground px-3 py-1 italic">No context files found.</li>
           )}
        </ul>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 overflow-y-auto"> {/* Allow content to scroll if needed */}
        {renderContent()}
      </div>
    </div>
  );
}