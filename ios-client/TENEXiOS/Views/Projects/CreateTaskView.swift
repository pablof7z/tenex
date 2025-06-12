import SwiftUI

struct CreateTaskView: View {
    var body: some View {
        Text("Create Task")
            .navigationTitle("New Task")
    }
}

#Preview {
    NavigationStack {
        CreateTaskView()
    }
}