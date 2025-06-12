import SwiftUI

struct CreateTaskView: View {
    let project: Project
    @Environment(\.dismiss) var dismiss
    @StateObject private var taskManager = TaskManager.shared
    
    @State private var title = ""
    @State private var description = ""
    @State private var isCreating = false
    @State private var error: Error?
    
    var body: some View {
        NavigationView {
            Form {
                Section("Task Details") {
                    TextField("Title", text: $title)
                    
                    VStack(alignment: .leading) {
                        Text("Description")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        TextEditor(text: $description)
                            .frame(minHeight: 100)
                    }
                }
                
                Section("Project") {
                    HStack {
                        Image(systemName: "folder")
                            .foregroundColor(.blue)
                        Text(project.name)
                        Spacer()
                        Text("Selected")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                
                if let error = error {
                    Section {
                        Text(error.localizedDescription)
                            .foregroundColor(.red)
                            .font(.caption)
                    }
                }
            }
            .navigationTitle("Create Task")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Create") {
                        createTask()
                    }
                    .disabled(title.isEmpty || isCreating)
                }
            }
        }
    }
    
    private func createTask() {
        isCreating = true
        error = nil
        
        Task {
            do {
                try await taskManager.createTask(
                    title: title,
                    description: description,
                    projectId: project.id
                )
                
                await MainActor.run {
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    self.error = error
                    self.isCreating = false
                }
            }
        }
    }
}