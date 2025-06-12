import SwiftUI

struct BackendSettingsView: View {
    var body: some View {
        Text("Backend Settings")
            .navigationTitle("Backend")
    }
}

#Preview {
    NavigationStack {
        BackendSettingsView()
    }
}