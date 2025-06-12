import Foundation
import NDKSwift

struct Project: Identifiable, Codable {
    let id: String
    let name: String
    let description: String
    let slug: String
    let repo: String?
    let hashtags: [String]
    let created: Date
    let author: String
    let naddr: String?
    
    var agents: [String: String] = ["default": ""]
    var metadata: ProjectMetadata?
    
    init(from event: NDKEvent) {
        self.id = event.id ?? UUID().uuidString
        self.name = event.tagValue("title") ?? "Untitled Project"
        self.description = event.content
        self.slug = event.tagValue("d") ?? ""
        self.repo = event.tagValue("repo")
        self.hashtags = event.tags.filter { $0.first == "t" }.compactMap { $0.count > 1 ? $0[1] : nil }
        self.created = Date(timeIntervalSince1970: TimeInterval(event.createdAt))
        self.author = event.pubkey
        self.naddr = event.tagValue("naddr")
    }
    
    init(name: String, description: String, slug: String, repo: String? = nil, hashtags: [String] = [], author: String = "") {
        self.id = UUID().uuidString
        self.name = name
        self.description = description
        self.slug = slug
        self.repo = repo
        self.hashtags = hashtags
        self.created = Date()
        self.author = author
        self.naddr = nil
    }
}

struct ProjectMetadata: Codable {
    let projectName: String
    let projectPath: String
    let projectNaddr: String?
    let projectNsec: String?
    let createdAt: Date
}

extension NDKEvent {
    func tagValue(_ name: String) -> String? {
        return tags.first(where: { $0.first == name && $0.count > 1 })?[1]
    }
}