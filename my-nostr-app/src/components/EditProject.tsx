import { NDKProject, useNDK } from "@nostr-dev-kit/ndk-hooks";
import { ArrowLeft, Camera, Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

interface EditProjectProps {
	project: NDKProject | null;
	onBack: () => void;
	onProjectUpdated?: () => void;
}

interface EditProjectFormData {
	name: string;
	description: string;
	hashtags: string;
	repoUrl: string;
	imageUrl: string;
}

export function EditProject({
	project,
	onBack,
	onProjectUpdated,
}: EditProjectProps) {
	const { ndk } = useNDK();
	const [isUpdating, setIsUpdating] = useState(false);
	const [hasChanges, setHasChanges] = useState(false);
	const [formData, setFormData] = useState<EditProjectFormData>({
		name: "",
		description: "",
		hashtags: "",
		repoUrl: "",
		imageUrl: "",
	});

	const originalData = project
		? {
				name: project.title || "",
				description: project.content || "",
				hashtags: project.hashtags?.join(", ") || "",
				repoUrl: project.repo || "",
				imageUrl: project.picture || "",
			}
		: null;

	// Populate form when project changes
	useEffect(() => {
		if (project) {
			const data = {
				name: project.title || "",
				description: project.content || "",
				hashtags: project.hashtags?.join(", ") || "",
				repoUrl: project.repo || "",
				imageUrl: project.picture || "",
			};
			setFormData(data);
			setHasChanges(false);
		}
	}, [project]);

	// Check for changes
	useEffect(() => {
		if (originalData) {
			const changed = Object.keys(formData).some(
				(key) =>
					formData[key as keyof EditProjectFormData] !==
					originalData[key as keyof EditProjectFormData],
			);
			setHasChanges(changed);
		}
	}, [formData, originalData]);

	const handleUpdateProject = async () => {
		if (!ndk || !project || !formData.name.trim()) return;

		setIsUpdating(true);
		try {
			// Get the project signer to sign the updated event
			const projectSigner = await project.getSigner();

			// Create a new event with updated data
			const updatedProject = new NDKProject(ndk);
			updatedProject.tags = [...project.tags]; // Copy existing tags

			// Update the basic fields
			updatedProject.title = formData.name.trim();
			updatedProject.content =
				formData.description.trim() || `A TENEX project: ${formData.name}`;

			// Update hashtags
			if (formData.hashtags.trim()) {
				const hashtagArray = formData.hashtags
					.split(",")
					.map((tag) => tag.trim())
					.filter((tag) => tag.length > 0);
				updatedProject.hashtags = hashtagArray;
			} else {
				updatedProject.hashtags = [];
			}

			// Update repo URL
			if (formData.repoUrl?.trim()) {
				updatedProject.repo = formData.repoUrl.trim();
			} else {
				updatedProject.repo = undefined;
			}

			// Update image URL
			if (formData.imageUrl?.trim()) {
				updatedProject.picture = formData.imageUrl.trim();
			} else {
				updatedProject.picture = undefined;
			}

			// Preserve the 'd' tag (project identifier)
			const dTag = project.tagValue("d");
			if (dTag) {
				updatedProject.removeTag("d");
				updatedProject.tags.push(["d", dTag]);
			}

			await updatedProject.sign(projectSigner);
			updatedProject.publish();

			setHasChanges(false);
			onProjectUpdated?.();
			onBack();
		} catch (error) {
			console.error("Failed to update project:", error);
		} finally {
			setIsUpdating(false);
		}
	};

	const isFormValid = () => {
		return formData.name.trim().length > 0 && hasChanges;
	};

	const getProjectAvatar = () => {
		if (formData.imageUrl) {
			return formData.imageUrl;
		}
		// Use dicebear with project's d tag as seed
		const seed = project?.tagValue("d") || "default";
		return `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(seed)}`;
	};

	const getInitials = (title: string) => {
		return title
			.split(" ")
			.map((word) => word.charAt(0))
			.join("")
			.toUpperCase()
			.slice(0, 2);
	};

	if (!project) return null;

	return (
		<div className="min-h-screen bg-slate-50">
			{/* Header */}
			<div className="bg-white border-b border-slate-200 sticky top-0 z-50">
				<div className="flex items-center justify-between px-4 py-3">
					<div className="flex items-center gap-3">
						<Button
							variant="ghost"
							size="icon"
							onClick={onBack}
							className="w-9 h-9 text-slate-700 hover:bg-slate-100"
						>
							<ArrowLeft className="w-5 h-5" />
						</Button>
						<h1 className="text-lg font-semibold text-slate-900">
							Edit Project
						</h1>
					</div>
					<Button
						onClick={handleUpdateProject}
						disabled={!isFormValid() || isUpdating}
						className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
						size="sm"
					>
						{isUpdating ? (
							<>
								<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
								Saving
							</>
						) : (
							<>
								<Check className="w-4 h-4 mr-2" />
								Save
							</>
						)}
					</Button>
				</div>
			</div>

			{/* Content */}
			<div className="p-4 space-y-6">
				{/* Avatar Section */}
				<div className="bg-white rounded-lg p-6">
					<div className="flex flex-col items-center space-y-4">
						<div className="relative">
							<Avatar className="w-24 h-24">
								<AvatarImage
									src={getProjectAvatar()}
									alt={formData.name || "Project"}
								/>
								<AvatarFallback className="text-lg font-semibold bg-gradient-to-br from-blue-500 to-blue-600 text-white">
									{getInitials(formData.name || "Project")}
								</AvatarFallback>
							</Avatar>
							<Button
								size="icon"
								className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg"
							>
								<Camera className="w-4 h-4" />
							</Button>
						</div>
						<div className="text-center">
							<p className="text-sm text-slate-600">Project Avatar</p>
							<p className="text-xs text-slate-500 mt-1">Tap to change photo</p>
						</div>
					</div>
				</div>

				{/* Form Fields */}
				<div className="space-y-4">
					{/* Project Name */}
					<div className="bg-white rounded-lg">
						<div className="p-4 border-b border-slate-100">
							<label className="block text-sm font-medium text-slate-700 mb-2">
								Project Name
							</label>
							<Input
								placeholder="Enter project name"
								value={formData.name}
								onChange={(e) =>
									setFormData((prev) => ({ ...prev, name: e.target.value }))
								}
								className="border-0 bg-transparent p-0 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
							/>
						</div>
					</div>

					{/* Image URL */}
					<div className="bg-white rounded-lg">
						<div className="p-4 border-b border-slate-100">
							<label className="block text-sm font-medium text-slate-700 mb-2">
								Project Image URL
							</label>
							<Input
								placeholder="https://example.com/image.jpg"
								value={formData.imageUrl}
								onChange={(e) =>
									setFormData((prev) => ({ ...prev, imageUrl: e.target.value }))
								}
								className="border-0 bg-transparent p-0 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
							/>
							<p className="text-xs text-slate-500 mt-2">
								Leave empty to use a generated avatar
							</p>
						</div>
					</div>

					{/* Description */}
					<div className="bg-white rounded-lg">
						<div className="p-4 border-b border-slate-100">
							<label className="block text-sm font-medium text-slate-700 mb-2">
								Description
							</label>
							<Textarea
								placeholder="Describe your project..."
								value={formData.description}
								onChange={(e) =>
									setFormData((prev) => ({
										...prev,
										description: e.target.value,
									}))
								}
								className="border-0 bg-transparent p-0 text-base resize-none min-h-[100px] focus-visible:ring-0 focus-visible:ring-offset-0"
							/>
						</div>
					</div>

					{/* Tags */}
					<div className="bg-white rounded-lg">
						<div className="p-4 border-b border-slate-100">
							<label className="block text-sm font-medium text-slate-700 mb-2">
								Tags
							</label>
							<Input
								placeholder="react, typescript, web3"
								value={formData.hashtags}
								onChange={(e) =>
									setFormData((prev) => ({ ...prev, hashtags: e.target.value }))
								}
								className="border-0 bg-transparent p-0 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
							/>
							<p className="text-xs text-slate-500 mt-2">
								Separate tags with commas
							</p>
						</div>
					</div>

					{/* Repository URL */}
					<div className="bg-white rounded-lg">
						<div className="p-4">
							<label className="block text-sm font-medium text-slate-700 mb-2">
								Repository URL
							</label>
							<Input
								placeholder="https://github.com/username/repo"
								value={formData.repoUrl}
								onChange={(e) =>
									setFormData((prev) => ({ ...prev, repoUrl: e.target.value }))
								}
								className="border-0 bg-transparent p-0 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
							/>
						</div>
					</div>
				</div>

				{/* Danger Zone */}
				<div className="bg-white rounded-lg border border-red-200">
					<div className="p-4">
						<h3 className="text-sm font-medium text-red-800 mb-2">
							Danger Zone
						</h3>
						<p className="text-sm text-red-600 mb-4">
							These actions cannot be undone
						</p>
						<Button
							variant="outline"
							className="border-red-300 text-red-700 hover:bg-red-50"
							size="sm"
						>
							Delete Project
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
