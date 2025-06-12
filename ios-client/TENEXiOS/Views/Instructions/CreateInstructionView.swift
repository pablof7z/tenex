import SwiftUI

struct CreateInstructionView: View {
    var body: some View {
        Text("Create Instruction")
            .navigationTitle("New Instruction")
    }
}

#Preview {
    NavigationStack {
        CreateInstructionView()
    }
}