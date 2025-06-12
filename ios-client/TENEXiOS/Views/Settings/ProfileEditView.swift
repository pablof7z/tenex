import SwiftUI

struct ProfileEditView: View {
    var body: some View {
        Text("Edit Profile")
            .navigationTitle("Edit Profile")
    }
}

#Preview {
    NavigationStack {
        ProfileEditView()
    }
}