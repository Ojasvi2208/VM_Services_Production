import SwiftUI

/// VM Financial Design System - Colors
/// Theme: Charcoal + Teal (Apple-like minimalism)
struct VMColors {
    // Background
    static let backgroundLight = Color(hex: "FAFAFA")
    static let backgroundDark = Color(hex: "09090B")
    
    // Surface
    static let surfaceLight = Color.white
    static let surfaceDark = Color(hex: "18181B")
    
    // Primary (Charcoal)
    static let primary = Color(hex: "18181B")
    static let primaryLight = Color(hex: "27272A")
    
    // Accent (Teal)
    static let accent = Color(hex: "14B8A6")
    static let accentLight = Color(hex: "2DD4BF")
    static let accentDark = Color(hex: "0D9488")
    
    // Semantic Colors
    static let success = Color(hex: "22C55E")
    static let successLight = Color(hex: "4ADE80")
    static let warning = Color(hex: "F59E0B")
    static let warningLight = Color(hex: "FBBF24")
    static let error = Color(hex: "EF4444")
    static let errorLight = Color(hex: "F87171")
    
    // Text
    static let textPrimary = Color(hex: "27272A")
    static let textSecondary = Color(hex: "71717A")
    static let textTertiary = Color(hex: "A1A1AA")
    static let textOnDark = Color(hex: "FAFAFA")
    static let textOnAccent = Color.white
    
    // Market Colors
    static let marketUp = Color(hex: "22C55E")
    static let marketDown = Color(hex: "EF4444")
    static let marketNeutral = Color(hex: "71717A")
    
    // Borders
    static let borderLight = Color(hex: "E4E4E7")
    static let borderDark = Color(hex: "27272A")
}

// Color extension to support hex colors
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (1, 1, 1, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
