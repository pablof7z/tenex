import SwiftUI

struct ProjectSettingsView: View {
    var body: some View {
        Text("Project Settings")
            .navigationTitle("Settings")
    }
}

#Preview {
    NavigationStack {
        ProjectSettingsView()
    }
}