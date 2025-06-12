import SwiftUI

struct ChatsView: View {
    @State private var chats: [Chat] = []
    @State private var searchText = ""
    
    var filteredChats: [Chat] {
        if searchText.isEmpty {
            return chats
        } else {
            return chats.filter { chat in
                chat.title.localizedCaseInsensitiveContains(searchText) ||
                chat.lastMessage?.localizedCaseInsensitiveContains(searchText) == true
            }
        }
    }
    
    var body: some View {
        NavigationView {
            VStack {
                if chats.isEmpty {
                    EmptyStateView(
                        icon: "message.badge.circle.fill",
                        title: "No Chats Yet",
                        description: "Start a conversation with AI agents or collaborators"
                    )
                } else {
                    List(filteredChats) { chat in
                        NavigationLink(destination: ChatDetailView(chat: chat)) {
                            ChatRowView(chat: chat)
                        }
                    }
                    .searchable(text: $searchText, prompt: "Search chats")
                }
            }
            .navigationTitle("Chats")
            .onAppear {
                loadChats()
            }
        }
    }
    
    private func loadChats() {
        // TODO: Load chats from Nostr events
        // For now, using mock data
        chats = [
            Chat(id: "1", title: "Claude Code Assistant", lastMessage: "I've completed the task", timestamp: Date(), participants: ["claude"]),
            Chat(id: "2", title: "Project Planning", lastMessage: "Let's discuss the architecture", timestamp: Date().addingTimeInterval(-3600), participants: ["planner"])
        ]
    }
}

struct ChatRowView: View {
    let chat: Chat
    
    var body: some View {
        HStack {
            // Avatar
            Circle()
                .fill(Color.blue.opacity(0.2))
                .frame(width: 50, height: 50)
                .overlay(
                    Image(systemName: "message.fill")
                        .foregroundColor(.blue)
                )
            
            VStack(alignment: .leading, spacing: 4) {
                Text(chat.title)
                    .font(.headline)
                
                if let lastMessage = chat.lastMessage {
                    Text(lastMessage)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
                
                Text(chat.timestamp, style: .relative)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            if chat.unreadCount > 0 {
                Text("\(chat.unreadCount)")
                    .font(.caption)
                    .foregroundColor(.white)
                    .padding(6)
                    .background(Color.blue)
                    .clipShape(Circle())
            }
        }
        .padding(.vertical, 4)
    }
}