import SwiftUI

struct AgentDetailView: View {
    var body: some View {
        Text("Agent Detail")
            .navigationTitle("Agent")
    }
}

#Preview {
    NavigationStack {
        AgentDetailView()
    }
}