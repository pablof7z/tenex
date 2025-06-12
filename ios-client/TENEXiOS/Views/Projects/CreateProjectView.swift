import SwiftUI

struct CreateProjectView: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var projectManager: ProjectManager
    
    @State private var projectName = ""
    @State private var projectDescription = ""
    @State private var projectSlug = ""
    @State private var repoURL = ""
    @State private var hashtagsText = ""
    @State private var selectedTemplate: Template?
    @State private var selectedAgents: Set<Agent> = []
    @State private var selectedInstructions: Set<Instruction> = []
    
    @State private var currentStep = 0
    @State private var isCreating = false
    @State private var showingError = false
    @State private var errorMessage = ""
    
    var hashtags: [String] {
        hashtagsText
            .split(separator: " ")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .map { $0.hasPrefix("#") ? String($0.dropFirst()) : String($0) }
    }
    
    var canProceed: Bool {
        switch currentStep {
        case 0: // Template selection (optional)
            return true
        case 1: // Project details
            return !projectName.isEmpty && !projectSlug.isEmpty
        case 2: // Agent selection (optional)
            return true
        case 3: // Instructions (optional)
            return true
        default:
            return false
        }
    }
    
    var body: some View {
        NavigationView {
            VStack {
                // Progress indicator
                ProgressView(value: Double(currentStep + 1), total: 4)
                    .padding()
                
                // Step content
                TabView(selection: $currentStep) {
                    // Step 0: Template Selection
                    TemplateSelectionView(selectedTemplate: $selectedTemplate)
                        .tag(0)
                    
                    // Step 1: Project Details
                    ProjectDetailsView(
                        projectName: $projectName,
                        projectDescription: $projectDescription,
                        projectSlug: $projectSlug,
                        repoURL: $repoURL,
                        hashtagsText: $hashtagsText,
                        template: selectedTemplate
                    )
                    .tag(1)
                    
                    // Step 2: Agent Selection
                    AgentSelectionView(selectedAgents: $selectedAgents)
                        .tag(2)
                    
                    // Step 3: Instructions
                    InstructionSelectionView(selectedInstructions: $selectedInstructions)
                        .tag(3)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .animation(.easeInOut, value: currentStep)
                
                // Navigation buttons
                HStack {
                    if currentStep > 0 {
                        Button("Back") {
                            currentStep -= 1
                        }
                        .buttonStyle(.bordered)
                    }
                    
                    Spacer()
                    
                    if currentStep < 3 {
                        Button("Next") {
                            currentStep += 1
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(!canProceed)
                    } else {
                        Button(action: createProject) {
                            if isCreating {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            } else {
                                Text("Create Project")
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(isCreating || !canProceed)
                    }
                }
                .padding()
            }
            .navigationTitle("Create Project")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
            .alert("Error", isPresented: $showingError) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(errorMessage)
            }
        }
    }
    
    private func createProject() {
        isCreating = true
        
        Task {
            do {
                try await projectManager.createProject(
                    name: projectName,
                    description: projectDescription,
                    slug: projectSlug,
                    repo: repoURL.isEmpty ? nil : repoURL,
                    hashtags: hashtags
                )
                
                await MainActor.run {
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    showingError = true
                    isCreating = false
                }
            }
        }
    }
}

struct ProjectDetailsView: View {
    @Binding var projectName: String
    @Binding var projectDescription: String
    @Binding var projectSlug: String
    @Binding var repoURL: String
    @Binding var hashtagsText: String
    let template: Template?
    
    var body: some View {
        Form {
            Section(header: Text("Project Information")) {
                TextField("Project Name", text: $projectName)
                    .textInputAutocapitalization(.words)
                
                TextField("Slug (unique identifier)", text: $projectSlug)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .onChange(of: projectName) { newValue in
                        if projectSlug.isEmpty {
                            projectSlug = newValue
                                .lowercased()
                                .replacingOccurrences(of: " ", with: "-")
                                .replacingOccurrences(of: "[^a-z0-9-]", with: "", options: .regularExpression)
                        }
                    }
                
                TextField("Repository URL (optional)", text: $repoURL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.URL)
            }
            
            Section(header: Text("Description")) {
                TextEditor(text: $projectDescription)
                    .frame(minHeight: 100)
            }
            
            Section(header: Text("Hashtags")) {
                TextField("Enter hashtags separated by spaces", text: $hashtagsText)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                
                if !hashtagsText.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(hashtagsText.split(separator: " ").map(String.init), id: \.self) { tag in
                                Text("#\(tag.hasPrefix("#") ? String(tag.dropFirst()) : tag)")
                                    .font(.caption)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Color.blue.opacity(0.1))
                                    .foregroundColor(.blue)
                                    .cornerRadius(4)
                            }
                        }
                    }
                }
            }
            
            if let template = template {
                Section(header: Text("From Template")) {
                    HStack {
                        Image(systemName: "doc.text")
                        Text(template.name)
                            .foregroundColor(.secondary)
                    }
                }
            }
        }
    }
}