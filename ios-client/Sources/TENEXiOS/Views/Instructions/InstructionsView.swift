import SwiftUI
import NDKSwift

struct InstructionsView: View {
    @State private var instructions: [Instruction] = []
    @State private var searchText = ""
    @State private var showingCreateInstruction = false
    
    var filteredInstructions: [Instruction] {
        if searchText.isEmpty {
            return instructions
        } else {
            return instructions.filter { instruction in
                instruction.name.localizedCaseInsensitiveContains(searchText) ||
                instruction.summary.localizedCaseInsensitiveContains(searchText) ||
                instruction.tags.contains { $0.localizedCaseInsensitiveContains(searchText) }
            }
        }
    }
    
    var body: some View {
        NavigationView {
            VStack {
                if instructions.isEmpty {
                    EmptyStateView(
                        icon: "text.book.closed.fill",
                        title: "No Instructions Yet",
                        description: "Create instructions to guide AI agents in your projects"
                    ) {
                        Button("Create Instruction") {
                            showingCreateInstruction = true
                        }
                        .buttonStyle(.borderedProminent)
                    }
                } else {
                    List(filteredInstructions) { instruction in
                        NavigationLink(destination: InstructionDetailView(instruction: instruction)) {
                            InstructionListRow(instruction: instruction)
                        }
                    }
                    .searchable(text: $searchText, prompt: "Search instructions")
                }
            }
            .navigationTitle("Instructions")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { showingCreateInstruction = true }) {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showingCreateInstruction) {
                CreateInstructionView()
            }
            .onAppear {
                loadInstructions()
            }
        }
    }
    
    private func loadInstructions() {
        // TODO: Load from Nostr
        // Mock data for now
        let mockInstructions = [
            createMockInstruction(
                name: "Code Quality Standards",
                summary: "Guidelines for maintaining high-quality, maintainable code",
                tags: ["quality", "standards", "best-practices"]
            ),
            createMockInstruction(
                name: "Security Best Practices",
                summary: "Essential security guidelines for all projects",
                tags: ["security", "authentication", "encryption"]
            ),
            createMockInstruction(
                name: "API Design Guidelines",
                summary: "RESTful API design patterns and conventions",
                tags: ["api", "rest", "design"]
            )
        ]
        
        instructions = mockInstructions
    }
    
    private func createMockInstruction(name: String, summary: String, tags: [String]) -> Instruction {
        let event = NDKEvent(kind: 30023)
        event.tags = [
            ["title", name],
            ["summary", summary],
            ["type", "instruction"]
        ] + tags.map { ["t", $0] }
        event.content = "Full instruction content goes here..."
        event.createdAt = Int64(Date().timeIntervalSince1970)
        
        return Instruction(from: event)
    }
}

struct InstructionListRow: View {
    let instruction: Instruction
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(instruction.name)
                .font(.headline)
            
            Text(instruction.summary)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .lineLimit(2)
            
            if !instruction.tags.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(instruction.tags, id: \.self) { tag in
                            Text("#\(tag)")
                                .font(.caption)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color.green.opacity(0.1))
                                .foregroundColor(.green)
                                .cornerRadius(4)
                        }
                    }
                }
            }
            
            Text(instruction.created, style: .relative)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }
}