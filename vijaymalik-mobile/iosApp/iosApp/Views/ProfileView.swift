import SwiftUI

struct ProfileView: View {
    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Text("👤 Profile")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                
                Text("Sign in to access your portfolio")
                    .font(.body)
                    .foregroundColor(VMColors.textSecondary)
                
                Button(action: { /* TODO: Navigate to sign in */ }) {
                    Text("Sign In")
                        .font(.headline)
                        .foregroundColor(.white)
                        .padding(.horizontal, 40)
                        .padding(.vertical, 14)
                        .background(VMColors.accent)
                        .cornerRadius(10)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(VMColors.backgroundLight)
            .navigationTitle("Profile")
        }
    }
}

#Preview {
    ProfileView()
}
