import SwiftUI

struct TaskListView: View {
    let project: Project
    @StateObject private var taskManager = TaskManager.shared
    @State private var showingCreateTask = false
    @State private var selectedTask: Task?
    
    var body: some View {
        VStack {
            if taskManager.tasks.isEmpty {
                EmptyStateView(
                    icon: "checklist",
                    title: "No Tasks Yet",
                    description: "Create your first task to get started"
                )
                .padding()
            } else {
                List {
                    ForEach(taskManager.tasks) { task in
                        TaskRow(task: task)
                            .onTapGesture {
                                selectedTask = task
                            }
                    }
                }
                .listStyle(PlainListStyle())
            }
        }
        .navigationTitle("Tasks")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: { showingCreateTask = true }) {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showingCreateTask) {
            CreateTaskView(project: project)
        }
        .sheet(item: $selectedTask) { task in
            TaskDetailView(task: task)
        }
    }
}

struct TaskRow: View {
    let task: Task
    
    var statusIcon: String {
        switch task.status {
        case .pending:
            return "circle"
        case .inProgress:
            return "circle.inset.filled"
        case .completed:
            return "checkmark.circle.fill"
        case .cancelled:
            return "xmark.circle"
        }
    }
    
    var statusColor: Color {
        switch task.status {
        case .pending:
            return .gray
        case .inProgress:
            return .blue
        case .completed:
            return .green
        case .cancelled:
            return .red
        }
    }
    
    var body: some View {
        HStack {
            Image(systemName: statusIcon)
                .foregroundColor(statusColor)
                .font(.title2)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(task.title)
                    .font(.headline)
                
                if !task.description.isEmpty {
                    Text(task.description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }
                
                HStack {
                    Label(task.status.rawValue.replacingOccurrences(of: "_", with: " ").capitalized, systemImage: "flag")
                        .font(.caption2)
                        .foregroundColor(statusColor)
                    
                    Spacer()
                    
                    Text(task.created, style: .relative)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }
}