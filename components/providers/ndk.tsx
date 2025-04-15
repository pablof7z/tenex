"use client";

import { useEffect, ReactNode } from "react";
import { useNDKInit, useNDKSessions, useNDKSessionSwitch } from "@nostr-dev-kit/ndk-hooks";
import ndk, { serializeSigner, deserializeSigner } from "@/lib/nostr/ndk"; // Use alias for cleaner import

const SIGNERS_STORAGE_KEY = "nostr-signers";
const ACTIVE_PUBKEY_STORAGE_KEY = "nostr-active-pubkey";

interface SerializedSignerInfo {
    type: "nip07" | "privateKey";
    data?: string;
}

interface NDKProviderProps {
    children: ReactNode;
}

export function NDKProvider({ children }: NDKProviderProps) {
    const initNDK = useNDKInit();
    const sessions = useNDKSessions();
    const switchUser = useNDKSessionSwitch();

    // Initialize NDK and load saved sessions on mount
    useEffect(() => {
        console.log("Initializing NDK via NDKProvider...");
        initNDK(ndk);

        // Load previously saved sessions
        const loadSavedSessions = async () => {
            try {
                const signersJson = localStorage.getItem(SIGNERS_STORAGE_KEY);
                const activePubkey = localStorage.getItem(ACTIVE_PUBKEY_STORAGE_KEY);

                if (signersJson) {
                    const serializedSigners = JSON.parse(signersJson) as Record<string, SerializedSignerInfo>;

                    for (const [pubkey, serializedInfo] of Object.entries(serializedSigners)) {
                        const signer = deserializeSigner(serializedInfo);
                        if (signer) {
                            console.log(`Restoring session for pubkey: ${pubkey.substring(0, 6)}...`);
                            await sessions.addSession(signer);

                            // Restore the active session if it matches
                            if (activePubkey === pubkey) {
                                console.log(`Switching to active user: ${pubkey.substring(0, 6)}...`);
                                switchUser(pubkey);
                            }
                        } else {
                            console.warn(`Could not deserialize signer for pubkey: ${pubkey}`);
                        }
                    }
                } else {
                    console.log("No saved sessions found in localStorage.");
                }
            } catch (error) {
                console.error("Error loading saved NDK sessions:", error);
                // Optionally clear potentially corrupted storage
                // localStorage.removeItem(SIGNERS_STORAGE_KEY);
                // localStorage.removeItem(ACTIVE_PUBKEY_STORAGE_KEY);
            }
        };

        loadSavedSessions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initNDK, sessions.addSession, sessions.switchToUser]); // Add session methods to deps per linter

    // Save sessions whenever they change
    useEffect(() => {
        const persistSessions = () => {
            try {
                // Save signers
                const signersToStore: Record<string, SerializedSignerInfo> = {};
                for (const [pubkey, signer] of sessions.signers.entries()) {
                    const serialized = serializeSigner(signer);
                    if (serialized) {
                        signersToStore[pubkey] = serialized;
                    }
                }
                localStorage.setItem(SIGNERS_STORAGE_KEY, JSON.stringify(signersToStore));
                console.log("Persisted signers to localStorage:", signersToStore);

                // Save active pubkey
                if (sessions.activePubkey) {
                    localStorage.setItem(ACTIVE_PUBKEY_STORAGE_KEY, sessions.activePubkey);
                    console.log("Persisted active pubkey:", sessions.activePubkey.substring(0, 6) + "...");
                } else {
                    localStorage.removeItem(ACTIVE_PUBKEY_STORAGE_KEY);
                    console.log("Removed active pubkey from localStorage.");
                }
            } catch (error) {
                console.error("Error persisting NDK sessions:", error);
            }
        };

        // Only persist if sessions are available (NDK might not be fully initialized yet)
        if (sessions && sessions.signers.size > 0) {
            persistSessions();
        } else if (sessions && sessions.signers.size === 0 && localStorage.getItem(SIGNERS_STORAGE_KEY)) {
            // Clear storage if the user explicitly logged out (sessions became empty)
            localStorage.removeItem(SIGNERS_STORAGE_KEY);
            localStorage.removeItem(ACTIVE_PUBKEY_STORAGE_KEY);
            console.log("Cleared NDK session storage as sessions are empty.");
        }
    }, [sessions]); // Re-run when sessions object reference changes

    return <>{children}</>;
}
