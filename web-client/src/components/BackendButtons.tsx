import { NDKEvent, useNDK } from "@nostr-dev-kit/ndk-hooks";
import { useAtom } from "jotai";
import { Check, Play } from "lucide-react";
import { useState } from "react";
import { onlineBackendsAtom } from "../lib/store";
import { Button } from "./ui/button";

interface BackendButtonsProps {
	taskId: string;
	projectTagId: string;
}

export function BackendButtons({ taskId, projectTagId }: BackendButtonsProps) {
	const { ndk } = useNDK();
	const [onlineBackends] = useAtom(onlineBackendsAtom);
	const [triggeredBackends, setTriggeredBackends] = useState<Set<string>>(
		new Set(),
	);

	const handleStartTask = async (backendPubkey: string) => {
		if (!ndk?.signer) return;

		try {
			const event = new NDKEvent(ndk);
			event.kind = 24010;
			event.content = "Start task";
			event.tags = [
				["p", backendPubkey],
				["e", taskId],
				["a", projectTagId],
			];

			event.publish();

			// Mark this backend as triggered
			setTriggeredBackends((prev) => new Set([...prev, backendPubkey]));
		} catch (error) {
			console.error("Failed to trigger task:", error);
		}
	};

	if (onlineBackends.size === 0) {
		return (
			<div className="text-center py-4">
				<p className="text-sm text-muted-foreground">
					No backends are currently online
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<h4 className="text-sm font-medium text-foreground mb-2">
				Available Backends
			</h4>
			<div className="space-y-2">
				{Array.from(onlineBackends.entries()).map(
					([backendPubkey, backendInfo]) => (
						<BackendButton
							key={backendPubkey}
							backendName={backendInfo.hostname}
							onStart={() => handleStartTask(backendPubkey)}
							isTriggered={triggeredBackends.has(backendPubkey)}
						/>
					),
				)}
			</div>
		</div>
	);
}

interface BackendButtonProps {
	backendName: string;
	onStart: () => void;
	isTriggered: boolean;
}

function BackendButton({
	backendName,
	onStart,
	isTriggered,
}: BackendButtonProps) {
	return (
		<Button
			onClick={onStart}
			variant={isTriggered ? "secondary" : "success"}
			size="sm"
			disabled={isTriggered}
			className={`w-full justify-between ${
				isTriggered
					? "bg-primary/10 border-primary/20 text-primary hover:bg-primary/20"
					: "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400 hover:bg-green-500/20"
			}`}
		>
			<span>{backendName}</span>
			{isTriggered ? (
				<Check className="w-4 h-4 ml-2" />
			) : (
				<Play className="w-4 h-4 ml-2" />
			)}
		</Button>
	);
}
