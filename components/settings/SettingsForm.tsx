"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

const LOCAL_STORAGE_KEY = "backendUrl";
const DEFAULT_BACKEND_URL = "/api"; // Define default here for clarity

export function SettingsForm() {
  // Initialize state by reading from localStorage or using default
  const [backendUrl, setBackendUrl] = useState(() => {
      if (typeof window !== 'undefined') {
          return localStorage.getItem(LOCAL_STORAGE_KEY) ?? DEFAULT_BACKEND_URL;
      }
      return DEFAULT_BACKEND_URL; // Default for SSR or initial state
  });
  const { toast } = useToast();

  // Effect to update state if localStorage changes externally (less common, but good practice)
  useEffect(() => {
    const handleStorageChange = () => {
      setBackendUrl(localStorage.getItem(LOCAL_STORAGE_KEY) ?? DEFAULT_BACKEND_URL);
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);


  const handleSave = () => {
    try {
      const urlToSave = backendUrl.trim();

      // Validation: Allow empty string (to reset to default), relative /api, or full http(s) URL
      if (urlToSave === "") {
          // If user clears the input, save empty string to reset to default '/api' on next load
          localStorage.setItem(LOCAL_STORAGE_KEY, "");
          setBackendUrl(""); // Update state to reflect empty input
          toast({
            title: "Settings Saved",
            description: `Backend URL reset to default (${DEFAULT_BACKEND_URL}). Reload required for changes to take effect everywhere.`,
          });
          // Optionally force a reload: window.location.reload();
          return; // Exit after saving empty string
      } else if (urlToSave === DEFAULT_BACKEND_URL) {
          // Explicitly setting to default '/api' is fine
          localStorage.setItem(LOCAL_STORAGE_KEY, urlToSave);
          setBackendUrl(urlToSave);
          toast({
            title: "Settings Saved",
            description: `Backend URL set to default: ${urlToSave}. Reload may be needed.`,
          });
          return;
      } else if (urlToSave.startsWith("http://") || urlToSave.startsWith("https://")) {
          // Valid absolute URL
          const finalUrl = urlToSave.endsWith('/') ? urlToSave.slice(0, -1) : urlToSave; // Remove trailing slash
          localStorage.setItem(LOCAL_STORAGE_KEY, finalUrl);
          setBackendUrl(finalUrl);
          toast({
            title: "Settings Saved",
            description: `Backend URL set to: ${finalUrl}. Reload may be needed.`,
          });
          return;
      } else {
          // Invalid format
          throw new Error(`Invalid format. Must be empty (for default '${DEFAULT_BACKEND_URL}'), '${DEFAULT_BACKEND_URL}', or start with http:// or https://`);
      }

    } catch (error: unknown) {
       const message = error instanceof Error ? error.message : "Could not save backend URL.";
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
          Enter the full base URL for the backend API (e.g., https://api.yourdomain.com) or leave empty/set to '{DEFAULT_BACKEND_URL}' to use the default relative path (requires frontend and backend on the same domain). A page reload might be required for the changes to apply everywhere.
        </p>
      </div>
      <Button onClick={handleSave}>Save Settings</Button>
    </div>
  );
}