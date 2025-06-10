import type { NDKProject } from "@nostr-dev-kit/ndk-hooks";
import { ArrowLeft, ArrowRight, Send } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";

interface ThreadDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	project: NDKProject;
	onThreadStart?: (title: string) => void;
}

export function ThreadDialog({
	open,
	onOpenChange,
	project,
	onThreadStart,
}: ThreadDialogProps) {
	const [title, setTitle] = useState("");

	const handleStart = () => {
		if (!title.trim()) {
			alert("Please enter a thread title");
			return;
		}

		onThreadStart?.(title.trim());
		setTitle("");
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="w-full max-w-md">
				<DialogHeader>
					<DialogTitle>New Thread</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-2">
						<Input
							id="thread-title"
							placeholder="Enter thread title..."
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && title.trim()) {
									handleStart();
								}
							}}
						/>
						<p className="text-xs text-slate-500">
							You'll be taken to the chat interface to start the conversation.
						</p>
					</div>
				</div>

				<DialogFooter>
					<Button onClick={handleStart} disabled={!title.trim()}>
						Continue
						<ArrowRight className="w-4 h-4 mr-2" />
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
