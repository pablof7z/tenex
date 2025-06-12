import SwiftUI
import NDKSwift

struct AgentsView: View {
    @State private var agents: [Agent] = []
    @State private var searchText = ""
    @State private var selectedCategory = "All"
    
    let categories = ["All", "Code", "Planning", "Debug", "Custom"]
    
    var filteredAgents: [Agent] {
        let categoryFiltered = selectedCategory == "All" ? agents : agents.filter { agent in
            // Filter by category based on agent name or description
            agent.name.localizedCaseInsensitiveContains(selectedCategory) ||
            agent.description.localizedCaseInsensitiveContains(selectedCategory)
        }
        
        if searchText.isEmpty {
            return categoryFiltered
        } else {
            return categoryFiltered.filter { agent in
                agent.name.localizedCaseInsensitiveContains(searchText) ||
                agent.description.localizedCaseInsensitiveContains(searchText)
            }
        }
    }
    
    var body: some View {
        NavigationView {
            VStack {
                // Category picker
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(categories, id: \.self) { category in
                            CategoryChip(
                                title: category,
                                isSelected: selectedCategory == category
                            ) {
                                selectedCategory = category
                            }
                        }
                    }
                    .padding(.horizontal)
                }
                .padding(.vertical, 8)
                
                if agents.isEmpty {
                    EmptyStateView(
                        icon: "person.2.circle.fill",
                        title: "No Agents Available",
                        description: "Discover and install AI agents to enhance your development workflow"
                    )
                } else {
                    List(filteredAgents) { agent in
                        NavigationLink(destination: AgentDetailView(agent: agent)) {
                            AgentListRow(agent: agent)
                        }
                    }
                    .searchable(text: $searchText, prompt: "Search agents")
                }
            }
            .navigationTitle("Agents")
            .onAppear {
                loadAgents()
            }
        }
    }
    
    private func loadAgents() {
        // TODO: Load agents from Nostr
        // For now, using mock data
        agents = [
            Agent(from: createMockAgent(name: "Claude Code", description: "AI coding assistant powered by Claude", model: "claude-3-opus")),
            Agent(from: createMockAgent(name: "Project Planner", description: "Strategic planning and architecture design", model: "gpt-4")),
            Agent(from: createMockAgent(name: "Debug Assistant", description: "Specialized in finding and fixing bugs", model: "claude-3-sonnet"))
        ].compactMap { $0 }
    }
    
    private func createMockAgent(name: String, description: String, model: String) -> NDKEvent {
        let event = NDKEvent(kind: 0)
        let profile = NDKUserProfile(
            name: name,
            displayName: name,
            about: description,
            picture: nil,
            banner: nil,
            nip05: nil,
            lud16: nil,
            lud06: nil,
            website: nil
        )
        
        if let profileData = try? JSONEncoder().encode(profile),
           let profileString = String(data: profileData, encoding: .utf8) {
            event.content = profileString
        }
        
        event.tags = [["model", model]]
        event.createdAt = Int64(Date().timeIntervalSince1970)
        return event
    }
}

struct CategoryChip: View {
    let title: String
    let isSelected: Bool
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            Text(title)
                .font(.subheadline)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(isSelected ? Color.blue : Color.gray.opacity(0.2))
                .foregroundColor(isSelected ? .white : .primary)
                .cornerRadius(20)
        }
    }
}

struct AgentListRow: View {
    let agent: Agent
    
    var body: some View {
        HStack(spacing: 12) {
            // Avatar
            if let avatarURL = agent.avatar, let url = URL(string: avatarURL) {
                AsyncImage(url: url) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 60, height: 60)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                } placeholder: {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.gray.opacity(0.2))
                        .frame(width: 60, height: 60)
                        .overlay(
                            ProgressView()
                        )
                }
            } else {
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.blue.opacity(0.2))
                    .frame(width: 60, height: 60)
                    .overlay(
                        Image(systemName: "person.circle.fill")
                            .font(.title)
                            .foregroundColor(.blue)
                    )
            }
            
            VStack(alignment: .leading, spacing: 4) {
                Text(agent.name)
                    .font(.headline)
                
                Text(agent.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
                
                if let model = agent.model {
                    HStack {
                        Image(systemName: "cpu")
                            .font(.caption2)
                        Text(model)
                            .font(.caption2)
                    }
                    .foregroundColor(.blue)
                }
            }
            
            Spacer()
        }
        .padding(.vertical, 4)
    }
}