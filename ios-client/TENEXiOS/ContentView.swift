import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authManager: AuthManager
    @State private var selectedTab = 0
    
    var body: some View {
        if authManager.isAuthenticated {
            TabView(selection: $selectedTab) {
                ProjectsView()
                    .tabItem {
                        Label("Projects", systemImage: "folder.fill")
                    }
                    .tag(0)
                
                ChatsView()
                    .tabItem {
                        Label("Chats", systemImage: "message.fill")
                    }
                    .tag(1)
                
                AgentsView()
                    .tabItem {
                        Label("Agents", systemImage: "person.2.fill")
                    }
                    .tag(2)
                
                InstructionsView()
                    .tabItem {
                        Label("Instructions", systemImage: "text.book.closed.fill")
                    }
                    .tag(3)
                
                SettingsView()
                    .tabItem {
                        Label("Settings", systemImage: "gear")
                    }
                    .tag(4)
            }
        } else {
            LoginView()
        }
    }
}