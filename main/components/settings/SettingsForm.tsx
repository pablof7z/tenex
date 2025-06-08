"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import React, { useEffect, useState } from "react";

const BACKEND_URL_KEY = "backendUrl";
const BACKEND_COMMAND_KEY = "backendCommand";
const PROJECTS_PATH_KEY = "projectsPath";
const DEFAULT_BACKEND_URL = "/api"; // Define default here for clarity
const DEFAULT_BACKEND_COMMAND = "npx tenex"; // Default command for running TENEX CLI

export function SettingsForm() {
    // Initialize state by reading from localStorage or using default
    const [backendUrl, setBackendUrl] = useState(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem(BACKEND_URL_KEY) ?? DEFAULT_BACKEND_URL;
        }
        return DEFAULT_BACKEND_URL; // Default for SSR or initial state
    });

    const [backendCommand, setBackendCommand] = useState(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem(BACKEND_COMMAND_KEY) ?? DEFAULT_BACKEND_COMMAND;
        }
        return DEFAULT_BACKEND_COMMAND; // Default for SSR or initial state
    });

    const [projectsPath, setProjectsPath] = useState<string | null>(null);

    const { toast } = useToast();

    // Effect to update state if localStorage changes externally (less common, but good practice)
    useEffect(() => {
        const handleStorageChange = () => {
            setBackendUrl(localStorage.getItem(BACKEND_URL_KEY) ?? DEFAULT_BACKEND_URL);
            setBackendCommand(localStorage.getItem(BACKEND_COMMAND_KEY) ?? DEFAULT_BACKEND_COMMAND);
        };
        window.addEventListener("storage", handleStorageChange);
        return () => window.removeEventListener("storage", handleStorageChange);
    }, []);

    // Fetch the projects path from the backend
    useEffect(() => {
        const fetchProjectsPath = async () => {
            try {
                const apiUrl = localStorage.getItem(BACKEND_URL_KEY) ?? DEFAULT_BACKEND_URL;
                const response = await fetch(`${apiUrl}/projects/path`);
                if (response.ok) {
                    const data = await response.json();
                    setProjectsPath(data.projectsPath);
                }
            } catch (error) {
                console.error("Failed to fetch projects path:", error);
            }
        };
        fetchProjectsPath();
    }, []);

    const handleSave = () => {
        try {
            const urlToSave = backendUrl.trim();
            const commandToSave = backendCommand.trim();

            // Validation: Allow empty string (to reset to default), relative /api, or full http(s) URL
            if (urlToSave === "") {
                // If user clears the input, save empty string to reset to default '/api' on next load
                localStorage.setItem(BACKEND_URL_KEY, "");
                setBackendUrl(""); // Update state to reflect empty input
            } else if (urlToSave === DEFAULT_BACKEND_URL) {
                // Explicitly setting to default '/api' is fine
                localStorage.setItem(BACKEND_URL_KEY, urlToSave);
                setBackendUrl(urlToSave);
            } else if (urlToSave.startsWith("http://") || urlToSave.startsWith("https://")) {
                // Valid absolute URL
                const finalUrl = urlToSave.endsWith("/") ? urlToSave.slice(0, -1) : urlToSave; // Remove trailing slash
                localStorage.setItem(BACKEND_URL_KEY, finalUrl);
                setBackendUrl(finalUrl);
            } else {
                // Invalid format
                throw new Error(
                    `Invalid URL format. Must be empty (for default '${DEFAULT_BACKEND_URL}'), '${DEFAULT_BACKEND_URL}', or start with http:// or https://`,
                );
            }

            // Save backend command
            if (commandToSave === "") {
                localStorage.setItem(BACKEND_COMMAND_KEY, "");
                setBackendCommand("");
            } else {
                localStorage.setItem(BACKEND_COMMAND_KEY, commandToSave);
                setBackendCommand(commandToSave);
            }

            toast({
                title: "Settings Saved",
                description: `Backend URL: ${urlToSave || DEFAULT_BACKEND_URL}, Command: ${commandToSave || DEFAULT_BACKEND_COMMAND}. Reload may be needed.`,
            });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Could not save settings.";
            toast({
                title: "Error Saving Settings",
                description: message,
                variant: "destructive",
            });
        }
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="backend-url">Backend API URL</Label>
                <Input
                    id="backend-url"
                    type="text" // Use text to allow relative path easily
                    placeholder={`Default: ${DEFAULT_BACKEND_URL} or e.g., https://my-api.com`}
                    value={backendUrl}
                    onChange={(e) => setBackendUrl(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                    Enter the full base URL for the backend API (e.g., https://api.yourdomain.com) or leave empty/set to
                    '{DEFAULT_BACKEND_URL}' to use the default relative path (requires frontend and backend on the same
                    domain). A page reload might be required for the changes to apply everywhere.
                </p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="backend-command">Backend Command</Label>
                <Input
                    id="backend-command"
                    type="text"
                    placeholder={`Default: ${DEFAULT_BACKEND_COMMAND} or e.g., bun ./cli/bin/tenex.ts`}
                    value={backendCommand}
                    onChange={(e) => setBackendCommand(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                    Command to run the TENEX CLI. Default is '{DEFAULT_BACKEND_COMMAND}' which uses npm to run the
                    published package. For local development, you can use 'bun ./cli/bin/tenex.ts' to run the local CLI
                    directly.
                </p>
            </div>

            <Button onClick={handleSave}>Save Settings</Button>

            <div className="mt-8 space-y-2">
                <Label>Projects Directory</Label>
                <div className="p-3 bg-muted rounded-md font-mono text-sm">{projectsPath || "Loading..."}</div>
                <p className="text-sm text-muted-foreground">
                    This is the directory where all TENEX projects are stored. It is configured via the PROJECTS_PATH
                    environment variable on the server.
                </p>
            </div>
        </div>
    );
}
