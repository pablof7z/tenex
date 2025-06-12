import SwiftUI
import NDKSwift

struct TemplateSelectionView: View {
    @Binding var selectedTemplate: Template?
    @State private var templates: [Template] = []
    @State private var isLoading = true
    @State private var searchText = ""
    
    var filteredTemplates: [Template] {
        if searchText.isEmpty {
            return templates
        } else {
            return templates.filter { template in
                template.name.localizedCaseInsensitiveContains(searchText) ||
                template.description.localizedCaseInsensitiveContains(searchText) ||
                template.topics.contains { $0.localizedCaseInsensitiveContains(searchText) }
            }
        }
    }
    
    var body: some View {
        VStack {
            Text("Select a Template (Optional)")
                .font(.title2)
                .fontWeight(.semibold)
                .padding(.top)
            
            Text("Start with a pre-configured project template")
                .font(.subheadline)
                .foregroundColor(.secondary)
            
            if isLoading {
                Spacer()
                ProgressView("Loading templates...")
                Spacer()
            } else if templates.isEmpty {
                EmptyStateView(
                    icon: "doc.text.magnifyingglass",
                    title: "No Templates Available",
                    description: "Templates will appear here once they're published"
                )
            } else {
                SearchBar(text: $searchText, placeholder: "Search templates")
                    .padding(.horizontal)
                
                ScrollView {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 150))], spacing: 16) {
                        // Skip template option
                        Button(action: { selectedTemplate = nil }) {
                            VStack(spacing: 12) {
                                Image(systemName: "xmark.circle.fill")
                                    .font(.largeTitle)
                                    .foregroundColor(.secondary)
                                
                                Text("Skip")
                                    .font(.headline)
                                
                                Text("Start from scratch")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                    .multilineTextAlignment(.center)
                            }
                            .frame(maxWidth: .infinity, minHeight: 120)
                            .padding()
                            .background(Color.gray.opacity(0.1))
                            .cornerRadius(12)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(selectedTemplate == nil ? Color.blue : Color.clear, lineWidth: 2)
                            )
                        }
                        .buttonStyle(PlainButtonStyle())
                        
                        ForEach(filteredTemplates) { template in
                            TemplateCard(
                                template: template,
                                isSelected: selectedTemplate?.id == template.id
                            ) {
                                selectedTemplate = template
                            }
                        }
                    }
                    .padding()
                }
            }
        }
        .onAppear {
            loadTemplates()
        }
    }
    
    private func loadTemplates() {
        Task {
            let filter = NDKFilter(kinds: [30717]) // Template events
            do {
                let events = try await NDKManager.shared.ndk.fetchEvents(filter)
                let loadedTemplates = events.compactMap { Template(from: $0) }
                
                await MainActor.run {
                    self.templates = loadedTemplates.sorted { $0.created > $1.created }
                    self.isLoading = false
                }
            } catch {
                print("Failed to load templates: \(error)")
                await MainActor.run {
                    self.isLoading = false
                }
            }
        }
    }
}

struct TemplateCard: View {
    let template: Template
    let isSelected: Bool
    let onSelect: () -> Void
    
    var body: some View {
        Button(action: onSelect) {
            VStack(alignment: .leading, spacing: 8) {
                if let imageURL = template.image, let url = URL(string: imageURL) {
                    AsyncImage(url: url) { image in
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(height: 80)
                            .clipped()
                    } placeholder: {
                        Rectangle()
                            .fill(Color.gray.opacity(0.2))
                            .frame(height: 80)
                            .overlay(
                                ProgressView()
                            )
                    }
                    .cornerRadius(8)
                } else {
                    Rectangle()
                        .fill(Color.blue.opacity(0.1))
                        .frame(height: 80)
                        .overlay(
                            Image(systemName: "doc.text.fill")
                                .font(.largeTitle)
                                .foregroundColor(.blue)
                        )
                        .cornerRadius(8)
                }
                
                Text(template.name)
                    .font(.headline)
                    .lineLimit(1)
                
                Text(template.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
                
                if !template.topics.isEmpty {
                    HStack(spacing: 4) {
                        ForEach(template.topics.prefix(3), id: \.self) { topic in
                            Text("#\(topic)")
                                .font(.caption2)
                                .foregroundColor(.blue)
                        }
                        if template.topics.count > 3 {
                            Text("+\(template.topics.count - 3)")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(Color.gray.opacity(0.1))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? Color.blue : Color.clear, lineWidth: 2)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}