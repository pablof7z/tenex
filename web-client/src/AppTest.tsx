import NDKCacheSQLiteWASM from "@nostr-dev-kit/ndk-cache-sqlite-wasm";
import { NDKHeadless, NDKSessionLocalStorage } from "@nostr-dev-kit/ndk-hooks";
import { useAtomValue } from "jotai";
import { useEffect, useRef } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
const DEFAULT_RELAYS = [
    "wss://relay.damus.io",
    "wss://relay.primal.net",
    "wss://relay.nostr.band",
    "wss://nos.lol",
];
import { Toaster } from "sonner";
import { LoginScreen } from "./components/auth/LoginScreen";
import { themeAtom } from "./lib/store";

function TestContent() {
    return (
        <div style={{ padding: "20px" }}>
            <h1>TENEX App - Test</h1>
            <p>React Router is working!</p>
        </div>
    );
}

function AppTestContent() {
    const sessionStorage = useRef(new NDKSessionLocalStorage());
    const cache = useRef<NDKCacheSQLiteWASM | null>(null);
    const theme = useAtomValue(themeAtom);

    // Initialize SQLite cache
    useEffect(() => {
        if (!cache.current) {
            cache.current = new NDKCacheSQLiteWASM({
                dbName: "tenex-cache",
                wasmUrl: "/sql-wasm.wasm",
                workerUrl: "/worker.js",
            });
        }
    }, []);

    return (
        <>
            <NDKHeadless
                ndk={{
                    explicitRelayUrls: [...DEFAULT_RELAYS, "wss://purplepag.es"],
                    cacheAdapter: cache.current || undefined,
                }}
                session={{
                    storage: sessionStorage.current,
                    opts: { follows: true, profile: true },
                }}
            />
            <Toaster
                position="top-right"
                toastOptions={{
                    style: {
                        background: theme === "dark" ? "#1a1a1a" : "#ffffff",
                        color: theme === "dark" ? "#ffffff" : "#000000",
                        border: theme === "dark" ? "1px solid #333" : "1px solid #e5e5e5",
                    },
                }}
            />
            <Routes>
                <Route path="/" element={<TestContent />} />
                <Route path="/login" element={<LoginScreen />} />
                <Route path="/test" element={<div>Test Route</div>} />
            </Routes>
        </>
    );
}

function AppTest() {
    return (
        <BrowserRouter>
            <AppTestContent />
        </BrowserRouter>
    );
}

export default AppTest;
