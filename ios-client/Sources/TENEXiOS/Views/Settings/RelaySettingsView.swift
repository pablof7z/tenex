import SwiftUI

struct RelaySettingsView: View {
    var body: some View {
        Text("Relay Settings")
            .navigationTitle("Relays")
    }
}

#Preview {
    NavigationStack {
        RelaySettingsView()
    }
}