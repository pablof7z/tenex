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
			event.kind = 24010 as any;
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
				<p className="text-sm text-slate-500">
					No backends are currently online
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<h4 className="text-sm font-medium text-slate-700 mb-2">
				Available Backends
			</h4>
			<div className="space-y-2">
				{Array.from(onlineBackends.entries()).map(
					([backendPubkey, backendName]) => (
						<BackendButton
							key={backendPubkey}
							backendPubkey={backendPubkey}
							backendName={backendName}
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
	backendPubkey: string;
	backendName: string;
	onStart: () => void;
	isTriggered: boolean;
}

function BackendButton({
	backendPubkey,
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
					? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300"
					: "bg-green-50 border-green-200 text-green-800 hover:bg-green-100 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300"
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
