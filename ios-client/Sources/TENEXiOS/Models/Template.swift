import Foundation
import NDKSwift

struct Template: Identifiable, Codable {
    let id: String
    let name: String
    let description: String
    let uri: String
    let image: String?
    let command: String?
    let topics: [String]
    let agentConfig: String?
    let content: String
    let author: String
    let created: Date
    
    init(from event: NDKEvent) {
        self.id = event.id ?? UUID().uuidString
        self.name = event.tagValue("title") ?? "Untitled Template"
        self.description = event.tagValue("description") ?? ""
        self.uri = event.tagValue("uri") ?? ""
        self.image = event.tagValue("image")
        self.command = event.tagValue("command")
        self.topics = event.tags.filter { $0.first == "t" }.compactMap { $0.count > 1 ? $0[1] : nil }
        self.agentConfig = event.tagValue("agent")
        self.content = event.content
        self.author = event.pubkey
        self.created = Date(timeIntervalSince1970: TimeInterval(event.createdAt))
    }
}