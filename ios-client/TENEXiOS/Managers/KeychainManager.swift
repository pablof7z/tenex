import Foundation
import Security

struct KeychainCredentials {
    let publicKey: String
    let privateKey: String
}

class KeychainManager {
    private let service = "com.tenex.ios"
    private let publicKeyAccount = "nostr_public_key"
    private let privateKeyAccount = "nostr_private_key"
    
    func store(privateKey: String, for publicKey: String) throws {
        // Store public key
        try store(value: publicKey, for: publicKeyAccount)
        
        // Store private key
        try store(value: privateKey, for: privateKeyAccount)
    }
    
    func loadStoredCredentials() -> KeychainCredentials? {
        guard let publicKey = load(for: publicKeyAccount),
              let privateKey = load(for: privateKeyAccount) else {
            return nil
        }
        
        return KeychainCredentials(publicKey: publicKey, privateKey: privateKey)
    }
    
    func deleteAll() {
        delete(for: publicKeyAccount)
        delete(for: privateKeyAccount)
    }
    
    private func store(value: String, for account: String) throws {
        let data = value.data(using: .utf8)!
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data
        ]
        
        // Delete any existing item
        SecItemDelete(query as CFDictionary)
        
        // Add new item
        let status = SecItemAdd(query as CFDictionary, nil)
        
        guard status == errSecSuccess else {
            throw KeychainError.unableToStore
        }
    }
    
    private func load(for account: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var dataTypeRef: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &dataTypeRef)
        
        guard status == errSecSuccess,
              let data = dataTypeRef as? Data,
              let value = String(data: data, encoding: .utf8) else {
            return nil
        }
        
        return value
    }
    
    private func delete(for account: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        
        SecItemDelete(query as CFDictionary)
    }
}

enum KeychainError: LocalizedError {
    case unableToStore
    case unableToLoad
    
    var errorDescription: String? {
        switch self {
        case .unableToStore:
            return "Unable to store credentials in keychain"
        case .unableToLoad:
            return "Unable to load credentials from keychain"
        }
    }
}