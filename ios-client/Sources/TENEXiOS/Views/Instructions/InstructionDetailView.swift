import SwiftUI

struct InstructionDetailView: View {
    var body: some View {
        Text("Instruction Detail")
            .navigationTitle("Instruction")
    }
}

#Preview {
    NavigationStack {
        InstructionDetailView()
    }
}