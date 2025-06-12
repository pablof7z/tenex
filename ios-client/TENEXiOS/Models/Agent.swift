import Foundation
import NDKSwift

struct Agent: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let description: String
    let model: String?
    let avatar: String?
    let author: String
    let created: Date
    
    static func == (lhs: Agent, rhs: Agent) -> Bool {
        lhs.id == rhs.id
    }
    
    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
    
    init(from event: NDKEvent) {
        self.id = event.id ?? UUID().uuidString
        
        // Parse profile data from kind 0 event
        let data = event.content.data(using: .utf8) ?? Data()
        if let profile = try? JSONDecoder().decode(NDKUserProfile.self, from: data) {
            self.name = profile.name ?? "Unknown Agent"
            self.description = profile.about ?? ""
            self.avatar = profile.picture
        } else {
            self.name = "Unknown Agent"
            self.description = ""
            self.avatar = nil
        }
        
        self.model = event.tagValue("model")
        self.author = event.pubkey
        self.created = Date(timeIntervalSince1970: TimeInterval(event.createdAt))
    }
}