import {
	NDKPrivateKeySigner,
	NDKProject,
	useNDK,
} from "@nostr-dev-kit/ndk-hooks";
import {
	ArrowLeft,
	ArrowRight,
	CheckCircle2,
	ExternalLink,
} from "lucide-react";
import { useState } from "react";
import type {
	CreateProjectDialogProps,
	CreateProjectStep,
	ProjectFormData,
} from "../types/template";
import { AgentSelector } from "./AgentSelector";
import { InstructionSelector } from "./InstructionSelector";
import { TemplateSelector } from "./TemplateSelector";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

export function CreateProjectDialog({
	open,
	onOpenChange,
	onProjectCreated,
}: CreateProjectDialogProps) {
	const { ndk } = useNDK();
	const [step, setStep] = useState<CreateProjectStep>("details");
	const [isCreating, setIsCreating] = useState(false);
	const [formData, setFormData] = useState<ProjectFormData>({
		name: "",
		description: "",
		hashtags: "",
		repoUrl: "",
		imageUrl: "",
		selectedTemplate: undefined,
		selectedInstructions: [],
	});

	const resetForm = () => {
		setStep("details");
		setFormData({
			name: "",
			description: "",
			hashtags: "",
			repoUrl: "",
			imageUrl: "",
			selectedTemplate: undefined,
			selectedAgents: [],
			selectedInstructions: [],
		});
		setIsCreating(false);
	};

	const handleClose = () => {
		if (!isCreating) {
			resetForm();
			onOpenChange(false);
		}
	};

	const handleNext = () => {
		if (step === "details") {
			if (!formData.repoUrl && !formData.selectedTemplate) {
				setStep("template");
			} else {
				setStep("agents");
			}
		} else if (step === "template") {
			setStep("agents");
		} else if (step === "agents") {
			setStep("instructions");
		} else if (step === "instructions") {
			setStep("confirm");
		}
	};

	const handleBack = () => {
		if (step === "template") {
			setStep("details");
		} else if (step === "agents") {
			if (!formData.repoUrl && !formData.selectedTemplate) {
				setStep("template");
			} else {
				setStep("details");
			}
		} else if (step === "instructions") {
			setStep("agents");
		} else if (step === "confirm") {
			setStep("instructions");
		}
	};

	const handleCreateProject = async () => {
		if (!ndk || !formData.name.trim()) return;

		setIsCreating(true);
		try {
			const projectSigner = NDKPrivateKeySigner.generate();
			const project = new NDKProject(ndk);

			project.title = formData.name.trim();
			project.content =
				formData.description.trim() || `A new TENEX project: ${formData.name}`;

			if (formData.hashtags.trim()) {
				const hashtagArray = formData.hashtags
					.split(",")
					.map((tag) => tag.trim())
					.filter((tag) => tag.length > 0);
				project.hashtags = hashtagArray;
			}

			if (formData.repoUrl?.trim()) {
				project.repo = formData.repoUrl.trim();
			}

			if (formData.imageUrl?.trim()) {
				project.picture = formData.imageUrl.trim();
			}

			if (formData.selectedTemplate) {
				project.tags.push(["template", formData.selectedTemplate.tagId()]);
			}

			if (formData.selectedAgents && formData.selectedAgents.length > 0) {
				formData.selectedAgents.forEach((agent) => {
					project.tags.push(["agent", agent.id]);
				});
			}

			if (
				formData.selectedInstructions &&
				formData.selectedInstructions.length > 0
			) {
				formData.selectedInstructions.forEach((instruction) => {
					if (
						instruction.assignedAgents &&
						instruction.assignedAgents.length > 0
					) {
						// Add rule tag with agent names
						project.tags.push([
							"rule",
							instruction.id,
							...instruction.assignedAgents,
						]);
					} else {
						// Add rule tag for all agents
						project.tags.push(["rule", instruction.id]);
					}
				});
			}

			await project.sign(projectSigner);

			project.publish();

			resetForm();
			onOpenChange(false);
			onProjectCreated?.();
		} catch (error) {
			console.error("Failed to create project:", error);
		} finally {
			setIsCreating(false);
		}
	};

	const isStepValid = () => {
		if (step === "details") {
			return formData.name.trim().length > 0;
		}
		return true;
	};

	const getStepTitle = () => {
		switch (step) {
			case "details":
				return "Project Details";
			case "template":
				return "Choose Template";
			case "agents":
				return "Select Agents";
			case "instructions":
				return "Select Instructions";
			case "confirm":
				return "Confirm & Create";
			default:
				return "Create Project";
		}
	};

	const renderStepContent = () => {
		switch (step) {
			case "details":
				return (
					<div className="space-y-4">
						<div>
							<label
								htmlFor="name"
								className="block text-sm font-medium text-slate-700 mb-1"
							>
								Project Name *
							</label>
							<Input
								id="name"
								placeholder="My Awesome Project"
								value={formData.name}
								onChange={(e) =>
									setFormData((prev) => ({ ...prev, name: e.target.value }))
								}
								className="w-full"
							/>
						</div>

						<div>
							<label
								htmlFor="description"
								className="block text-sm font-medium text-slate-700 mb-1"
							>
								Description
							</label>
							<Textarea
								id="description"
								placeholder="Brief description of your project..."
								value={formData.description}
								onChange={(e) =>
									setFormData((prev) => ({
										...prev,
										description: e.target.value,
									}))
								}
								className="w-full min-h-[80px]"
							/>
						</div>

						<div>
							<label
								htmlFor="hashtags"
								className="block text-sm font-medium text-slate-700 mb-1"
							>
								Tags
							</label>
							<Input
								id="hashtags"
								placeholder="react, typescript, web3 (comma separated)"
								value={formData.hashtags}
								onChange={(e) =>
									setFormData((prev) => ({ ...prev, hashtags: e.target.value }))
								}
								className="w-full"
							/>
						</div>

						<div>
							<label
								htmlFor="imageUrl"
								className="block text-sm font-medium text-slate-700 mb-1"
							>
								Project Image URL (optional)
							</label>
							<Input
								id="imageUrl"
								placeholder="https://example.com/project-image.jpg"
								value={formData.imageUrl}
								onChange={(e) =>
									setFormData((prev) => ({ ...prev, imageUrl: e.target.value }))
								}
								className="w-full"
							/>
							<p className="text-xs text-slate-500 mt-1">
								This image will be used as the project avatar
							</p>
						</div>

						<div>
							<label
								htmlFor="repoUrl"
								className="block text-sm font-medium text-slate-700 mb-1"
							>
								Repository URL (optional)
							</label>
							<Input
								id="repoUrl"
								placeholder="https://github.com/username/repo"
								value={formData.repoUrl}
								onChange={(e) =>
									setFormData((prev) => ({ ...prev, repoUrl: e.target.value }))
								}
								className="w-full"
							/>
							<p className="text-xs text-slate-500 mt-1">
								Leave empty to choose from templates
							</p>
						</div>
					</div>
				);

			case "template":
				return (
					<div className="space-y-4">
						<p className="text-sm text-slate-600">
							Choose a template to start your project, or skip to create an
							empty project.
						</p>
						<TemplateSelector
							selectedTemplate={formData.selectedTemplate}
							onTemplateSelect={(template) =>
								setFormData((prev) => ({ ...prev, selectedTemplate: template }))
							}
						/>
					</div>
				);

			case "agents":
				return (
					<div className="space-y-4">
						<p className="text-sm text-slate-600">
							Select AI agents that will work on your project. These agents will
							be available for task assignment and instruction targeting.
						</p>
						<AgentSelector
							selectedAgents={formData.selectedAgents || []}
							onAgentsChange={(agents) =>
								setFormData((prev) => ({ ...prev, selectedAgents: agents }))
							}
						/>
					</div>
				);

			case "instructions":
				return (
					<div className="space-y-4">
						<p className="text-sm text-slate-600">
							Select instruction sets to add to your project. Instructions help
							define coding standards, best practices, and project-specific
							guidelines.
						</p>
						<InstructionSelector
							selectedInstructions={formData.selectedInstructions || []}
							selectedAgents={formData.selectedAgents || []}
							onInstructionsChange={(instructions) =>
								setFormData((prev) => ({
									...prev,
									selectedInstructions: instructions,
								}))
							}
						/>
					</div>
				);

			case "confirm":
				return (
					<div className="space-y-6">
						<div className="bg-slate-50 rounded-lg p-4">
							<h4 className="font-medium text-slate-900 mb-3">
								Project Summary
							</h4>
							<div className="space-y-2 text-sm">
								<div>
									<span className="font-medium">Name:</span> {formData.name}
								</div>
								{formData.description && (
									<div>
										<span className="font-medium">Description:</span>{" "}
										{formData.description}
									</div>
								)}
								{formData.hashtags && (
									<div>
										<span className="font-medium">Tags:</span>
										<div className="flex flex-wrap gap-1 mt-1">
											{formData.hashtags.split(",").map((tag, index) => (
												<Badge
													key={index}
													variant="outline"
													className="text-xs"
												>
													{tag.trim()}
												</Badge>
											))}
										</div>
									</div>
								)}
								{formData.imageUrl && (
									<div>
										<span className="font-medium">Image:</span>
										<div className="mt-1">
											<img
												src={formData.imageUrl}
												alt="Project preview"
												className="w-16 h-16 object-cover rounded-lg"
												onError={(e) => {
													const target = e.target as HTMLImageElement;
													target.style.display = "none";
												}}
											/>
										</div>
									</div>
								)}
								{formData.repoUrl && (
									<div>
										<span className="font-medium">Repository:</span>
										<a
											href={formData.repoUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="inline-flex items-center text-blue-600 hover:text-blue-800 ml-1"
										>
											{formData.repoUrl}
											<ExternalLink className="w-3 h-3 ml-1" />
										</a>
									</div>
								)}
								{formData.selectedTemplate && (
									<div>
										<span className="font-medium">Template:</span>{" "}
										{formData.selectedTemplate.title || "Untitled Template"}
									</div>
								)}
								{formData.selectedAgents &&
									formData.selectedAgents.length > 0 && (
										<div>
											<span className="font-medium">Agents:</span>
											<div className="flex flex-wrap gap-1 mt-1">
												{formData.selectedAgents.map((agent, index) => (
													<Badge
														key={index}
														variant="outline"
														className="text-xs"
													>
														{agent.name || "Unnamed Agent"}
													</Badge>
												))}
											</div>
										</div>
									)}
								{formData.selectedInstructions &&
									formData.selectedInstructions.length > 0 && (
										<div>
											<span className="font-medium">Instructions:</span>
											<div className="flex flex-wrap gap-1 mt-1">
												{formData.selectedInstructions.map(
													(instruction, index) => (
														<Badge
															key={index}
															variant="outline"
															className="text-xs"
														>
															{instruction.title || "Untitled"}
														</Badge>
													),
												)}
											</div>
										</div>
									)}
							</div>
						</div>

						<div className="flex items-center gap-2 text-sm text-slate-600">
							<CheckCircle2 className="w-4 h-4 text-green-500" />
							Ready to create your project
						</div>
					</div>
				);

			default:
				return null;
		}
	};

	const getDialogMaxWidth = () => {
		return step === "template" || step === "agents" || step === "instructions"
			? "max-w-4xl"
			: "max-w-lg";
	};

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent
				className={`${getDialogMaxWidth()} max-h-[90vh] overflow-hidden flex flex-col`}
			>
				<DialogHeader>
					<DialogTitle>{getStepTitle()}</DialogTitle>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto">{renderStepContent()}</div>

				<div className="flex items-center justify-between pt-4 border-t">
					<div className="flex items-center gap-2">
						{step !== "details" && (
							<Button
								variant="outline"
								onClick={handleBack}
								disabled={isCreating}
							>
								<ArrowLeft className="w-4 h-4 mr-2" />
								Back
							</Button>
						)}
					</div>

					<div className="flex items-center gap-2">
						{step !== "confirm" ? (
							<Button
								onClick={handleNext}
								disabled={!isStepValid() || isCreating}
							>
								Next
								<ArrowRight className="w-4 h-4 ml-2" />
							</Button>
						) : (
							<Button
								variant="primary"
								onClick={handleCreateProject}
								disabled={!isStepValid() || isCreating}
							>
								{isCreating ? "Creating..." : "Create Project"}
							</Button>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
