# VM Financial Mobile App

A Kotlin Multiplatform (KMP) mobile application for VM Financial Services.

## Architecture

```
vijaymalik-mobile/
├── shared/                    # Kotlin Multiplatform shared code
│   └── src/
│       ├── commonMain/        # Shared business logic
│       │   └── kotlin/
│       │       └── com/vmfinancial/shared/
│       │           ├── data/
│       │           │   ├── api/           # API clients
│       │           │   ├── models/        # Data models
│       │           │   └── repository/    # Repositories
│       │           └── design/            # Design system
│       ├── androidMain/       # Android-specific implementations
│       └── iosMain/           # iOS-specific implementations
├── androidApp/                # Android app (Jetpack Compose)
│   └── src/main/kotlin/
│       └── com/vmfinancial/android/
│           └── ui/
│               ├── theme/     # Material 3 theme
│               ├── navigation/
│               └── screens/
└── iosApp/                    # iOS app (SwiftUI)
    └── iosApp/
        ├── Views/
        ├── ViewModels/
        ├── Models/
        └── Theme/
```

## Design System

### Colors (Charcoal + Teal)
- **Primary**: #18181B (Charcoal)
- **Accent**: #14B8A6 (Teal)
- **Background**: #FAFAFA (Light) / #09090B (Dark)
- **Success**: #22C55E
- **Error**: #EF4444

### Typography
- Apple-like clean typography
- SF Pro (iOS) / Roboto (Android)

## Features

### Phase 1 (Current)
- [x] Project setup
- [x] Design system
- [x] Home screen with daily briefing
- [x] Market indices (real data via Yahoo Finance)
- [x] MF NAVs (real data via AMFI)
- [ ] News feed (RSS integration pending)

### Phase 2
- [ ] Fund discovery (Equity, Debt, Hybrid)
- [ ] NFO tracker
- [ ] Push notifications

### Phase 3
- [ ] User authentication
- [ ] Watchlist
- [ ] Portfolio tracking

### Phase 4
- [ ] CAS import
- [ ] Advanced analytics
- [ ] Premium features

## Data Sources

See [DATA_SOURCES.md](./DATA_SOURCES.md) for complete documentation.

| Data | Source | Status |
|------|--------|--------|
| Market Indices | Yahoo Finance | ✅ Real |
| MF NAVs | AMFI | ✅ Real |
| Fund Returns | - | ⚠️ Dummy |
| News | RSS Feeds | 🔄 Pending |

## Building

### Prerequisites
- JDK 17+
- Android Studio (for Android)
- Xcode 15+ (for iOS)
- Kotlin 2.0+
- Gradle 8.5+

### Android
```bash
cd vijaymalik-mobile
./gradlew :androidApp:assembleDebug
```

### iOS
1. Generate shared framework:
```bash
./gradlew :shared:linkDebugFrameworkIosSimulatorArm64
```

2. Open `iosApp/iosApp.xcodeproj` in Xcode
3. Build and run

## Backend

Uses existing Next.js API endpoints from `vijaymalik-financial`:
- Base URL: `https://vmfinancialservices.com/api`

---

*VM Financial Services - Your Daily Financial Companion*
