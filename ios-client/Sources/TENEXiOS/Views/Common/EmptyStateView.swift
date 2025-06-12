import SwiftUI

struct EmptyStateView<Content: View>: View {
    let icon: String
    let title: String
    let description: String
    let action: () -> Content
    
    init(icon: String, title: String, description: String, @ViewBuilder action: @escaping () -> Content) {
        self.icon = icon
        self.title = title
        self.description = description
        self.action = action
    }
    
    var body: some View {
        VStack(spacing: 20) {
            Spacer()
            
            Image(systemName: icon)
                .font(.system(size: 60))
                .foregroundColor(.secondary)
            
            VStack(spacing: 8) {
                Text(title)
                    .font(.title2)
                    .fontWeight(.semibold)
                
                Text(description)
                    .font(.body)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            
            action()
            
            Spacer()
        }
        .padding()
    }
}

extension EmptyStateView where Content == EmptyView {
    init(icon: String, title: String, description: String) {
        self.icon = icon
        self.title = title
        self.description = description
        self.action = { EmptyView() }
    }
}