import { useNDKCurrentPubkey, useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { useAtom } from "jotai";
import { useEffect } from "react";
import { onlineBackendsAtom } from "../lib/store";

// Custom hook to track online backend status
export function useBackendStatus() {
	const currentPubkey = useNDKCurrentPubkey();
	const [onlineBackends, setOnlineBackends] = useAtom(onlineBackendsAtom);

	// Subscribe to kind 24009 events with current user as target
	const { events: statusEvents } = useSubscribe(
		currentPubkey
			? [
					{
						kinds: [24009 as any],
						"#p": [currentPubkey],
					},
				]
			: false,
		{},
		[currentPubkey],
	);

	// Update the online backends map when new status events come in
	useEffect(() => {
		if (!statusEvents || statusEvents.length === 0) return;

		const newOnlineBackends = new Map<string, string>();

		// Process status events to determine which backends are online
		statusEvents.forEach((event) => {
			const backendPubkey = event.pubkey;
			const backendName =
				event.content || `Backend ${backendPubkey.slice(0, 8)}`;

			newOnlineBackends.set(backendPubkey, backendName);
		});

		setOnlineBackends(newOnlineBackends);
	}, [statusEvents, setOnlineBackends]);

	return { onlineBackends };
}
