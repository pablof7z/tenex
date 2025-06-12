import Foundation
import NDKSwift

struct Instruction: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let summary: String
    let content: String
    let author: String
    let created: Date
    let tags: [String]
    
    static func == (lhs: Instruction, rhs: Instruction) -> Bool {
        lhs.id == rhs.id
    }
    
    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
    
    init(from event: NDKEvent) {
        self.id = event.id ?? UUID().uuidString
        self.name = event.tagValue("title") ?? "Untitled Instruction"
        self.summary = event.tagValue("summary") ?? ""
        self.content = event.content
        self.author = event.pubkey
        self.created = Date(timeIntervalSince1970: TimeInterval(event.createdAt))
        self.tags = event.tags.filter { $0.first == "t" }.compactMap { $0.count > 1 ? $0[1] : nil }
    }
}