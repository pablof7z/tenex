import Foundation
import Combine

enum BackendStatus {
    case disconnected
    case connecting
    case connected(version: String)
    case error(String)
}

class BackendManager: ObservableObject {
    static let shared = BackendManager()
    
    @Published var status: BackendStatus = .disconnected
    @Published var backendURL: String {
        didSet {
            UserDefaults.standard.set(backendURL, forKey: "backendURL")
            checkBackendStatus()
        }
    }
    
    private var timer: Timer?
    private var cancellables = Set<AnyCancellable>()
    
    private init() {
        self.backendURL = UserDefaults.standard.string(forKey: "backendURL") ?? "http://localhost:3000"
        startMonitoring()
    }
    
    func startMonitoring() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { _ in
            self.checkBackendStatus()
        }
        checkBackendStatus()
    }
    
    func stopMonitoring() {
        timer?.invalidate()
        timer = nil
    }
    
    func checkBackendStatus() {
        status = .connecting
        
        guard let url = URL(string: "\(backendURL)/api/health") else {
            status = .error("Invalid backend URL")
            return
        }
        
        URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    self?.status = .error(error.localizedDescription)
                    return
                }
                
                guard let httpResponse = response as? HTTPURLResponse,
                      httpResponse.statusCode == 200,
                      let data = data else {
                    self?.status = .disconnected
                    return
                }
                
                do {
                    if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                       let version = json["version"] as? String {
                        self?.status = .connected(version: version)
                    } else {
                        self?.status = .connected(version: "Unknown")
                    }
                } catch {
                    self?.status = .error("Invalid response format")
                }
            }
        }.resume()
    }
    
    var isConnected: Bool {
        if case .connected = status {
            return true
        }
        return false
    }
    
    var statusText: String {
        switch status {
        case .disconnected:
            return "Disconnected"
        case .connecting:
            return "Connecting..."
        case .connected(let version):
            return "Connected (v\(version))"
        case .error(let message):
            return "Error: \(message)"
        }
    }
    
    var statusColor: String {
        switch status {
        case .connected:
            return "green"
        case .connecting:
            return "yellow"
        case .disconnected, .error:
            return "red"
        }
    }
}