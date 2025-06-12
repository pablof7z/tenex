import Foundation
import NDKSwift
import Combine

class ProjectManager: ObservableObject {
    static let shared = ProjectManager()
    
    @Published var projects: [Project] = []
    @Published var selectedProject: Project?
    @Published var isLoading = false
    @Published var error: Error?
    
    private var cancellables = Set<AnyCancellable>()
    private var projectsSubscription: NDKSubscription?
    
    private init() {
        setupSubscriptions()
    }
    
    private func setupSubscriptions() {
        // Subscribe to project events when authenticated
        AuthManager.shared.$isAuthenticated
            .sink { [weak self] isAuthenticated in
                if isAuthenticated {
                    self?.subscribeToProjects()
                } else {
                    self?.projectsSubscription?.close()
                    self?.projects = []
                }
            }
            .store(in: &cancellables)
    }
    
    func subscribeToProjects() {
        guard let userPubkey = AuthManager.shared.currentUser?.pubkey else { return }
        
        let filter = NDKFilter(
            authors: [userPubkey],
            kinds: [31933] // Project events
        )
        
        projectsSubscription = NDKManager.shared.ndk.subscribe(filter: filter) { [weak self] event in
            DispatchQueue.main.async {
                self?.handleProjectEvent(event)
            }
        }
    }
    
    private func handleProjectEvent(_ event: NDKEvent) {
        let project = Project(from: event)
        
        if let index = projects.firstIndex(where: { $0.id == project.id }) {
            projects[index] = project
        } else {
            projects.append(project)
        }
        
        // Sort projects by creation date
        projects.sort { $0.created > $1.created }
    }
    
    func createProject(name: String, description: String, slug: String, repo: String?, hashtags: [String]) async throws {
        guard let signer = AuthManager.shared.signer else {
            throw ProjectError.notAuthenticated
        }
        
        let event = NDKEvent(kind: 31933)
        event.content = description
        event.tags = [
            ["d", slug],
            ["title", name]
        ]
        
        if let repo = repo {
            event.tags.append(["repo", repo])
        }
        
        for hashtag in hashtags {
            event.tags.append(["t", hashtag])
        }
        
        try await event.sign(using: signer)
        
        try await NDKManager.shared.ndk.publish(event)
        
        // Create local project
        let project = Project(name: name, description: description, slug: slug, repo: repo, hashtags: hashtags, author: AuthManager.shared.currentUser?.pubkey ?? "")
        
        await MainActor.run {
            self.projects.append(project)
            self.projects.sort { $0.created > $1.created }
        }
    }
    
    func deleteProject(_ project: Project) async throws {
        // In Nostr, we don't truly delete, but we can create a deletion event
        guard let signer = AuthManager.shared.signer else {
            throw ProjectError.notAuthenticated
        }
        
        let event = NDKEvent(kind: 5) // Deletion event
        event.tags = [
            ["e", project.id],
            ["k", "31933"]
        ]
        
        try await event.sign(using: signer)
        
        try await NDKManager.shared.ndk.publish(event)
        
        await MainActor.run {
            self.projects.removeAll { $0.id == project.id }
        }
    }
    
    func selectProject(_ project: Project) {
        selectedProject = project
    }
}

enum ProjectError: LocalizedError {
    case notAuthenticated
    case invalidProject
    
    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "You must be logged in to manage projects"
        case .invalidProject:
            return "Invalid project data"
        }
    }
}