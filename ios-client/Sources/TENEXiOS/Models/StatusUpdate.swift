import Foundation
import NDKSwift

struct StatusUpdate: Identifiable {
    let id: String
    let taskId: String
    let content: String
    let agentName: String
    let confidenceLevel: Int
    let created: Date
    let author: String
    let commitHash: String?
    
    init(from event: NDKEvent) {
        self.id = event.id ?? UUID().uuidString
        self.taskId = event.tagValue("task") ?? ""
        self.content = event.content ?? ""
        self.agentName = event.tagValue("agent") ?? "Unknown"
        self.confidenceLevel = Int(event.tagValue("confidence") ?? "5") ?? 5
        self.created = Date(timeIntervalSince1970: TimeInterval(event.createdAt ?? 0))
        self.author = event.pubkey
        self.commitHash = event.tagValue("commit")
    }
}