import Foundation
import NDKSwift

struct Task: Identifiable, Codable, Hashable {
    let id: String
    let projectId: String
    let title: String
    let description: String
    let status: TaskStatus
    let created: Date
    let updated: Date
    let author: String
    
    enum TaskStatus: String, Codable {
        case pending = "pending"
        case inProgress = "in_progress"
        case completed = "completed"
        case cancelled = "cancelled"
    }
    
    init(projectId: String, title: String, description: String, author: String) {
        self.id = UUID().uuidString
        self.projectId = projectId
        self.title = title
        self.description = description
        self.status = .pending
        self.created = Date()
        self.updated = Date()
        self.author = author
    }
    
    init(from event: NDKEvent) {
        self.id = event.id ?? UUID().uuidString
        self.projectId = event.tagValue("project") ?? ""
        self.title = event.tagValue("title") ?? "Untitled Task"
        self.description = event.content ?? ""
        
        let statusString = event.tagValue("status") ?? "pending"
        self.status = TaskStatus(rawValue: statusString) ?? .pending
        
        self.created = Date(timeIntervalSince1970: TimeInterval(event.createdAt ?? 0))
        self.updated = Date(timeIntervalSince1970: TimeInterval(event.createdAt ?? 0))
        self.author = event.pubkey
    }
    
    func toEvent() -> NDKEvent {
        let event = NDKEvent(kind: 1934) // Task events
        event.content = description
        event.tags = [
            ["project", projectId],
            ["title", title],
            ["status", status.rawValue]
        ]
        return event
    }
}