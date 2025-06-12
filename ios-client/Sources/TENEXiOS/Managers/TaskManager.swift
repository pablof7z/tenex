import Foundation
import NDKSwift
import Combine

class TaskManager: ObservableObject {
    static let shared = TaskManager()
    
    @Published var tasks: [Task] = []
    @Published var statusUpdates: [String: [StatusUpdate]] = [:] // taskId -> updates
    @Published var isLoading = false
    @Published var error: Error?
    
    private var cancellables = Set<AnyCancellable>()
    private var tasksSubscription: NDKSubscription?
    private var updatesSubscription: NDKSubscription?
    
    private init() {
        setupSubscriptions()
    }
    
    private func setupSubscriptions() {
        // Subscribe to selected project changes
        ProjectManager.shared.$selectedProject
            .sink { [weak self] project in
                if let project = project {
                    self?.subscribeToTasks(for: project)
                } else {
                    self?.tasksSubscription?.close()
                    self?.updatesSubscription?.close()
                    self?.tasks = []
                    self?.statusUpdates = [:]
                }
            }
            .store(in: &cancellables)
    }
    
    func subscribeToTasks(for project: Project) {
        // Subscribe to task events
        let taskFilter = NDKFilter(
            kinds: [1934], // Task events
            tags: ["project": [project.id]]
        )
        
        tasksSubscription = NDKManager.shared.ndk.subscribe(filter: taskFilter) { [weak self] event in
            DispatchQueue.main.async {
                self?.handleTaskEvent(event)
            }
        }
        
        // Subscribe to status updates
        let updateFilter = NDKFilter(
            kinds: [1], // Regular notes with task references
            tags: ["#t": ["task-update"]]
        )
        
        updatesSubscription = NDKManager.shared.ndk.subscribe(filter: updateFilter) { [weak self] event in
            DispatchQueue.main.async {
                self?.handleStatusUpdate(event)
            }
        }
    }
    
    private func handleTaskEvent(_ event: NDKEvent) {
        let task = Task(from: event)
        
        if let index = tasks.firstIndex(where: { $0.id == task.id }) {
            tasks[index] = task
        } else {
            tasks.append(task)
        }
        
        // Sort tasks by creation date
        tasks.sort { $0.created > $1.created }
    }
    
    private func handleStatusUpdate(_ event: NDKEvent) {
        let update = StatusUpdate(from: event)
        
        if statusUpdates[update.taskId] != nil {
            statusUpdates[update.taskId]?.append(update)
        } else {
            statusUpdates[update.taskId] = [update]
        }
        
        // Sort updates by creation date
        statusUpdates[update.taskId]?.sort { $0.created > $1.created }
    }
    
    func createTask(title: String, description: String, projectId: String) async throws {
        guard let signer = AuthManager.shared.signer else {
            throw TaskError.notAuthenticated
        }
        
        let task = Task(projectId: projectId, title: title, description: description, author: AuthManager.shared.currentUser?.pubkey ?? "")
        let event = task.toEvent()
        
        try await event.sign(using: signer)
        try await NDKManager.shared.ndk.publish(event)
        
        await MainActor.run {
            self.tasks.append(task)
            self.tasks.sort { $0.created > $1.created }
        }
    }
    
    func updateTaskStatus(_ task: Task, status: Task.TaskStatus) async throws {
        guard let signer = AuthManager.shared.signer else {
            throw TaskError.notAuthenticated
        }
        
        var updatedTask = task
        updatedTask = Task(
            projectId: task.projectId,
            title: task.title,
            description: task.description,
            author: task.author
        )
        
        let event = updatedTask.toEvent()
        event.tags.append(["e", task.id, "replace"])
        
        try await event.sign(using: signer)
        try await NDKManager.shared.ndk.publish(event)
    }
    
    func getStatusUpdates(for taskId: String) -> [StatusUpdate] {
        return statusUpdates[taskId] ?? []
    }
}

enum TaskError: LocalizedError {
    case notAuthenticated
    case invalidTask
    
    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "You must be logged in to manage tasks"
        case .invalidTask:
            return "Invalid task data"
        }
    }
}