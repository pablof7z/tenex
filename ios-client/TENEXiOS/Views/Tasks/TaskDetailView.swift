import SwiftUI

struct TaskDetailView: View {
    let task: Task
    @Environment(\.dismiss) var dismiss
    @StateObject private var taskManager = TaskManager.shared
    @State private var selectedStatus: Task.TaskStatus
    @State private var isUpdating = false
    
    init(task: Task) {
        self.task = task
        self._selectedStatus = State(initialValue: task.status)
    }
    
    var statusUpdates: [StatusUpdate] {
        taskManager.getStatusUpdates(for: task.id)
    }
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Task Info
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Task Details")
                            .font(.headline)
                            .foregroundColor(.secondary)
                        
                        VStack(alignment: .leading, spacing: 8) {
                            Text(task.title)
                                .font(.title2)
                                .fontWeight(.semibold)
                            
                            if !task.description.isEmpty {
                                Text(task.description)
                                    .font(.body)
                                    .foregroundColor(.secondary)
                            }
                            
                            HStack {
                                Label("Created", systemImage: "calendar")
                                    .foregroundColor(.secondary)
                                Spacer()
                                Text(task.created, style: .date)
                            }
                            .font(.caption)
                        }
                        .padding()
                        .background(Color.gray.opacity(0.1))
                        .cornerRadius(12)
                    }
                    
                    // Status Selection
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Status")
                            .font(.headline)
                            .foregroundColor(.secondary)
                        
                        Picker("Status", selection: $selectedStatus) {
                            Text("Pending").tag(Task.TaskStatus.pending)
                            Text("In Progress").tag(Task.TaskStatus.inProgress)
                            Text("Completed").tag(Task.TaskStatus.completed)
                            Text("Cancelled").tag(Task.TaskStatus.cancelled)
                        }
                        .pickerStyle(SegmentedPickerStyle())
                        .disabled(isUpdating)
                        .onChange(of: selectedStatus) { newValue in
                            if newValue != task.status {
                                updateStatus(newValue)
                            }
                        }
                    }
                    
                    // Status Updates
                    if !statusUpdates.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Updates")
                                .font(.headline)
                                .foregroundColor(.secondary)
                            
                            ForEach(statusUpdates) { update in
                                StatusUpdateRow(update: update)
                            }
                        }
                    }
                }
                .padding()
            }
            .navigationTitle("Task")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
    
    private func updateStatus(_ newStatus: Task.TaskStatus) {
        isUpdating = true
        
        Task {
            do {
                try await taskManager.updateTaskStatus(task, status: newStatus)
            } catch {
                // Revert on error
                await MainActor.run {
                    selectedStatus = task.status
                }
            }
            
            await MainActor.run {
                isUpdating = false
            }
        }
    }
}

struct StatusUpdateRow: View {
    let update: StatusUpdate
    
    var confidenceColor: Color {
        switch update.confidenceLevel {
        case 8...10:
            return .green
        case 5...7:
            return .yellow
        default:
            return .red
        }
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label(update.agentName, systemImage: "person.circle")
                    .font(.caption)
                    .fontWeight(.medium)
                
                Spacer()
                
                HStack(spacing: 4) {
                    Image(systemName: "gauge")
                        .font(.caption2)
                    Text("\(update.confidenceLevel)/10")
                        .font(.caption2)
                }
                .foregroundColor(confidenceColor)
                
                Text(update.created, style: .relative)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            
            Text(update.content)
                .font(.body)
            
            if let commitHash = update.commitHash {
                HStack {
                    Image(systemName: "number")
                        .font(.caption2)
                    Text(String(commitHash.prefix(7)))
                        .font(.caption2)
                        .fontDesign(.monospaced)
                }
                .foregroundColor(.blue)
            }
        }
        .padding()
        .background(Color.gray.opacity(0.05))
        .cornerRadius(8)
    }
}