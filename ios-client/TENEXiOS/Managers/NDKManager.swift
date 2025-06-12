import Foundation
import NDKSwift
import Combine

class NDKManager: ObservableObject {
    static let shared = NDKManager()
    
    @Published var ndk: NDK
    @Published var isConnected = false
    @Published var connectionError: Error?
    
    private var cancellables = Set<AnyCancellable>()
    private let defaultRelays = [
        "wss://relay.damus.io",
        "wss://relay.nostr.band",
        "wss://nos.lol",
        "wss://relay.snort.social",
        "wss://relay.nostr.bg"
    ]
    
    private init() {
        self.ndk = NDK(relayUrls: defaultRelays)
    }
    
    func connect() {
        Task {
            do {
                try await ndk.connect()
                await MainActor.run {
                    self.isConnected = true
                    self.connectionError = nil
                }
            } catch {
                await MainActor.run {
                    self.isConnected = false
                    self.connectionError = error
                }
                print("Failed to connect to relays: \(error)")
            }
        }
    }
    
    func disconnect() {
        ndk.disconnect()
        isConnected = false
    }
    
    func addRelay(_ url: String) {
        ndk.addRelay(url)
    }
    
    func removeRelay(_ url: String) {
        ndk.removeRelay(url)
    }
}