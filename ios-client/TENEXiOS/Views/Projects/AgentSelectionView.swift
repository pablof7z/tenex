import SwiftUI
import NDKSwift

struct AgentSelectionView: View {
    @Binding var selectedAgents: Set<Agent>
    @State private var agents: [Agent] = []
    @State private var isLoading = true
    @State private var searchText = ""
    
    var filteredAgents: [Agent] {
        if searchText.isEmpty {
            return agents
        } else {
            return agents.filter { agent in
                agent.name.localizedCaseInsensitiveContains(searchText) ||
                agent.description.localizedCaseInsensitiveContains(searchText)
            }
        }
    }
    
    var body: some View {
        VStack {
            Text("Select Agents (Optional)")
                .font(.title2)
                .fontWeight(.semibold)
                .padding(.top)
            
            Text("Choose AI agents to work on your project")
                .font(.subheadline)
                .foregroundColor(.secondary)
            
            HStack {
                Text("\(selectedAgents.count) selected")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Spacer()
                
                if !selectedAgents.isEmpty {
                    Button("Clear All") {
                        selectedAgents.removeAll()
                    }
                    .font(.caption)
                }
            }
            .padding(.horizontal)
            
            if isLoading {
                Spacer()
                ProgressView("Loading agents...")
                Spacer()
            } else if agents.isEmpty {
                EmptyStateView(
                    icon: "person.2.slash",
                    title: "No Agents Available",
                    description: "Agents will appear here once they're published"
                )
            } else {
                SearchBar(text: $searchText, placeholder: "Search agents")
                    .padding(.horizontal)
                
                List(filteredAgents) { agent in
                    AgentRow(
                        agent: agent,
                        isSelected: selectedAgents.contains(agent),
                        onToggle: {
                            if selectedAgents.contains(agent) {
                                selectedAgents.remove(agent)
                            } else {
                                selectedAgents.insert(agent)
                            }
                        }
                    )
                }
                .listStyle(PlainListStyle())
            }
        }
        .onAppear {
            loadAgents()
        }
    }
    
    private func loadAgents() {
        Task {
            // Load agents from specific pubkeys or discoverable agents
            let filter = NDKFilter(kinds: [0]) // Profile events
            do {
                let events = try await NDKManager.shared.ndk.fetchEvents(filter)
                let loadedAgents = events.compactMap { event -> Agent? in
                    // Filter for agent profiles (you might want to add specific criteria)
                    if event.content?.contains("agent") == true {
                        return Agent(from: event)
                    }
                    return nil
                }
                
                await MainActor.run {
                    self.agents = loadedAgents.sorted { $0.name < $1.name }
                    self.isLoading = false
                }
            } catch {
                print("Failed to load agents: \(error)")
                await MainActor.run {
                    self.isLoading = false
                }
            }
        }
    }
}

struct AgentRow: View {
    let agent: Agent
    let isSelected: Bool
    let onToggle: () -> Void
    
    var body: some View {
        HStack {
            // Avatar
            if let avatarURL = agent.avatar, let url = URL(string: avatarURL) {
                AsyncImage(url: url) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 40, height: 40)
                        .clipShape(Circle())
                } placeholder: {
                    Circle()
                        .fill(Color.gray.opacity(0.2))
                        .frame(width: 40, height: 40)
                        .overlay(
                            Text(String(agent.name.prefix(1)))
                                .font(.headline)
                                .foregroundColor(.gray)
                        )
                }
            } else {
                Circle()
                    .fill(Color.blue.opacity(0.2))
                    .frame(width: 40, height: 40)
                    .overlay(
                        Image(systemName: "person.fill")
                            .foregroundColor(.blue)
                    )
            }
            
            VStack(alignment: .leading, spacing: 4) {
                Text(agent.name)
                    .font(.headline)
                
                if !agent.description.isEmpty {
                    Text(agent.description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }
                
                if let model = agent.model {
                    Text(model)
                        .font(.caption2)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(Color.blue.opacity(0.1))
                        .foregroundColor(.blue)
                        .cornerRadius(4)
                }
            }
            
            Spacer()
            
            Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                .foregroundColor(isSelected ? .blue : .gray)
                .font(.title2)
        }
        .padding(.vertical, 8)
        .contentShape(Rectangle())
        .onTapGesture {
            onToggle()
        }
    }
}