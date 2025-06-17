import { NDKHeadless, NDKSessionLocalStorage } from "@nostr-dev-kit/ndk-hooks";
import { useRef } from "react";

function AppMinimal() {
    const sessionStorage = useRef(new NDKSessionLocalStorage());
    const relays = ["wss://relay.damus.io", "wss://relay.primal.net"];

    return (
        <>
            <NDKHeadless
                ndk={{
                    explicitRelayUrls: relays,
                }}
                session={{
                    storage: sessionStorage.current,
                    opts: { follows: true, profile: true },
                }}
            />
            <div style={{ padding: "20px" }}>
                <h1>TENEX App</h1>
                <p>If you see this, the basic setup is working!</p>
            </div>
        </>
    );
}

export default AppMinimal;
