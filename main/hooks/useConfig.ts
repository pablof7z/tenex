import { useCallback, useEffect, useState } from "react";

const LOCAL_STORAGE_KEY = "backendUrl";
// Default to relative path for same-origin deployment
const DEFAULT_BACKEND_URL = "/api";

export function useConfig() {
    const [backendUrl, setBackendUrl] = useState<string>(DEFAULT_BACKEND_URL); // Initialize with default
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null); // Store potential config errors

    useEffect(() => {
        // This effect runs only on the client-side
        setError(null); // Clear errors on re-check
        try {
            const savedUrl = localStorage.getItem(LOCAL_STORAGE_KEY);
            // Use saved URL if it exists and is not empty, otherwise stick to default
            const effectiveUrl = savedUrl || DEFAULT_BACKEND_URL;
            setBackendUrl(effectiveUrl);

            // Basic validation for explicitly set URLs
            if (savedUrl && !savedUrl.startsWith("/") && !savedUrl.startsWith("http")) {
                setError(
                    `Invalid Backend URL stored: "${savedUrl}". Must start with http(s):// or /. Using default '/api'.`,
                );
                setBackendUrl(DEFAULT_BACKEND_URL); // Fallback to default if stored value is invalid
            }
        } catch (err) {
            console.error("Error reading backend URL from localStorage:", err);
            setError("Error reading configuration from localStorage. Using default '/api'.");
            setBackendUrl(DEFAULT_BACKEND_URL); // Fallback if localStorage fails
        } finally {
            setIsLoading(false);
        }
    }, []); // Run only once on mount

    const getApiUrl = useCallback(
        (path: string): string => {
            // Ensure path starts with a slash
            const cleanPath = path.startsWith("/") ? path : `/${path}`;

            // If backendUrl itself is relative (starts with '/'), just return the combined path
            if (backendUrl.startsWith("/")) {
                // Avoid double slashes if backendUrl is just '/'
                const base = backendUrl === "/" ? "" : backendUrl;
                return `${base}${cleanPath}`;
            }

            // If backendUrl is absolute, combine them
            // Ensure backendUrl doesn't end with a slash before appending path
            const cleanBackendUrl = backendUrl.endsWith("/") ? backendUrl.slice(0, -1) : backendUrl;
            return `${cleanBackendUrl}${cleanPath}`;
        },
        [backendUrl],
    ); // Depend only on backendUrl

    // isReady is true if not loading and no error occurred during loading/validation
    const isReady = !isLoading && !error;

    return { backendUrl, isLoading, isReady, error, getApiUrl };
}
