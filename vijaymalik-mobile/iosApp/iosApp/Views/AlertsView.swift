import SwiftUI

struct AlertsView: View {
    var body: some View {
        NavigationStack {
            VStack {
                Text("🔔 Alerts")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                
                Text("Coming soon...")
                    .font(.body)
                    .foregroundColor(VMColors.textSecondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(VMColors.backgroundLight)
            .navigationTitle("Alerts")
        }
    }
}

#Preview {
    AlertsView()
}
