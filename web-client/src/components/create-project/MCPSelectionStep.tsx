import type { ProjectFormData } from "@/types/template";
import { NDKAgent } from "@tenex/cli/events";
import { Server } from "lucide-react";
import { AgentSelector } from "../agents/AgentSelector";

interface MCPSelectionStepProps {
    formData: ProjectFormData;
    onFormDataChange: (data: Partial<ProjectFormData>) => void;
}

export function MCPSelectionStep({ formData, onFormDataChange }: MCPSelectionStepProps) {
    const handleMCPToolsChange = (tools: NDKAgent[]) => {
        onFormDataChange({ selectedMCPTools: tools });
    };

    return (
        <div className="space-y-4">
            <div className="text-center mb-6">
                <Server className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <h3 className="text-lg font-semibold">Select MCP Tools</h3>
                <p className="text-sm text-muted-foreground mt-1">
                    Choose Model Context Protocol servers to extend your project's capabilities
                </p>
            </div>

            <AgentSelector
                selectedAgents={formData.selectedMCPTools || []}
                onAgentsChange={handleMCPToolsChange}
                filterType="mcp-server"
            />
        </div>
    );
}