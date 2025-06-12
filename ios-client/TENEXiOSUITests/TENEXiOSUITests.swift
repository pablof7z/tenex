import XCTest

final class TENEXiOSUITests: XCTestCase {
    
    var app: XCUIApplication!
    
    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
    }
    
    override func tearDownWithError() throws {
        app = nil
    }
    
    func testLoginFlow() throws {
        // Test login screen appears
        XCTAssertTrue(app.staticTexts["TENEX iOS"].exists)
        XCTAssertTrue(app.staticTexts["Context-first development environment"].exists)
        
        // Test login button is disabled when nsec is empty
        let loginButton = app.buttons["Login"]
        XCTAssertFalse(loginButton.isEnabled)
        
        // Test generate new account button exists
        let generateButton = app.buttons["Generate New Account"]
        XCTAssertTrue(generateButton.exists)
        XCTAssertTrue(generateButton.isEnabled)
    }
    
    func testGenerateNewAccount() throws {
        let generateButton = app.buttons["Generate New Account"]
        generateButton.tap()
        
        // Wait for navigation to main app
        let projectsTab = app.tabBars.buttons["Projects"]
        XCTAssertTrue(projectsTab.waitForExistence(timeout: 5))
    }
    
    func testTabNavigation() throws {
        // First generate an account to access the main app
        app.buttons["Generate New Account"].tap()
        
        // Wait for main app to load
        let tabBar = app.tabBars.firstMatch
        XCTAssertTrue(tabBar.waitForExistence(timeout: 5))
        
        // Test all tabs exist
        XCTAssertTrue(app.tabBars.buttons["Projects"].exists)
        XCTAssertTrue(app.tabBars.buttons["Chats"].exists)
        XCTAssertTrue(app.tabBars.buttons["Agents"].exists)
        XCTAssertTrue(app.tabBars.buttons["Instructions"].exists)
        XCTAssertTrue(app.tabBars.buttons["Settings"].exists)
        
        // Test tab navigation
        app.tabBars.buttons["Chats"].tap()
        XCTAssertTrue(app.navigationBars["Chats"].exists)
        
        app.tabBars.buttons["Agents"].tap()
        XCTAssertTrue(app.navigationBars["Agents"].exists)
        
        app.tabBars.buttons["Instructions"].tap()
        XCTAssertTrue(app.navigationBars["Instructions"].exists)
        
        app.tabBars.buttons["Settings"].tap()
        XCTAssertTrue(app.navigationBars["Settings"].exists)
        
        app.tabBars.buttons["Projects"].tap()
        XCTAssertTrue(app.navigationBars["Projects"].exists)
    }
    
    func testCreateProjectFlow() throws {
        // Generate account and navigate to projects
        app.buttons["Generate New Account"].tap()
        
        // Wait for Projects view
        XCTAssertTrue(app.navigationBars["Projects"].waitForExistence(timeout: 5))
        
        // Tap create project button
        app.navigationBars["Projects"].buttons["plus"].tap()
        
        // Verify create project sheet appears
        XCTAssertTrue(app.navigationBars["Create Project"].waitForExistence(timeout: 2))
        
        // Test cancel button
        app.buttons["Cancel"].tap()
        XCTAssertTrue(app.navigationBars["Projects"].waitForExistence(timeout: 2))
    }
    
    func testSettingsSignOut() throws {
        // Generate account
        app.buttons["Generate New Account"].tap()
        
        // Navigate to Settings
        app.tabBars.buttons["Settings"].tap()
        XCTAssertTrue(app.navigationBars["Settings"].waitForExistence(timeout: 5))
        
        // Scroll to Sign Out button
        app.tables.firstMatch.swipeUp()
        
        // Tap Sign Out
        let signOutButton = app.tables.cells.staticTexts["Sign Out"]
        if signOutButton.exists {
            signOutButton.tap()
            
            // Verify we're back at login
            XCTAssertTrue(app.staticTexts["TENEX iOS"].waitForExistence(timeout: 5))
        }
    }
    
    func testEmptyStates() throws {
        // Generate account
        app.buttons["Generate New Account"].tap()
        
        // Test Projects empty state
        XCTAssertTrue(app.staticTexts["No Projects Yet"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Create your first project to get started"].exists)
        
        // Test Chats empty state
        app.tabBars.buttons["Chats"].tap()
        XCTAssertTrue(app.staticTexts["No Chats Yet"].exists)
        
        // Test Agents empty state
        app.tabBars.buttons["Agents"].tap()
        XCTAssertTrue(app.staticTexts["No Agents Available"].exists)
        
        // Test Instructions empty state
        app.tabBars.buttons["Instructions"].tap()
        XCTAssertTrue(app.staticTexts["No Instructions Yet"].exists)
    }
}

// MARK: - Launch Performance Tests

final class TENEXiOSUITestsLaunchPerformance: XCTestCase {
    
    func testLaunchPerformance() throws {
        if #available(iOS 13.0, *) {
            measure(metrics: [XCTApplicationLaunchMetric()]) {
                XCUIApplication().launch()
            }
        }
    }
}