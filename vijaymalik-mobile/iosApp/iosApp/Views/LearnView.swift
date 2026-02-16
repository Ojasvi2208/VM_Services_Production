import SwiftUI

struct LearnView: View {
    var body: some View {
        NavigationStack {
            VStack {
                Text("📚 Learn")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                
                Text("Coming soon...")
                    .font(.body)
                    .foregroundColor(VMColors.textSecondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(VMColors.backgroundLight)
            .navigationTitle("Learn")
        }
    }
}

#Preview {
    LearnView()
}
