import type { ProjectFormData } from "../../types/template";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";

interface ProjectDetailsStepProps {
	formData: ProjectFormData;
	onFormDataChange: (data: Partial<ProjectFormData>) => void;
}

export function ProjectDetailsStep({
	formData,
	onFormDataChange,
}: ProjectDetailsStepProps) {
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
					onChange={(e) => onFormDataChange({ name: e.target.value })}
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
					onChange={(e) => onFormDataChange({ description: e.target.value })}
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
					onChange={(e) => onFormDataChange({ hashtags: e.target.value })}
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
					onChange={(e) => onFormDataChange({ imageUrl: e.target.value })}
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
					onChange={(e) => onFormDataChange({ repoUrl: e.target.value })}
					className="w-full"
				/>
				<p className="text-xs text-slate-500 mt-1">
					Leave empty to choose from templates
				</p>
			</div>
		</div>
	);
}
