import SwiftUI
import NDKSwift

struct LoginView: View {
    @EnvironmentObject var authManager: AuthManager
    @State private var nsec = ""
    @State private var showingError = false
    @State private var errorMessage = ""
    @State private var isLoading = false
    
    var body: some View {
        NavigationView {
            VStack(spacing: 24) {
                Spacer()
                
                // Logo
                Image(systemName: "cube.transparent.fill")
                    .font(.system(size: 80))
                    .foregroundColor(.blue)
                
                Text("TENEX iOS")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                
                Text("Context-first development environment")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                
                Spacer()
                
                VStack(spacing: 16) {
                    // Login with nsec
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Private Key (nsec)")
                            .font(.headline)
                        
                        SecureField("nsec1...", text: $nsec)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .autocapitalization(.none)
                            .disableAutocorrection(true)
                    }
                    
                    Button(action: loginWithNsec) {
                        if isLoading {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        } else {
                            Text("Login")
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(10)
                    .disabled(nsec.isEmpty || isLoading)
                    
                    // Divider
                    HStack {
                        Rectangle()
                            .fill(Color.gray.opacity(0.3))
                            .frame(height: 1)
                        Text("OR")
                            .font(.caption)
                            .foregroundColor(.gray)
                        Rectangle()
                            .fill(Color.gray.opacity(0.3))
                            .frame(height: 1)
                    }
                    .padding(.vertical)
                    
                    // Generate new account
                    Button(action: generateNewAccount) {
                        Text("Generate New Account")
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.green)
                            .foregroundColor(.white)
                            .cornerRadius(10)
                    }
                    .disabled(isLoading)
                }
                .padding(.horizontal, 32)
                
                Spacer()
                Spacer()
            }
            .navigationBarHidden(true)
        }
        .alert("Error", isPresented: $showingError) {
            Button("OK", role: .cancel) { }
        } message: {
            Text(errorMessage)
        }
    }
    
    private func loginWithNsec() {
        isLoading = true
        
        Task {
            do {
                try await authManager.login(with: nsec)
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    showingError = true
                    isLoading = false
                }
            }
        }
    }
    
    private func generateNewAccount() {
        isLoading = true
        
        Task {
            do {
                try await authManager.generateNewAccount()
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    showingError = true
                    isLoading = false
                }
            }
        }
    }
}