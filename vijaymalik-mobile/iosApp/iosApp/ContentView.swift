import SwiftUI

struct ContentView: View {
    @State private var selectedTab = 0
    
    var body: some View {
        TabView(selection: $selectedTab) {
            HomeView()
                .tabItem {
                    Label("Home", systemImage: selectedTab == 0 ? "house.fill" : "house")
                }
                .tag(0)
            
            MarketsView()
                .tabItem {
                    Label("Markets", systemImage: selectedTab == 1 ? "chart.line.uptrend.xyaxis" : "chart.line.uptrend.xyaxis")
                }
                .tag(1)
            
            AlertsView()
                .tabItem {
                    Label("Alerts", systemImage: selectedTab == 2 ? "bell.fill" : "bell")
                }
                .tag(2)
            
            LearnView()
                .tabItem {
                    Label("Learn", systemImage: selectedTab == 3 ? "book.fill" : "book")
                }
                .tag(3)
            
            ProfileView()
                .tabItem {
                    Label("Profile", systemImage: selectedTab == 4 ? "person.fill" : "person")
                }
                .tag(4)
        }
        .tint(VMColors.accent)
    }
}

#Preview {
    ContentView()
}
