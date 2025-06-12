import SwiftUI
import NDKSwift

struct InstructionSelectionView: View {
    @Binding var selectedInstructions: Set<Instruction>
    @State private var instructions: [Instruction] = []
    @State private var isLoading = true
    @State private var searchText = ""
    
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
        VStack {
            Text("Select Instructions (Optional)")
                .font(.title2)
                .fontWeight(.semibold)
                .padding(.top)
            
            Text("Add context and guidelines for your project")
                .font(.subheadline)
                .foregroundColor(.secondary)
            
            HStack {
                Text("\(selectedInstructions.count) selected")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Spacer()
                
                if !selectedInstructions.isEmpty {
                    Button("Clear All") {
                        selectedInstructions.removeAll()
                    }
                    .font(.caption)
                }
            }
            .padding(.horizontal)
            
            if isLoading {
                Spacer()
                ProgressView("Loading instructions...")
                Spacer()
            } else if instructions.isEmpty {
                EmptyStateView(
                    icon: "text.book.closed",
                    title: "No Instructions Available",
                    description: "Instructions will appear here once they're created"
                )
            } else {
                SearchBar(text: $searchText, placeholder: "Search instructions")
                    .padding(.horizontal)
                
                List(filteredInstructions) { instruction in
                    InstructionRow(
                        instruction: instruction,
                        isSelected: selectedInstructions.contains(instruction),
                        onToggle: {
                            if selectedInstructions.contains(instruction) {
                                selectedInstructions.remove(instruction)
                            } else {
                                selectedInstructions.insert(instruction)
                            }
                        }
                    )
                }
                .listStyle(PlainListStyle())
            }
        }
        .onAppear {
            loadInstructions()
        }
    }
    
    private func loadInstructions() {
        Task {
            // For now, using a placeholder kind. You'll need to define the actual kind for instructions
            let filter = NDKFilter(kinds: [30023]) // Long-form content
            do {
                let events = try await NDKManager.shared.ndk.fetchEvents(filter)
                let loadedInstructions = events.compactMap { event -> Instruction? in
                    // Filter for instruction content
                    if event.tagValue("type") == "instruction" {
                        return Instruction(from: event)
                    }
                    return nil
                }
                
                await MainActor.run {
                    self.instructions = loadedInstructions.sorted { $0.created > $1.created }
                    self.isLoading = false
                }
            } catch {
                print("Failed to load instructions: \(error)")
                await MainActor.run {
                    self.isLoading = false
                }
            }
        }
    }
}

struct InstructionRow: View {
    let instruction: Instruction
    let isSelected: Bool
    let onToggle: () -> Void
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 6) {
                Text(instruction.name)
                    .font(.headline)
                
                if !instruction.summary.isEmpty {
                    Text(instruction.summary)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }
                
                if !instruction.tags.isEmpty {
                    HStack(spacing: 4) {
                        ForEach(instruction.tags.prefix(3), id: \.self) { tag in
                            Text("#\(tag)")
                                .font(.caption2)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.green.opacity(0.1))
                                .foregroundColor(.green)
                                .cornerRadius(4)
                        }
                        if instruction.tags.count > 3 {
                            Text("+\(instruction.tags.count - 3)")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    }
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