"use client";

import { NDKSessionLocalStorage, useNDKInit, useNDKSessionMonitor } from "@nostr-dev-kit/ndk-hooks";
import { useEffect } from "react";
import ndk from "@/lib/nostr/ndk";

const sessionStorage = new NDKSessionLocalStorage();

/**
 * Use an NDKHeadless component to initialize NDK to prevent application-rerenders
 * when there are changes to the NDK or session state.
 *
 * Include this headless component in your app layout to initialize NDK correctly.
 * @returns
 */
export default function NDKHeadless() {
    const initNDK = useNDKInit();

    useNDKSessionMonitor(sessionStorage, {
        profile: true,
        follows: true,
    });

    useEffect(() => {
        if (!ndk) return;

        initNDK(ndk);
    }, [initNDK]);

    return null;
}
