import XCTest
@testable import TENEXiOS

final class TENEXiOSTests: XCTestCase {
    
    override func setUpWithError() throws {
        // Put setup code here. This method is called before the invocation of each test method in the class.
    }
    
    override func tearDownWithError() throws {
        // Put teardown code here. This method is called after the invocation of each test method in the class.
    }
    
    // MARK: - Model Tests
    
    func testProjectInitialization() throws {
        let project = Project(
            name: "Test Project",
            description: "A test project",
            slug: "test-project",
            repo: "https://github.com/test/repo",
            hashtags: ["swift", "ios"]
        )
        
        XCTAssertEqual(project.name, "Test Project")
        XCTAssertEqual(project.description, "A test project")
        XCTAssertEqual(project.slug, "test-project")
        XCTAssertEqual(project.repo, "https://github.com/test/repo")
        XCTAssertEqual(project.hashtags, ["swift", "ios"])
        XCTAssertNotNil(project.id)
        XCTAssertNotNil(project.created)
    }
    
    func testChatInitialization() throws {
        let chat = Chat(
            id: "123",
            title: "Test Chat",
            lastMessage: "Hello",
            timestamp: Date(),
            participants: ["user1", "user2"],
            unreadCount: 5
        )
        
        XCTAssertEqual(chat.id, "123")
        XCTAssertEqual(chat.title, "Test Chat")
        XCTAssertEqual(chat.lastMessage, "Hello")
        XCTAssertEqual(chat.participants, ["user1", "user2"])
        XCTAssertEqual(chat.unreadCount, 5)
    }
    
    // MARK: - Manager Tests
    
    func testNDKManagerSingleton() throws {
        let manager1 = NDKManager.shared
        let manager2 = NDKManager.shared
        
        XCTAssertTrue(manager1 === manager2, "NDKManager should be a singleton")
    }
    
    func testAuthManagerSingleton() throws {
        let manager1 = AuthManager.shared
        let manager2 = AuthManager.shared
        
        XCTAssertTrue(manager1 === manager2, "AuthManager should be a singleton")
    }
    
    func testProjectManagerSingleton() throws {
        let manager1 = ProjectManager.shared
        let manager2 = ProjectManager.shared
        
        XCTAssertTrue(manager1 === manager2, "ProjectManager should be a singleton")
    }
    
    func testBackendManagerSingleton() throws {
        let manager1 = BackendManager.shared
        let manager2 = BackendManager.shared
        
        XCTAssertTrue(manager1 === manager2, "BackendManager should be a singleton")
    }
    
    // MARK: - Backend Manager Tests
    
    func testBackendStatusText() throws {
        let manager = BackendManager.shared
        
        // Test different status states
        manager.status = .disconnected
        XCTAssertEqual(manager.statusText, "Disconnected")
        
        manager.status = .connecting
        XCTAssertEqual(manager.statusText, "Connecting...")
        
        manager.status = .connected(version: "1.0.0")
        XCTAssertEqual(manager.statusText, "Connected (v1.0.0)")
        
        manager.status = .error("Test error")
        XCTAssertEqual(manager.statusText, "Error: Test error")
    }
    
    func testBackendIsConnected() throws {
        let manager = BackendManager.shared
        
        manager.status = .disconnected
        XCTAssertFalse(manager.isConnected)
        
        manager.status = .connecting
        XCTAssertFalse(manager.isConnected)
        
        manager.status = .connected(version: "1.0.0")
        XCTAssertTrue(manager.isConnected)
        
        manager.status = .error("Test error")
        XCTAssertFalse(manager.isConnected)
    }
    
    // MARK: - Keychain Manager Tests
    
    func testKeychainStoreAndRetrieve() throws {
        let keychain = KeychainManager()
        let testPrivateKey = "test_private_key_123"
        let testPublicKey = "test_public_key_456"
        
        // Store credentials
        try keychain.store(privateKey: testPrivateKey, for: testPublicKey)
        
        // Retrieve credentials
        let credentials = keychain.loadStoredCredentials()
        
        XCTAssertNotNil(credentials)
        XCTAssertEqual(credentials?.privateKey, testPrivateKey)
        XCTAssertEqual(credentials?.publicKey, testPublicKey)
        
        // Clean up
        keychain.deleteAll()
        
        // Verify deletion
        XCTAssertNil(keychain.loadStoredCredentials())
    }
    
    // MARK: - Performance Tests
    
    func testProjectCreationPerformance() throws {
        self.measure {
            _ = (0..<100).map { i in
                Project(
                    name: "Project \(i)",
                    description: "Description \(i)",
                    slug: "project-\(i)",
                    repo: nil,
                    hashtags: []
                )
            }
        }
    }
}