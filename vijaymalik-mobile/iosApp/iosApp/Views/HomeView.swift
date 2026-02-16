import SwiftUI

struct HomeView: View {
    @StateObject private var viewModel = HomeViewModel()
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    // Greeting Section
                    GreetingSection()
                    
                    // Markets Section
                    SectionHeader(title: "📊 Markets Today")
                    
                    if viewModel.isLoading {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                            .padding()
                    } else {
                        MarketIndicesRow(indices: viewModel.indianMarkets + viewModel.usMarkets)
                    }
                    
                    // Headlines Section
                    SectionHeader(title: "🔥 Headlines")
                    
                    ForEach(viewModel.headlines.prefix(4)) { headline in
                        HeadlineCard(headline: headline)
                    }
                    
                    // NFO Section
                    SectionHeader(title: "🆕 New Fund Offers")
                    NFORow(nfos: viewModel.nfos)
                    
                    // Top Funds Section
                    SectionHeader(title: "⭐ Top Performing Funds")
                    TopFundsTabs(
                        equityFunds: viewModel.topEquityFunds,
                        debtFunds: viewModel.topDebtFunds,
                        hybridFunds: viewModel.topHybridFunds
                    )
                    
                    // Sign In CTA
                    SignInCTA()
                }
                .padding(.bottom, 20)
            }
            .background(VMColors.backgroundLight)
            .navigationTitle("")
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(action: { /* TODO: Open menu */ }) {
                        Image(systemName: "line.3.horizontal")
                            .foregroundColor(VMColors.primary)
                    }
                }
                
                ToolbarItem(placement: .principal) {
                    Text("VM Financial")
                        .font(.headline)
                        .fontWeight(.semibold)
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { /* TODO: Open search */ }) {
                        Image(systemName: "magnifyingglass")
                            .foregroundColor(VMColors.primary)
                    }
                }
            }
        }
        .onAppear {
            viewModel.loadDailyBriefing()
        }
    }
}

// MARK: - Greeting Section
struct GreetingSection: View {
    var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 0..<12: return "Good Morning"
        case 12..<17: return "Good Afternoon"
        default: return "Good Evening"
        }
    }
    
    var today: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE, d MMM yyyy"
        return formatter.string(from: Date())
    }
    
    var body: some View {
        HStack {
            Text("\(greeting) ☀️")
                .font(.title)
                .fontWeight(.bold)
            
            Spacer()
            
            Text(today)
                .font(.subheadline)
                .foregroundColor(VMColors.textSecondary)
        }
        .padding(.horizontal)
        .padding(.top, 8)
    }
}

// MARK: - Section Header
struct SectionHeader: View {
    let title: String
    
    var body: some View {
        Text(title)
            .font(.title3)
            .fontWeight(.semibold)
            .padding(.horizontal)
    }
}

// MARK: - Market Indices Row
struct MarketIndicesRow: View {
    let indices: [MarketIndex]
    
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(indices) { index in
                    MarketIndexCard(index: index)
                }
            }
            .padding(.horizontal)
        }
    }
}

// MARK: - Market Index Card
struct MarketIndexCard: View {
    let index: MarketIndex
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 4) {
                Text(index.countryFlag)
                Text(index.symbol)
                    .font(.subheadline)
                    .fontWeight(.semibold)
            }
            
            Text(index.formattedValue)
                .font(.title2)
                .fontWeight(.bold)
            
            Text("\(index.formattedChange) (\(index.formattedChangePercent))")
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(index.isPositive ? VMColors.marketUp : VMColors.marketDown)
        }
        .padding(12)
        .frame(width: 160)
        .background(Color.white)
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 4, x: 0, y: 2)
    }
}

// MARK: - Headline Card
struct HeadlineCard: View {
    let headline: Headline
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if headline.isBreaking {
                Text("BREAKING")
                    .font(.caption2)
                    .fontWeight(.bold)
                    .foregroundColor(VMColors.error)
            }
            
            Text(headline.title)
                .font(.body)
                .fontWeight(.medium)
            
            HStack(spacing: 8) {
                Text(headline.source)
                    .font(.caption)
                    .foregroundColor(VMColors.textSecondary)
                
                Text("•")
                    .font(.caption)
                    .foregroundColor(VMColors.textSecondary)
                
                Text(headline.publishedAt)
                    .font(.caption)
                    .foregroundColor(VMColors.textSecondary)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white)
        .cornerRadius(12)
        .padding(.horizontal)
    }
}

// MARK: - NFO Row
struct NFORow: View {
    let nfos: [NFO]
    
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(nfos) { nfo in
                    NFOCard(nfo: nfo)
                }
            }
            .padding(.horizontal)
        }
    }
}

// MARK: - NFO Card
struct NFOCard: View {
    let nfo: NFO
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(nfo.schemeName)
                .font(.subheadline)
                .fontWeight(.semibold)
                .lineLimit(2)
            
            Text(nfo.fundHouse)
                .font(.caption)
                .foregroundColor(VMColors.textSecondary)
                .lineLimit(1)
            
            Spacer()
            
            Text(nfo.isOpen ? "Open Now" : "Closes: \(nfo.closeDate)")
                .font(.caption2)
                .fontWeight(.medium)
                .foregroundColor(nfo.isOpen ? VMColors.success : VMColors.warning)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(
                    (nfo.isOpen ? VMColors.success : VMColors.warning).opacity(0.1)
                )
                .cornerRadius(4)
        }
        .padding(12)
        .frame(width: 180, height: 120)
        .background(Color.white)
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 4, x: 0, y: 2)
    }
}

// MARK: - Top Funds Tabs
struct TopFundsTabs: View {
    let equityFunds: [MutualFund]
    let debtFunds: [MutualFund]
    let hybridFunds: [MutualFund]
    
    @State private var selectedTab = 0
    let tabs = ["Equity", "Debt", "Hybrid"]
    
    var body: some View {
        VStack(spacing: 12) {
            // Tab Selector
            HStack(spacing: 0) {
                ForEach(0..<tabs.count, id: \.self) { index in
                    Button(action: { selectedTab = index }) {
                        Text(tabs[index])
                            .font(.subheadline)
                            .fontWeight(selectedTab == index ? .semibold : .regular)
                            .foregroundColor(selectedTab == index ? VMColors.accent : VMColors.textSecondary)
                            .padding(.vertical, 8)
                            .frame(maxWidth: .infinity)
                    }
                    .overlay(
                        Rectangle()
                            .frame(height: 2)
                            .foregroundColor(selectedTab == index ? VMColors.accent : .clear),
                        alignment: .bottom
                    )
                }
            }
            .padding(.horizontal)
            
            // Fund List
            let funds: [MutualFund] = {
                switch selectedTab {
                case 0: return equityFunds
                case 1: return debtFunds
                default: return hybridFunds
                }
            }()
            
            VStack(spacing: 0) {
                ForEach(Array(funds.prefix(3).enumerated()), id: \.offset) { index, fund in
                    FundListItem(rank: index + 1, fund: fund)
                }
            }
            .padding(.horizontal)
        }
    }
}

// MARK: - Fund List Item
struct FundListItem: View {
    let rank: Int
    let fund: MutualFund
    
    var body: some View {
        HStack(spacing: 12) {
            Text("\(rank).")
                .font(.body)
                .fontWeight(.bold)
                .frame(width: 24)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(String(fund.schemeName.prefix(40)) + (fund.schemeName.count > 40 ? "..." : ""))
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .lineLimit(1)
                
                Text(fund.fundHouse)
                    .font(.caption)
                    .foregroundColor(VMColors.textSecondary)
            }
            
            Spacer()
            
            if let returns = fund.returns {
                Text(returns.formatReturn(returns.return1Y))
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor((returns.return1Y ?? 0) >= 0 ? VMColors.marketUp : VMColors.marketDown)
            }
        }
        .padding(.vertical, 12)
    }
}

// MARK: - Sign In CTA
struct SignInCTA: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("💼 Track your investments")
                .font(.title3)
                .fontWeight(.bold)
                .foregroundColor(.white)
            
            Text("Sign in to see your portfolio performance")
                .font(.subheadline)
                .foregroundColor(.white.opacity(0.8))
            
            Button(action: { /* TODO: Navigate to sign in */ }) {
                Text("Sign In →")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .background(VMColors.accent)
                    .cornerRadius(8)
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(VMColors.primary)
        .cornerRadius(16)
        .padding(.horizontal)
    }
}

#Preview {
    HomeView()
}
