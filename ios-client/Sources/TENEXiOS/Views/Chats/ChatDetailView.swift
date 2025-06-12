import SwiftUI

struct ChatDetailView: View {
    var body: some View {
        Text("Chat Detail")
            .navigationTitle("Chat")
    }
}

#Preview {
    NavigationStack {
        ChatDetailView()
    }
}