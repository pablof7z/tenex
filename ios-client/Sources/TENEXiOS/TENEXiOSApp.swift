import SwiftUI
import NDKSwift

@main
struct TENEXiOSApp: App {
    @StateObject private var ndkManager = NDKManager.shared
    @StateObject private var authManager = AuthManager.shared
    @StateObject private var projectManager = ProjectManager.shared
    @StateObject private var backendManager = BackendManager.shared
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(ndkManager)
                .environmentObject(authManager)
                .environmentObject(projectManager)
                .environmentObject(backendManager)
                .onAppear {
                    ndkManager.connect()
                }
        }
    }
}