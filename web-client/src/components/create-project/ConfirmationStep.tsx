import { CheckCircle2, ExternalLink } from "lucide-react";
import type { ProjectFormData } from "../../types/template";
import { Badge } from "../ui/badge";

interface ConfirmationStepProps {
	formData: ProjectFormData;
}

export function ConfirmationStep({ formData }: ConfirmationStepProps) {
	return (
		<div className="space-y-6">
			<div className="bg-slate-50 rounded-lg p-4">
				<h4 className="font-medium text-slate-900 mb-3">Project Summary</h4>
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
									<Badge key={index} variant="outline" className="text-xs">
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
							{formData.selectedTemplate.tagValue("title") ||
								"Untitled Template"}
						</div>
					)}
					{formData.selectedAgents && formData.selectedAgents.length > 0 && (
						<div>
							<span className="font-medium">Agents:</span>
							<div className="flex flex-wrap gap-1 mt-1">
								{formData.selectedAgents.map((agent, index) => (
									<Badge key={index} variant="outline" className="text-xs">
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
									{formData.selectedInstructions.map((instruction, index) => (
										<Badge key={index} variant="secondary" className="text-xs">
											{instruction.title || "Untitled"}
											{instruction.assignedAgents &&
												instruction.assignedAgents.length > 0 &&
												` (${instruction.assignedAgents.join(", ")})`}
										</Badge>
									))}
								</div>
							</div>
						)}
				</div>
			</div>

			<div className="flex items-center gap-2 p-4 bg-green-50 rounded-lg">
				<CheckCircle2 className="w-5 h-5 text-green-600" />
				<p className="text-sm text-green-800">
					Your project will be created with the above configuration.
				</p>
			</div>
		</div>
	);
}
