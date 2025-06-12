import SwiftUI

struct ProjectChatsView: View {
    let project: Project
    @State private var selectedChat: Chat?
    
    var body: some View {
        VStack {
            Text("Project Chats")
                .font(.largeTitle)
                .fontWeight(.bold)
                .padding()
            
            Text("Chat functionality coming soon")
                .foregroundColor(.secondary)
            
            Spacer()
        }
    }
}