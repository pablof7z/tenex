import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var authManager: AuthManager
    @EnvironmentObject var ndkManager: NDKManager
    @EnvironmentObject var backendManager: BackendManager
    
    @State private var showingProfile = false
    @State private var showingRelays = false
    @State private var showingBackend = false
    @State private var showingAbout = false
    
    var body: some View {
        NavigationView {
            List {
                // Profile Section
                Section {
                    if let user = authManager.currentUser {
                        HStack {
                            // Profile picture
                            if let pictureURL = user.profile?.picture,
                               let url = URL(string: pictureURL) {
                                AsyncImage(url: url) { image in
                                    image
                                        .resizable()
                                        .aspectRatio(contentMode: .fill)
                                        .frame(width: 60, height: 60)
                                        .clipShape(Circle())
                                } placeholder: {
                                    Circle()
                                        .fill(Color.gray.opacity(0.2))
                                        .frame(width: 60, height: 60)
                                        .overlay(ProgressView())
                                }
                            } else {
                                Circle()
                                    .fill(Color.blue.opacity(0.2))
                                    .frame(width: 60, height: 60)
                                    .overlay(
                                        Image(systemName: "person.fill")
                                            .font(.title)
                                            .foregroundColor(.blue)
                                    )
                            }
                            
                            VStack(alignment: .leading, spacing: 4) {
                                Text(user.profile?.name ?? "Anonymous")
                                    .font(.headline)
                                
                                Text(user.publicKey.npub)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                    .lineLimit(1)
                                    .truncationMode(.middle)
                            }
                            
                            Spacer()
                            
                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        .contentShape(Rectangle())
                        .onTapGesture {
                            showingProfile = true
                        }
                    }
                }
                
                // Connection Section
                Section(header: Text("Connections")) {
                    // Nostr Relays
                    HStack {
                        Label("Nostr Relays", systemImage: "network")
                        Spacer()
                        Text("\(ndkManager.ndk.pool.relays.count) active")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .contentShape(Rectangle())
                    .onTapGesture {
                        showingRelays = true
                    }
                    
                    // Backend Status
                    HStack {
                        Label("Backend Server", systemImage: "server.rack")
                        Spacer()
                        Circle()
                            .fill(Color(backendManager.statusColor))
                            .frame(width: 8, height: 8)
                        Text(backendManager.statusText)
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .contentShape(Rectangle())
                    .onTapGesture {
                        showingBackend = true
                    }
                }
                
                // App Section
                Section(header: Text("App")) {
                    HStack {
                        Label("About TENEX", systemImage: "info.circle")
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .contentShape(Rectangle())
                    .onTapGesture {
                        showingAbout = true
                    }
                    
                    HStack {
                        Label("Privacy Policy", systemImage: "hand.raised")
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    HStack {
                        Label("Terms of Service", systemImage: "doc.text")
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                
                // Account Section
                Section {
                    Button(action: { authManager.logout() }) {
                        Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                            .foregroundColor(.red)
                    }
                }
            }
            .navigationTitle("Settings")
            .sheet(isPresented: $showingProfile) {
                ProfileEditView()
            }
            .sheet(isPresented: $showingRelays) {
                RelaySettingsView()
            }
            .sheet(isPresented: $showingBackend) {
                BackendSettingsView()
            }
            .sheet(isPresented: $showingAbout) {
                AboutView()
            }
        }
    }
}