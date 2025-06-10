import { type NDKProject, NDKTask, useNDK } from "@nostr-dev-kit/ndk-hooks";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";

interface CreateTaskDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	project: NDKProject;
	onTaskCreated?: () => void;
	initialTitle?: string;
	initialDescription?: string;
}

export function CreateTaskDialog({
	open,
	onOpenChange,
	project,
	onTaskCreated,
	initialTitle,
	initialDescription,
}: CreateTaskDialogProps) {
	const { ndk } = useNDK();
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [isCreating, setIsCreating] = useState(false);

	// Set initial values when dialog opens or initial values change
	useEffect(() => {
		if (open && initialTitle !== undefined) {
			setTitle(initialTitle);
		}
		if (open && initialDescription !== undefined) {
			setDescription(initialDescription);
		}
	}, [open, initialTitle, initialDescription]);

	const handleCreate = async () => {
		if (!title.trim() || !description.trim()) {
			alert("Please fill in both title and description");
			return;
		}

		setIsCreating(true);
		try {
			if (!ndk) throw new Error("NDK not available");

			const task = new NDKTask(ndk);
			task.title = title.trim();
			task.content = description.trim();

			// Tag the task with the project
			task.tags.push(["a", project.tagId()]);

			task.publish();

			setTitle("");
			setDescription("");
			onTaskCreated?.();
			onOpenChange(false);
		} catch (error) {
			console.error("Failed to create task:", error);
			alert("Failed to create task. Please try again.");
		} finally {
			setIsCreating(false);
		}
	};

	const handleClose = () => {
		setTitle("");
		setDescription("");
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="w-full max-w-md">
				<DialogHeader>
					<DialogTitle>New Task</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-2">
						<label
							htmlFor="task-title"
							className="block text-sm font-medium text-slate-700"
						>
							Title
						</label>
						<Input
							id="task-title"
							placeholder="Enter task title..."
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							disabled={isCreating}
						/>
					</div>

					<div className="space-y-2">
						<label
							htmlFor="task-description"
							className="block text-sm font-medium text-slate-700"
						>
							Description
						</label>
						<textarea
							id="task-description"
							placeholder="Enter task description..."
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							disabled={isCreating}
							rows={4}
							className="w-full px-3 py-2 border border-slate-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						/>
					</div>
				</div>

				<DialogFooter>
					<Button variant="ghost" onClick={handleClose} disabled={isCreating}>
						Cancel
					</Button>
					<Button
						onClick={handleCreate}
						disabled={isCreating || !title.trim() || !description.trim()}
					>
						{isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
						Create Task
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
