import React from "react"
import { NDKAgent } from "@/lib/ndk-tools/agents"
import { EntityListSidebar } from "@/components/common/EntityListSidebar"
import { ProfileDisplay } from "../ProfileDisplay"

interface AgentListProps {
  agents: NDKAgent[]
  selectedAgent: NDKAgent | null
  onBack: () => void
  onSelectAgent: (agent: NDKAgent) => void
  onCreateNew: () => void
}

export function AgentList({
  agents,
  selectedAgent,
  onBack,
  onSelectAgent,
  onCreateNew,
}: AgentListProps) {
  return (
    <EntityListSidebar<NDKAgent>
      title="Agents"
      items={agents}
      selectedItem={selectedAgent}
      onBack={onBack}
      onSelect={onSelectAgent}
      onCreateNew={onCreateNew}
      getItemTitle={(agent) => agent.title || "Untitled Agent"}
      getItemVersion={(agent) => agent.tagValue("ver")}
      getItemDescription={(agent) => agent.description}
      renderItemExtra={(agent) => (
        <div className="mt-2">
          <ProfileDisplay 
            pubkey={agent.pubkey} 
            size="sm" 
            className="text-xs text-muted-foreground"
            nameClassName="text-xs"
          />
        </div>
      )}
      createButtonText="Add new agent"
      className="w-full md:w-80 lg:w-96"
    />
  )
}