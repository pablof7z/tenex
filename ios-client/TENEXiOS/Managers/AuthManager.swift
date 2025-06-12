import Foundation
import NDKSwift
import Combine

class AuthManager: ObservableObject {
    static let shared = AuthManager()
    
    @Published var isAuthenticated = false
    @Published var currentUser: NDKUser?
    @Published var signer: NDKPrivateKeySigner?
    
    private let keychain = KeychainManager()
    private var cancellables = Set<AnyCancellable>()
    
    private init() {
        loadStoredCredentials()
    }
    
    func login(with nsec: String) async throws {
        guard nsec.hasPrefix("nsec1") else {
            throw AuthError.invalidNsec
        }
        
        let signer = try NDKPrivateKeySigner(nsec: nsec)
        let pubkey = try await signer.pubkey
        let user = NDKUser(pubkey: pubkey)
        
        // Get private key hex from nsec
        let privateKeyHex = try Bech32.privateKey(from: nsec)
        
        // Store credentials
        try keychain.store(privateKey: privateKeyHex, for: pubkey)
        
        await MainActor.run {
            self.signer = signer
            self.currentUser = user
            self.isAuthenticated = true
        }
        
        // Fetch user profile
        await fetchUserProfile()
    }
    
    func loginWithPrivateKey(_ privateKeyHex: String) async throws {
        let signer = try NDKPrivateKeySigner(privateKey: privateKeyHex)
        let pubkey = try await signer.pubkey
        let user = NDKUser(pubkey: pubkey)
        
        // Store credentials
        try keychain.store(privateKey: privateKeyHex, for: pubkey)
        
        await MainActor.run {
            self.signer = signer
            self.currentUser = user
            self.isAuthenticated = true
        }
        
        // Fetch user profile
        await fetchUserProfile()
    }
    
    func generateNewAccount() async throws {
        let signer = try NDKPrivateKeySigner.generate()
        let pubkey = try await signer.pubkey
        let user = NDKUser(pubkey: pubkey)
        
        // Get private key (we need to store it)
        // For now, we'll generate a new one
        let privateKey = Crypto.generatePrivateKey()
        
        // Store credentials
        try keychain.store(privateKey: privateKey, for: pubkey)
        
        await MainActor.run {
            self.signer = signer
            self.currentUser = user
            self.isAuthenticated = true
        }
    }
    
    func logout() {
        keychain.deleteAll()
        signer = nil
        currentUser = nil
        isAuthenticated = false
    }
    
    private func loadStoredCredentials() {
        if let credentials = keychain.loadStoredCredentials() {
            Task {
                do {
                    try await loginWithPrivateKey(credentials.privateKey)
                } catch {
                    print("Failed to load stored credentials: \(error)")
                }
            }
        }
    }
    
    private func fetchUserProfile() async {
        guard let user = currentUser else { return }
        
        do {
            let filter = NDKFilter(authors: [user.pubkey], kinds: [0]) // Profile event
            let events = try await NDKManager.shared.ndk.fetchEvents(filter)
            
            if let profileEvent = events.first {
               let profileData = profileEvent.content.data(using: String.Encoding.utf8) ?? Data()
               if let profile = try? JSONDecoder().decode(NDKUserProfile.self, from: profileData) {
                    
                    await MainActor.run {
                        // Profile is read-only in NDKUser, we'll need to handle this differently
                        // For now, we can't set it directly
                    }
                }
            }
        } catch {
            print("Failed to fetch user profile: \(error)")
        }
    }
}

enum AuthError: LocalizedError {
    case invalidNsec
    case keychainError
    
    var errorDescription: String? {
        switch self {
        case .invalidNsec:
            return "Invalid nsec format. Please check your private key."
        case .keychainError:
            return "Failed to access keychain."
        }
    }
}