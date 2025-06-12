import SwiftUI

struct AboutView: View {
    var body: some View {
        Text("About TENEX")
            .navigationTitle("About")
    }
}

#Preview {
    NavigationStack {
        AboutView()
    }
}