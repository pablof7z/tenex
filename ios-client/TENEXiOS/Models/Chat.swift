import Foundation

struct Chat: Identifiable {
    let id: String
    let title: String
    let lastMessage: String?
    let timestamp: Date
    let participants: [String]
    var unreadCount: Int = 0
    
    init(id: String, title: String, lastMessage: String? = nil, timestamp: Date, participants: [String], unreadCount: Int = 0) {
        self.id = id
        self.title = title
        self.lastMessage = lastMessage
        self.timestamp = timestamp
        self.participants = participants
        self.unreadCount = unreadCount
    }
}