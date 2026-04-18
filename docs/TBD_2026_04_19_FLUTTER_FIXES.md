# TBD — Flutter Bugs & Feature Gaps (Tomorrow's Session)
**Created:** 2026-04-19 00:15 IST
**Scope:** Known issues to fix + deferred features, for the next dev session

---

## 🔴 CRITICAL BUG — Type Cast Errors (`int is not a subtype of String`)

### Symptom
Opening Fund Detail screen throws:
> `int is not a subtype of String in type cast`

Screen either crashes or shows red error card.

### Root Cause
**API contract drift after MFD-002 data enrichment.**

On **2026-04-18**, we ingested mfdata.in scheme metadata → `funds` table `min_sip`, `min_investment`, `min_lumpsum` columns populated with **NUMERIC** values (e.g. `1000.0`).

Flutter model at [`lib/shared/models/fund.dart:69`](vmfs_flutter/lib/shared/models/fund.dart#L69) declares:
```dart
final String? minSip;
```

And deserializes at line 153:
```dart
minSip: fund['min_sip'] as String? ?? fund['minSip'] as String?,
```

Before 2026-04-18, `funds.min_sip` was always NULL → cast worked (null → null). After ingest, it's now `1000.0` → Flutter receives a JSON number → `as String?` **throws**.

### Known Fields Affected (verified from model + mfdata ingest)
| Field | Model type | DB type after ingest | Breaks? |
|-------|-----------|---------------------|---------|
| `min_sip` | `String?` | `NUMERIC` | ✅ YES |
| `min_investment` | `String?` *(suspected)* | `NUMERIC` | ✅ YES |
| `min_lumpsum` | not in model yet | `NUMERIC` | n/a |
| `expense_ratio` | `double?` *(likely)* | `NUMERIC` | probably OK |
| `exit_load` | `String?` | `TEXT` | OK (mfdata returns text) |
| `fund_size` | `double?` | `NUMERIC` | OK |

### Full Scope of Type-Cast Fragility (audit target for tomorrow)

These patterns in `fund.dart` are **all brittle** and must be hardened:

```dart
// BRITTLE — will crash if API returns a number
fund['any_field'] as String?

// ROBUST — survives type drift  
_toStr(fund['any_field'])
```

There are **57 `as String?` casts** in [`fund.dart`](vmfs_flutter/lib/shared/models/fund.dart) alone, plus more in other models:
- [`lib/shared/models/market_index.dart`](vmfs_flutter/lib/shared/models/market_index.dart)
- [`lib/shared/models/goal.dart`](vmfs_flutter/lib/shared/models/goal.dart)
- [`lib/shared/models/portfolio_summary.dart`](vmfs_flutter/lib/shared/models/portfolio_summary.dart)
- [`lib/shared/models/news_article.dart`](vmfs_flutter/lib/shared/models/news_article.dart)
- [`lib/shared/models/holding.dart`](vmfs_flutter/lib/shared/models/holding.dart)

### Fix Strategy
Add a `_toStr()` helper next to existing `_toInt()` in `fund.dart`:

```dart
String? _toStr(dynamic v) {
  if (v == null) return null;
  if (v is String) return v;
  if (v is num) return v.toString();  // handles int + double
  return v.toString();
}
```

Then global replace:
- `as String` → `_toStr(...)` (non-null versions)
- `as String?` → `_toStr(...)` (nullable versions)

**Scope estimate:** ~90 replacements across 6 model files. Can be done with a Python regex script similar to what we did for the typography weight bumps earlier today.

### Priority
**P0 — BLOCKS ALL FUND DETAIL SCREENS.** This is the single most visible bug in the app right now. Fix first thing tomorrow.

---

## 🔴 CRITICAL BUG — Direct/Regular Toggle Broken on Discover

### Symptom
User toggles between Direct and Regular plans on Discover screen. Results don't change — only Direct Growth funds show regardless of toggle state.

### Likely Causes (investigate in order)
1. **Backend ignoring `plan_type` filter param.** Check `/api/funds/search?plan_type=regular` actually returns regular funds.
2. **Flutter state not invalidating provider** — `_planTypeProvider` may not trigger `_searchResultsProvider` recomputation.
3. **Flutter query param name mismatch** — `planType` vs `plan_type` vs `plan` sent in query string.
4. **Default scope is Direct in our active funds filter** — `scheme_name LIKE '%Direct%'` might be hardcoded somewhere in backend.

### Files to inspect
- [`vmfs_flutter/lib/features/funds/discover_screen.dart`](vmfs_flutter/lib/features/funds/discover_screen.dart) — find `_planType` / toggle logic
- [`vmfs_flutter/lib/core/api/services/fund_service.dart`](vmfs_flutter/lib/core/api/services/fund_service.dart) — `search()` method
- [`vijaymalik-financial/src/app/api/funds/search/route.ts`](vijaymalik-financial/src/app/api/funds/search/route.ts) — SQL WHERE clause

### Priority
**P0 — core Discover feature broken.**

---

## 🟡 FEATURE GAP — Custom Filters on Discover

### Current State
Discover screen has:
- Search box (with 400ms debounce) ✅
- Category grid (8 hardcoded categories) ✅
- Direct/Regular toggle ❌ broken (see above)
- Results list (paginated, wrong pattern) ⚠️
- **NO filters beyond category** ❌

### Requested Filters (priority order)

| # | Filter | Data source | Notes |
|---|--------|-------------|-------|
| 1 | **Sort** | `return_1y DESC`, `return_3y DESC`, `return_5y DESC`, `fund_size DESC`, `expense_ratio ASC`, `rank_1y ASC` | Most requested — FDIS-001 in Jira |
| 2 | **AMC** | `DISTINCT amc_code FROM funds` | Dropdown with 51 AMCs |
| 3 | **Risk Label** | `risk_label` (mfdata field: Low / Moderate / Moderately High / High / Very High Risk) | After MFD-002 this is fill-rated |
| 4 | **AUM Range** | `fund_size` in Crores. Buckets: <100 / 100-500 / 500-2000 / 2000-10000 / >10000 | Slider or radio group |
| 5 | **Expense Ratio** | `expense_ratio` — slider 0.0 to 3.0% | Default: "below category avg" |
| 6 | **Morningstar Rating** | `morningstar_rating` 1-5⭐ | After MFD-002 this is fill-rated |
| 7 | **SEBI Category** | Already exists as grid — promote to filter chip |
| 8 | **Sub-Category** | e.g. "Large Cap", "Mid Cap", "Flexi Cap" | Dependent on Category |

### UI Pattern
**Recommendation:** Bottom-sheet modal filter (INDmoney / Kuvera pattern), NOT a filter bar cramped on main screen.

- Single "Filter" button near search (with active count badge: "Filter · 3")
- Tap → full-height bottom sheet with all filter controls
- Apply button at bottom; reset link at top-right
- Persist filter state across app launches (SharedPreferences)

### Related Jira Story
**FDIS-001** (4pt) in [`JIRA_BOARD_2026_04_18.md`](vijaymalik-financial/docs/JIRA_BOARD_2026_04_18.md) — already scoped. Ready to pick up.

### Priority
**P1 — Sprint 19 core work.** Not blocking anything today; but significantly improves Discover UX and closes gap vs INDmoney/Kuvera.

---

## 🟡 BUG — Navigation Animation Inconsistent Across Tabs

### Symptom
- **Home → Markets:** animation visible (bottom-up / scale-fade feel)
- **Markets → Goals / More / Discover:** either no visible animation OR too fast to perceive
- User perception: "only Home → Markets animates correctly"

### Likely Causes
1. **Different curves applied by platform defaults** when no explicit `pageBuilder` — but all 10 routes already use `_fadeThroughPage`, so this shouldn't be the cause.
2. **Content density difference** — Goals/Profile mount fast (lightweight widgets) so fade completes before user perceives it.
3. **Current 220ms duration too fast** — on fast-mount screens, the ScaleTransition 1.04→1.0 finishes in ~150ms and the FadeTransition becomes invisible.
4. **ShellRoute persistence** — tab switches don't unmount the Scaffold, so only the body child animates. On screens where the body loads instantly from cache, the transition appears to "skip."
5. **Secondary animation outgoing fade** — my current implementation has `ReverseAnimation(fadeOut).drive(...)` which may be misconfigured.

### Fix Strategy (tomorrow)
1. **Bump duration to 280-320ms** — all transitions visible regardless of mount speed
2. **Add explicit slide-up component** — 12-16px Y translation from below, combined with fade — gives the "bottom up" feel the user prefers
3. **Increase initial scale difference** — e.g. 1.06 → 1.0 instead of 1.04 → 1.0 (more visible)
4. **Test every tab combination** — verify uniform feel: Home↔Markets, Markets↔Discover, Discover↔Goals, Goals↔More, and all back-directions

### Reference Implementation (Tomorrow)

```dart
Page<void> _fadeThroughPage(Widget child, GoRouterState state) => CustomTransitionPage(
      key: state.pageKey,
      child: child,
      transitionDuration: const Duration(milliseconds: 300),
      reverseTransitionDuration: const Duration(milliseconds: 300),
      transitionsBuilder: (_, animation, __, child) {
        final fadeIn = CurvedAnimation(
          parent: animation,
          curve: const Interval(0.20, 1.0, curve: Curves.easeOutCubic),
        );
        final slideUp = Tween<Offset>(
          begin: const Offset(0, 0.04),  // 4% down
          end: Offset.zero,
        ).animate(CurvedAnimation(
          parent: animation,
          curve: Curves.easeOutQuart,  // stronger decel = more "bottom up" feel
        ));
        return FadeTransition(
          opacity: fadeIn,
          child: SlideTransition(position: slideUp, child: child),
        );
      },
    );
```

This combines:
- **Fade from 20%→100%** (skips the initial invisible bit, makes fade feel more "snap in")
- **Slide up from +4% Y → 0** (the "bottom up" feel user wants)
- **300ms duration** (slow enough to be perceived, fast enough to feel snappy)

### Priority
**P1** — quality issue, affects perceived polish. Not blocking features.

**Time estimate:** 30 min (tweak + test).

---

## Status Summary

| Bug/Gap | Priority | Estimated Effort | Blocks |
|---------|----------|------------------|--------|
| Type cast errors in Fund Detail | P0 | 1hr (regex + test) | **All fund detail screens** |
| Direct/Regular toggle | P0 | 1-2hr (debug + fix) | Discover usability |
| Discover filters | P1 | 4-6hr (sheet UI + query wiring) | FDIS-001 Sprint 19 |
| Nav animation inconsistent + too fast | P1 | 30min (curve + duration tweak) | UI polish |
