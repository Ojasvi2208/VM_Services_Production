import SwiftUI

struct MarketsView: View {
    var body: some View {
        NavigationStack {
            VStack {
                Text("📊 Markets")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                
                Text("Coming soon...")
                    .font(.body)
                    .foregroundColor(VMColors.textSecondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(VMColors.backgroundLight)
            .navigationTitle("Markets")
        }
    }
}

#Preview {
    MarketsView()
}
