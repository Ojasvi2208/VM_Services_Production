package com.vmfinancial.android.ui.screens.funds

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.BookmarkBorder
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import com.vmfinancial.android.MainActivity
import com.vmfinancial.android.services.FundDetailCache
import com.vmfinancial.android.ui.theme.NumberFontFamily
import com.vmfinancial.android.ui.theme.VMColors
import com.vmfinancial.shared.data.api.BackendApi
import com.vmfinancial.shared.data.models.FundDetailResponse
import com.vmfinancial.shared.data.models.NavPoint
import kotlinx.coroutines.launch

// ════════════════════════════════════════════════════════════════════
//  FUND DETAIL SCREEN — Premium Minimalist Design
// ════════════════════════════════════════════════════════════════════

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FundDetailScreen(
    schemeCode: String,
    fundName: String,
    onBack: () -> Unit,
    onNavigateToAuth: () -> Unit = {}
) {
    val context = LocalContext.current
    val authService = (context as? MainActivity)?.authService
    val token = authService?.authToken
    val isLoggedIn = authService?.isLoggedIn == true
    val api = remember { BackendApi() }
    val scope = rememberCoroutineScope()

    var fund by remember { mutableStateOf<FundDetailResponse?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var isRefreshing by remember { mutableStateOf(false) }
    var isStaleData by remember { mutableStateOf(false) }
    var cacheAgeMs by remember { mutableStateOf(0L) }
    var errorMsg by remember { mutableStateOf<String?>(null) }
    var isInWatchlist by remember { mutableStateOf(false) }
    var showAddHoldingDialog by remember { mutableStateOf(false) }

    // Variant state
    var activeSchemeCode by remember { mutableStateOf(schemeCode) }
    var selectedPlan by remember { mutableStateOf("Direct") }
    var selectedOption by remember { mutableStateOf("Growth") }
    var variants by remember { mutableStateOf<List<com.vmfinancial.shared.data.models.FundVariant>>(emptyList()) }
    var availablePlans by remember { mutableStateOf(listOf("Direct")) }
    var availableOptions by remember { mutableStateOf(listOf("Growth")) }

    // Stale-While-Revalidate: show cached data instantly, refresh in background
    LaunchedEffect(activeSchemeCode) {
        // Step 1: Try fresh cache first
        val cached = FundDetailCache.get(activeSchemeCode)
        if (cached != null) {
            fund = cached
            isLoading = false
            isStaleData = false
        } else {
            // Step 2: Try stale cache (show old data immediately while refreshing)
            val stale = FundDetailCache.getAny(activeSchemeCode)
            if (stale != null) {
                fund = stale.first
                cacheAgeMs = stale.second
                isStaleData = true
                isLoading = false
                isRefreshing = true
            } else {
                isLoading = true
            }
        }

        // Step 3: Always fetch fresh data in background
        try {
            val fresh = api.getFundDetails(activeSchemeCode)
            fund = fresh
            errorMsg = null
            isStaleData = false
            isRefreshing = false
            FundDetailCache.put(activeSchemeCode, fresh)

            // Parse variants on first load only
            if (fresh.variants.isNotEmpty() && variants.isEmpty()) {
                variants = fresh.variants
                val plans = fresh.variants.map { it.planType }.distinct().sorted()
                val options = fresh.variants.map { it.optionType }.distinct().sorted()
                if (plans.isNotEmpty()) availablePlans = plans
                if (options.isNotEmpty()) availableOptions = options
                val currentName = fresh.schemeName
                selectedPlan = if (currentName.contains("Direct", true)) "Direct" else "Regular"
                selectedOption = if (currentName.contains("IDCW", true) || currentName.contains("Dividend", true)) "IDCW" else "Growth"
            }

            if (token != null) {
                try {
                    val wl = api.getWatchlist(token)
                    isInWatchlist = wl.watchlist.any { it.schemeCode == activeSchemeCode }
                } catch (_: Exception) {}
            }
        } catch (e: Exception) {
            // If we have stale data, keep showing it — just mark the error
            if (fund == null) errorMsg = e.message
            isRefreshing = false
            println("FundDetail: Error loading $activeSchemeCode: ${e.message}")
        }
        isLoading = false
    }

    // "Teal Flow" — subtle surface tint when viewing Direct plan
    val isDirect = selectedPlan.equals("Direct", ignoreCase = true)
    val scaffoldBg by animateColorAsState(
        targetValue = if (isDirect)
            VMColors.Accent.copy(alpha = 0.03f)
        else
            MaterialTheme.colorScheme.background,
        animationSpec = tween(350),
        label = "tealFlow"
    )

    Scaffold(
        containerColor = scaffoldBg,
        topBar = {
            TopAppBar(
                title = {
                    // Stale/Refreshing indicator
                    if (isRefreshing || isStaleData) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            if (isRefreshing) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(14.dp),
                                    strokeWidth = 1.5.dp,
                                    color = VMColors.Accent
                                )
                            }
                            val ageText = when {
                                cacheAgeMs < 60_000 -> "< 1 min ago"
                                cacheAgeMs < 3_600_000 -> "${cacheAgeMs / 60_000} min ago"
                                else -> "${cacheAgeMs / 3_600_000}h ago"
                            }
                            Surface(
                                shape = RoundedCornerShape(6.dp),
                                color = VMColors.Warning.copy(alpha = 0.15f)
                            ) {
                                Text(
                                    if (isRefreshing) "Updating…" else "Cached · $ageText",
                                    fontSize = 10.sp, fontWeight = FontWeight.Medium,
                                    color = VMColors.Warning,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                )
                            }
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = {
                        if (isLoggedIn) {
                            scope.launch {
                                try {
                                    if (isInWatchlist) {
                                        api.removeFromWatchlist(token!!, activeSchemeCode)
                                        isInWatchlist = false
                                    } else {
                                        api.addToWatchlist(token!!, activeSchemeCode)
                                        isInWatchlist = true
                                    }
                                } catch (_: Exception) {}
                            }
                        } else {
                            onNavigateToAuth()
                        }
                    }) {
                        Icon(
                            if (isInWatchlist) Icons.Filled.Bookmark else Icons.Outlined.BookmarkBorder,
                            contentDescription = "Watchlist",
                            tint = if (isInWatchlist) VMColors.Accent else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent)
            )
        }
    ) { padding ->
        if (isLoading && fund == null) {
            ShimmerLoading(Modifier.padding(padding))
        } else if (fund != null) {
            val f = fund!!
            var selectedRange by remember { mutableIntStateOf(4) } // default 1Y
            val rangeLabels = listOf("1W", "1M", "3M", "6M", "1Y", "3Y", "5Y", "ALL")
            val rangeDays = listOf(5, 22, 66, 132, 252, 756, 1260, f.navHistory.size)

            // Compute dynamic return from NAV history for selected range
            val dynamicReturn = remember(selectedRange, f.navHistory) {
                computeReturnFromNav(f.navHistory, rangeDays[selectedRange])
            }
            val dynamicLabel = rangeLabels[selectedRange]

            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding),
                contentPadding = PaddingValues(bottom = 100.dp)
            ) {
                // ── Hero Section ──
                item { HeroSection(f, dynamicReturn, dynamicLabel, f.navHistory) }

                // ── Variant Selector (Direct/Regular + Growth/IDCW) ──
                if (availablePlans.size > 1 || availableOptions.size > 1) {
                    item {
                        VariantSelector(
                            availablePlans = availablePlans,
                            availableOptions = availableOptions,
                            selectedPlan = selectedPlan,
                            selectedOption = selectedOption,
                            onPlanChange = { plan ->
                                selectedPlan = plan
                                val match = variants.firstOrNull { it.planType == plan && it.optionType == selectedOption }
                                if (match != null && match.schemeCode != activeSchemeCode) {
                                    activeSchemeCode = match.schemeCode
                                }
                            },
                            onOptionChange = { option ->
                                selectedOption = option
                                val match = variants.firstOrNull { it.planType == selectedPlan && it.optionType == option }
                                if (match != null && match.schemeCode != activeSchemeCode) {
                                    activeSchemeCode = match.schemeCode
                                }
                            }
                        )
                    }
                }

                // ── NAV Chart ──
                if (f.navHistory.isNotEmpty()) {
                    item {
                        ChartSection(
                            history = f.navHistory,
                            selectedRange = selectedRange,
                            rangeLabels = rangeLabels,
                            rangeDays = rangeDays,
                            onRangeChange = { selectedRange = it }
                        )
                    }
                }

                // ── Performance Grid ──
                item { StaggeredEntry(delay = 0) { PerformanceSection(f) } }

                // ── Rolling Returns ──
                item { StaggeredEntry(delay = 80) { RollingReturnsSection(f) } }

                // ── Risk Dashboard ──
                item { StaggeredEntry(delay = 160) { RiskSection(f) } }

                // ── Fund Snapshot ──
                item { StaggeredEntry(delay = 240) { SnapshotSection(f) } }
            }

            // ── Sticky Bottom CTA ──
            Box(modifier = Modifier.fillMaxSize().padding(padding)) {
                BottomCTA(
                    isLoggedIn = isLoggedIn,
                    isInWatchlist = isInWatchlist,
                    onWatchlist = {
                        if (isLoggedIn) {
                            scope.launch {
                                try {
                                    if (isInWatchlist) {
                                        api.removeFromWatchlist(token!!, activeSchemeCode)
                                        isInWatchlist = false
                                    } else {
                                        api.addToWatchlist(token!!, activeSchemeCode)
                                        isInWatchlist = true
                                    }
                                } catch (_: Exception) {}
                            }
                        } else {
                            onNavigateToAuth()
                        }
                    },
                    onAddHolding = {
                        if (isLoggedIn) showAddHoldingDialog = true
                        else onNavigateToAuth()
                    },
                    modifier = Modifier.align(Alignment.BottomCenter)
                )
            }
        } else {
            // Error state
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Unable to load fund", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(4.dp))
                    Text(
                        errorMsg ?: "Check your connection and try again",
                        fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )
                    Spacer(Modifier.height(16.dp))
                    OutlinedButton(onClick = onBack, shape = RoundedCornerShape(10.dp)) {
                        Text("Go Back")
                    }
                }
            }
        }
    }

    if (showAddHoldingDialog && token != null) {
        AddHoldingDialog(
            fundName = fundName,
            currentNav = fund?.nav ?: 0.0,
            onDismiss = { showAddHoldingDialog = false },
            onAdd = { units, nav, date ->
                scope.launch {
                    try { api.addHolding(token, activeSchemeCode, units, nav, date) } catch (_: Exception) {}
                    showAddHoldingDialog = false
                }
            }
        )
    }
}

// ════════════════════════════════════════════════════════════════════
//  VARIANT SELECTOR — Animated Segmented Toggle + Haptic Feedback
// ════════════════════════════════════════════════════════════════════

@Composable
private fun VariantSelector(
    availablePlans: List<String>,
    availableOptions: List<String>,
    selectedPlan: String,
    selectedOption: String,
    onPlanChange: (String) -> Unit,
    onOptionChange: (String) -> Unit
) {
    val haptic = LocalHapticFeedback.current
    val density = LocalDensity.current
    var optionExpanded by remember { mutableStateOf(false) }

    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Animated segmented toggle: Direct | Regular
        if (availablePlans.size > 1) {
            val selectedIdx = availablePlans.indexOf(selectedPlan).coerceAtLeast(0)
            var containerWidthPx by remember { mutableIntStateOf(0) }

            Surface(
                shape = RoundedCornerShape(12.dp),
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                modifier = Modifier.weight(1f)
            ) {
                Box(
                    modifier = Modifier
                        .padding(3.dp)
                        .onSizeChanged { containerWidthPx = it.width }
                ) {
                    // Sliding indicator
                    val segmentWidth = containerWidthPx.toFloat() / availablePlans.size
                    val indicatorOffset by animateFloatAsState(
                        targetValue = selectedIdx * segmentWidth,
                        animationSpec = spring(dampingRatio = 0.7f, stiffness = 400f),
                        label = "planIndicator"
                    )
                    val indicatorWidthDp = with(density) { segmentWidth.toDp() }
                    val indicatorOffsetDp = with(density) { indicatorOffset.toDp() }

                    // Animated indicator pill
                    val isDirect = selectedPlan.equals("Direct", ignoreCase = true)
                    val indicatorColor by animateColorAsState(
                        targetValue = if (isDirect) VMColors.Accent else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.85f),
                        animationSpec = tween(250),
                        label = "indicatorColor"
                    )

                    Box(
                        modifier = Modifier
                            .offset(x = indicatorOffsetDp)
                            .width(indicatorWidthDp)
                            .fillMaxHeight()
                            .clip(RoundedCornerShape(9.dp))
                            .background(indicatorColor)
                    )

                    // Text labels
                    Row {
                        availablePlans.forEach { plan ->
                            val isSelected = plan == selectedPlan
                            val textColor by animateColorAsState(
                                targetValue = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurfaceVariant,
                                animationSpec = tween(200),
                                label = "planTextColor"
                            )
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable {
                                        if (plan != selectedPlan) {
                                            haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                            onPlanChange(plan)
                                        }
                                    }
                                    .padding(vertical = 10.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    plan,
                                    fontSize = 13.sp,
                                    fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                                    color = textColor,
                                    textAlign = TextAlign.Center
                                )
                            }
                        }
                    }
                }
            }
        }

        // Outlined dropdown: Growth / IDCW (with haptic)
        if (availableOptions.size > 1) {
            Box {
                OutlinedButton(
                    onClick = {
                        haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        optionExpanded = true
                    },
                    shape = RoundedCornerShape(10.dp),
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp),
                    border = ButtonDefaults.outlinedButtonBorder
                ) {
                    Text(selectedOption, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                    Spacer(Modifier.width(4.dp))
                    Text("▾", fontSize = 12.sp)
                }
                DropdownMenu(
                    expanded = optionExpanded,
                    onDismissRequest = { optionExpanded = false }
                ) {
                    availableOptions.forEach { option ->
                        DropdownMenuItem(
                            text = {
                                Text(
                                    option,
                                    fontWeight = if (option == selectedOption) FontWeight.Bold else FontWeight.Normal,
                                    color = if (option == selectedOption) VMColors.Accent else MaterialTheme.colorScheme.onSurface
                                )
                            },
                            onClick = {
                                haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                onOptionChange(option)
                                optionExpanded = false
                            }
                        )
                    }
                }
            }
        }
    }
}

// ════════════════════════════════════════════════════════════════════
//  SHIMMER SKELETON
// ════════════════════════════════════════════════════════════════════

@Composable
private fun ShimmerLoading(modifier: Modifier = Modifier) {
    val shimmerAnim = rememberInfiniteTransition(label = "shimmer")
    val alpha by shimmerAnim.animateFloat(
        initialValue = 0.12f, targetValue = 0.04f,
        animationSpec = infiniteRepeatable(
            animation = tween(800, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ), label = "shimmerAlpha"
    )
    val shimmerColor = MaterialTheme.colorScheme.onSurface.copy(alpha = alpha)

    Column(modifier = modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        // Fund name placeholder
        Box(Modifier.fillMaxWidth(0.7f).height(20.dp).clip(RoundedCornerShape(6.dp)).background(shimmerColor))
        Box(Modifier.fillMaxWidth(0.4f).height(14.dp).clip(RoundedCornerShape(6.dp)).background(shimmerColor))
        Spacer(Modifier.height(4.dp))
        // NAV placeholder
        Box(Modifier.fillMaxWidth(0.45f).height(40.dp).clip(RoundedCornerShape(8.dp)).background(shimmerColor))
        Box(Modifier.fillMaxWidth(0.3f).height(12.dp).clip(RoundedCornerShape(6.dp)).background(shimmerColor))
        Spacer(Modifier.height(8.dp))
        // Chart placeholder
        Box(Modifier.fillMaxWidth().height(200.dp).clip(RoundedCornerShape(16.dp)).background(shimmerColor))
        Spacer(Modifier.height(8.dp))
        // Returns grid placeholder
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(Modifier.weight(1f).height(80.dp).clip(RoundedCornerShape(12.dp)).background(shimmerColor))
            Box(Modifier.weight(1f).height(80.dp).clip(RoundedCornerShape(12.dp)).background(shimmerColor))
            Box(Modifier.weight(1f).height(80.dp).clip(RoundedCornerShape(12.dp)).background(shimmerColor))
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(Modifier.weight(1f).height(80.dp).clip(RoundedCornerShape(12.dp)).background(shimmerColor))
            Box(Modifier.weight(1f).height(80.dp).clip(RoundedCornerShape(12.dp)).background(shimmerColor))
            Box(Modifier.weight(1f).height(80.dp).clip(RoundedCornerShape(12.dp)).background(shimmerColor))
        }
    }
}

// ════════════════════════════════════════════════════════════════════
//  HERO SECTION
// ════════════════════════════════════════════════════════════════════

@Composable
private fun HeroSection(f: FundDetailResponse, dynamicReturn: Double?, rangeLabel: String, navHistory: List<NavPoint> = emptyList()) {
    val fundHouse = if (f.fundHouse.isNotBlank()) f.fundHouse else extractFundHouse(f.schemeName)
    val cleanName = f.schemeName
        .replace("- Direct Plan", "").replace("Direct Plan", "")
        .replace("- Growth Option", "").replace("- Growth", "").replace("Growth", "")
        .replace("  ", " ").trim().removeSuffix("-").trim()

    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(top = 4.dp)) {
        // Fund house pill
        Surface(
            shape = RoundedCornerShape(6.dp),
            color = VMColors.Accent.copy(alpha = 0.1f)
        ) {
            Text(
                fundHouse, fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
                color = VMColors.Accent,
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
            )
        }
        Spacer(Modifier.height(8.dp))

        // Fund name
        Text(
            cleanName, fontSize = 18.sp, fontWeight = FontWeight.Bold,
            lineHeight = 22.sp, maxLines = 2, overflow = TextOverflow.Ellipsis
        )
        Spacer(Modifier.height(4.dp))

        // Category + Risk level row
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (f.category.isNotBlank()) {
                Text(f.category, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (f.riskLevel.isNotBlank()) {
                val riskColor = when {
                    f.riskLevel.contains("Low", true) -> VMColors.MarketUp
                    f.riskLevel.contains("High", true) || f.riskLevel.contains("Very", true) -> VMColors.MarketDown
                    else -> VMColors.Warning
                }
                Box(Modifier.size(6.dp).clip(CircleShape).background(riskColor))
                Text(f.riskLevel, fontSize = 12.sp, color = riskColor, fontWeight = FontWeight.Medium)
            }
        }

        Spacer(Modifier.height(16.dp))

        // Hero CAGR — "Compounding Score"
        val heroCagr = f.cagr3Y ?: f.cagr5Y
        val heroLabel = if (f.cagr3Y != null) "3Y CAGR" else if (f.cagr5Y != null) "5Y CAGR" else null
        if (heroCagr != null && heroLabel != null) {
            val isPos = heroCagr >= 0
            val heroColor = if (isPos) VMColors.MarketUp else VMColors.MarketDown
            Row(verticalAlignment = Alignment.Bottom) {
                Text(
                    String.format("%+.2f", heroCagr),
                    fontSize = 36.sp, fontWeight = FontWeight.Bold,
                    letterSpacing = (-1).sp, fontFamily = NumberFontFamily,
                    color = heroColor
                )
                Text(
                    "%",
                    fontSize = 20.sp, fontWeight = FontWeight.SemiBold,
                    color = heroColor.copy(alpha = 0.7f),
                    modifier = Modifier.padding(bottom = 4.dp)
                )
                Spacer(Modifier.width(8.dp))
                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = heroColor.copy(alpha = 0.1f)
                ) {
                    Text(
                        heroLabel, fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
                        color = heroColor,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                    )
                }
            }
            Spacer(Modifier.height(12.dp))
        }

        // Mini sparkline — last 90 days, animated left-to-right
        if (navHistory.size >= 5) {
            val sparkData = remember(navHistory) {
                navHistory.take(90).reversed().map { it.nav }
            }
            val animProgress = remember { Animatable(0f) }
            LaunchedEffect(sparkData) {
                animProgress.snapTo(0f)
                animProgress.animateTo(1f, tween(800, easing = FastOutSlowInEasing))
            }
            val isPositive = sparkData.last() >= sparkData.first()
            val sparkColor = if (isPositive) VMColors.MarketUp else VMColors.MarketDown

            Canvas(
                modifier = Modifier.fillMaxWidth().height(40.dp).clip(RoundedCornerShape(8.dp))
            ) {
                val w = size.width
                val h = size.height
                val minNav = sparkData.min()
                val maxNav = sparkData.max()
                val range = (maxNav - minNav).coerceAtLeast(0.01)
                val step = w / (sparkData.size - 1).coerceAtLeast(1)
                val visibleCount = (sparkData.size * animProgress.value).toInt().coerceAtLeast(2)
                val path = Path()
                val fillPath = Path()

                for (i in 0 until visibleCount) {
                    val x = i * step
                    val y = h - ((sparkData[i] - minNav) / range * h * 0.85f).toFloat() - h * 0.05f
                    if (i == 0) { path.moveTo(x, y); fillPath.moveTo(x, y) }
                    else { path.lineTo(x, y); fillPath.lineTo(x, y) }
                }

                // Gradient fill
                val lastX = (visibleCount - 1) * step
                fillPath.lineTo(lastX, h)
                fillPath.lineTo(0f, h)
                fillPath.close()
                drawPath(fillPath, Brush.verticalGradient(
                    listOf(sparkColor.copy(alpha = 0.15f), sparkColor.copy(alpha = 0.0f))
                ))

                // Stroke
                drawPath(path, sparkColor.copy(alpha = 0.6f), style = Stroke(width = 2f, cap = StrokeCap.Round))
            }
            Spacer(Modifier.height(12.dp))
        }

        // NAV display + dynamic return badge
        Row(verticalAlignment = Alignment.Bottom) {
            Column {
                Text("NAV", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, letterSpacing = 1.sp)
                Spacer(Modifier.height(2.dp))
                Row(verticalAlignment = Alignment.Bottom) {
                    Text("₹", fontSize = 16.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, fontWeight = FontWeight.Light)
                    Spacer(Modifier.width(2.dp))
                    Text(
                        f.nav?.let { String.format("%.4f", it) } ?: "—",
                        fontSize = 24.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.5).sp,
                        fontFamily = NumberFontFamily
                    )
                }
                f.navDate?.let {
                    val display = it.take(10)
                    Text("as of $display", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Spacer(Modifier.weight(1f))

            // Dynamic return badge (changes with chart time range)
            val displayReturn = dynamicReturn ?: f.return1Y
            displayReturn?.let { ret ->
                val isPos = ret >= 0
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = if (isPos) VMColors.MarketUp.copy(alpha = 0.1f) else VMColors.MarketDown.copy(alpha = 0.1f)
                ) {
                    Column(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            String.format("%+.2f%%", ret),
                            fontSize = 15.sp, fontWeight = FontWeight.Bold,
                            color = if (isPos) VMColors.MarketUp else VMColors.MarketDown,
                            fontFamily = NumberFontFamily
                        )
                        Text("$rangeLabel Return", fontSize = 10.sp, color = if (isPos) VMColors.MarketUp else VMColors.MarketDown)
                    }
                }
            }
        }
    }
}

// ════════════════════════════════════════════════════════════════════
//  CHART SECTION
// ════════════════════════════════════════════════════════════════════

@Composable
private fun ChartSection(
    history: List<NavPoint>,
    selectedRange: Int,
    rangeLabels: List<String>,
    rangeDays: List<Int>,
    onRangeChange: (Int) -> Unit
) {
    val haptic = LocalHapticFeedback.current
    val pointCount = rangeDays[selectedRange].coerceAtMost(history.size)
    val filteredHistory = history.take(pointCount).reversed()

    Column(modifier = Modifier.fillMaxWidth().padding(top = 20.dp)) {
        // Time range chips
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            rangeLabels.forEachIndexed { i, label ->
                val selected = i == selectedRange
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = if (selected) VMColors.Accent else Color.Transparent,
                    modifier = Modifier.clickable {
                        haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        onRangeChange(i)
                    }
                ) {
                    Text(
                        label, fontSize = 12.sp,
                        fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
                        color = if (selected) Color.White else MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                    )
                }
            }
        }

        Spacer(Modifier.height(12.dp))

        // Chart
        if (filteredHistory.size >= 2) {
            val navValues = filteredHistory.map { it.nav }
            val maxNav = navValues.max()
            val minNav = navValues.min()
            val isPositive = navValues.last() >= navValues.first()
            val chartColor = if (isPositive) VMColors.MarketUp else VMColors.MarketDown

            // Min/Max labels
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(String.format("L ₹%.2f", minNav), fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(String.format("H ₹%.2f", maxNav), fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            Canvas(
                modifier = Modifier.fillMaxWidth().height(180.dp).padding(horizontal = 20.dp, vertical = 4.dp)
            ) {
                val range = maxNav - minNav
                if (range <= 0) return@Canvas
                val stepX = size.width / (filteredHistory.size - 1)

                val path = Path().apply {
                    filteredHistory.forEachIndexed { i, point ->
                        val x = i * stepX
                        val y = ((1 - (point.nav - minNav) / range) * size.height).toFloat()
                        if (i == 0) moveTo(x, y) else lineTo(x, y)
                    }
                }
                drawPath(path, chartColor, style = Stroke(width = 2.5f))

                val fillPath = Path().apply {
                    addPath(path)
                    lineTo(size.width, size.height)
                    lineTo(0f, size.height)
                    close()
                }
                drawPath(fillPath, Brush.verticalGradient(listOf(chartColor.copy(alpha = 0.15f), Color.Transparent)))
            }
        }
    }
}

// ════════════════════════════════════════════════════════════════════
//  PERFORMANCE SECTION — Premium Unified Table
// ════════════════════════════════════════════════════════════════════

@Composable
private fun PerformanceSection(f: FundDetailResponse) {
    // Build unified data: period → (absolute, cagr)
    val periods = listOf("1W", "1M", "3M", "6M", "1Y", "3Y", "5Y", "7Y", "10Y")
    val absMap = mapOf(
        "1W" to f.return1W, "1M" to f.return1M, "3M" to f.return3M,
        "6M" to f.return6M, "1Y" to f.return1Y, "3Y" to f.return3Y,
        "5Y" to f.return5Y, "7Y" to f.return7Y, "10Y" to f.return10Y
    )
    val cagrMap = mapOf(
        "1Y" to f.cagr1Y, "3Y" to f.cagr3Y, "5Y" to f.cagr5Y,
        "7Y" to f.cagr7Y, "10Y" to f.cagr10Y
    )
    val rows = periods.filter { absMap[it] != null || cagrMap[it] != null }

    if (rows.isEmpty()) return

    val hasCagr = cagrMap.values.any { it != null }

    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(top = 24.dp)) {
        SectionLabel("Performance")
        Spacer(Modifier.height(10.dp))

        Surface(
            shape = RoundedCornerShape(16.dp),
            color = MaterialTheme.colorScheme.surface
        ) {
            Column(modifier = Modifier.padding(vertical = 4.dp)) {
                // Header row
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        "Period", fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.weight(1f)
                    )
                    Text(
                        "Absolute", fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.End,
                        modifier = Modifier.weight(1f)
                    )
                    if (hasCagr) {
                        Text(
                            "CAGR", fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.End,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
                HorizontalDivider(color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.06f))

                // Data rows
                rows.forEachIndexed { index, period ->
                    val absVal = absMap[period]
                    val cagrVal = cagrMap[period]

                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Period label with subtle background
                        Surface(
                            shape = RoundedCornerShape(6.dp),
                            color = VMColors.Accent.copy(alpha = 0.08f)
                        ) {
                            Text(
                                period, fontSize = 12.sp, fontWeight = FontWeight.SemiBold,
                                color = VMColors.Accent,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                            )
                        }
                        Spacer(Modifier.weight(1f))

                        // Absolute return
                        if (absVal != null) {
                            val absColor = if (absVal >= 0) VMColors.MarketUp else VMColors.MarketDown
                            Text(
                                String.format("%+.2f%%", absVal),
                                fontSize = 14.sp, fontWeight = FontWeight.Bold,
                                color = absColor, fontFamily = NumberFontFamily,
                                textAlign = TextAlign.End,
                                modifier = Modifier.weight(1f)
                            )
                        } else {
                            Text(
                                "—", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f),
                                textAlign = TextAlign.End, modifier = Modifier.weight(1f)
                            )
                        }

                        // CAGR
                        if (hasCagr) {
                            if (cagrVal != null) {
                                val cagrColor = if (cagrVal >= 0) VMColors.MarketUp else VMColors.MarketDown
                                Surface(
                                    shape = RoundedCornerShape(6.dp),
                                    color = cagrColor.copy(alpha = 0.1f),
                                    modifier = Modifier.weight(1f).wrapContentWidth(Alignment.End)
                                ) {
                                    Text(
                                        String.format("%+.2f%%", cagrVal),
                                        fontSize = 14.sp, fontWeight = FontWeight.Bold,
                                        color = cagrColor, fontFamily = NumberFontFamily,
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                    )
                                }
                            } else {
                                Text(
                                    "—", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f),
                                    textAlign = TextAlign.End, modifier = Modifier.weight(1f)
                                )
                            }
                        }
                    }

                    if (index < rows.size - 1) {
                        HorizontalDivider(
                            modifier = Modifier.padding(horizontal = 16.dp),
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.04f)
                        )
                    }
                }
            }
        }
    }
}

// ════════════════════════════════════════════════════════════════════
//  ROLLING RETURNS SECTION — Premium Min/Avg/Max Range Bars
// ════════════════════════════════════════════════════════════════════

@Composable
private fun RollingReturnsSection(f: FundDetailResponse) {
    val has1Y = f.rollingReturn1YAvg != null
    val has3Y = f.rollingReturn3YAvg != null
    if (!has1Y && !has3Y) return

    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(top = 24.dp)) {
        SectionLabel("Rolling Returns")
        Spacer(Modifier.height(4.dp))
        Text(
            "How consistent is this fund across different time windows?",
            fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.height(12.dp))

        Surface(
            shape = RoundedCornerShape(16.dp),
            color = MaterialTheme.colorScheme.surface
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                if (has1Y) {
                    RollingReturnCard(
                        title = "1-Year Rolling",
                        avg = f.rollingReturn1YAvg!!,
                        min = f.rollingReturn1YMin,
                        max = f.rollingReturn1YMax,
                        median = f.rollingReturn1YMedian
                    )
                }
                if (has1Y && has3Y) {
                    HorizontalDivider(
                        modifier = Modifier.padding(vertical = 14.dp),
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.05f)
                    )
                }
                if (has3Y) {
                    RollingReturnCard(
                        title = "3-Year Rolling (CAGR)",
                        avg = f.rollingReturn3YAvg!!,
                        min = f.rollingReturn3YMin,
                        max = f.rollingReturn3YMax,
                        median = f.rollingReturn3YMedian
                    )
                }
            }
        }
    }
}

@Composable
private fun RollingReturnCard(
    title: String,
    avg: Double,
    min: Double?,
    max: Double?,
    median: Double?
) {
    val avgColor = if (avg >= 0) VMColors.MarketUp else VMColors.MarketDown

    Column {
        // Title + Average hero
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(title, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface)
            Spacer(Modifier.weight(1f))
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = avgColor.copy(alpha = 0.1f)
            ) {
                Text(
                    String.format("Avg %+.1f%%", avg),
                    fontSize = 14.sp, fontWeight = FontWeight.Bold, color = avgColor,
                    fontFamily = NumberFontFamily,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 5.dp)
                )
            }
        }

        // Range bar visualization
        if (min != null && max != null) {
            Spacer(Modifier.height(14.dp))

            // Min — [=======●=======] — Max bar
            val range = max - min
            val avgPos = if (range > 0) ((avg - min) / range).toFloat().coerceIn(0f, 1f) else 0.5f
            @Suppress("UNUSED_VARIABLE")
            val medianPos = if (range > 0 && median != null) ((median - min) / range).toFloat().coerceIn(0f, 1f) else null

            // Labels row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                val minColor = if (min >= 0) VMColors.MarketUp else VMColors.MarketDown
                val maxColor = if (max >= 0) VMColors.MarketUp else VMColors.MarketDown
                Text(String.format("Min %+.1f%%", min), fontSize = 11.sp, fontWeight = FontWeight.Medium, color = minColor, fontFamily = NumberFontFamily)
                Text(String.format("Max %+.1f%%", max), fontSize = 11.sp, fontWeight = FontWeight.Medium, color = maxColor, fontFamily = NumberFontFamily)
            }
            Spacer(Modifier.height(6.dp))

            // Gradient range bar
            Box(
                modifier = Modifier.fillMaxWidth().height(10.dp).clip(RoundedCornerShape(5.dp))
            ) {
                // Background gradient: red → yellow → green
                Canvas(modifier = Modifier.fillMaxSize()) {
                    drawRoundRect(
                        brush = Brush.horizontalGradient(
                            listOf(
                                VMColors.MarketDown.copy(alpha = 0.3f),
                                Color(0xFFF59E0B).copy(alpha = 0.3f),
                                VMColors.MarketUp.copy(alpha = 0.3f)
                            )
                        ),
                        cornerRadius = androidx.compose.ui.geometry.CornerRadius(5f, 5f)
                    )
                }
                // Average position marker
                Box(
                    modifier = Modifier
                        .fillMaxHeight()
                        .fillMaxWidth(avgPos)
                        .wrapContentWidth(Alignment.End)
                ) {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .clip(RoundedCornerShape(5.dp))
                            .background(VMColors.Accent)
                            .align(Alignment.CenterEnd)
                    )
                }
            }

            // Median label
            if (median != null) {
                Spacer(Modifier.height(6.dp))
                val medColor = if (median >= 0) VMColors.MarketUp else VMColors.MarketDown
                Text(
                    String.format("Median %+.1f%%", median),
                    fontSize = 11.sp, color = medColor, fontFamily = NumberFontFamily,
                    modifier = Modifier.fillMaxWidth(),
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}

// ════════════════════════════════════════════════════════════════════
//  RISK SECTION — Visual Bars
// ════════════════════════════════════════════════════════════════════

@Composable
private fun RiskSection(f: FundDetailResponse) {
    val hasMetrics = listOf(f.volatility, f.sharpeRatio, f.sortinoRatio, f.maxDrawdown).any { it != null }
    if (!hasMetrics) return

    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(top = 24.dp)) {
        SectionLabel("Risk Analysis")
        Spacer(Modifier.height(12.dp))

        Surface(
            shape = RoundedCornerShape(16.dp),
            color = MaterialTheme.colorScheme.surface
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                f.volatility?.let {
                    RiskBar(
                        label = "Volatility", value = String.format("%.1f%%", it),
                        progress = (it / 40.0).toFloat().coerceIn(0f, 1f),
                        color = when { it < 12 -> VMColors.MarketUp; it < 22 -> VMColors.Warning; else -> VMColors.MarketDown },
                        interpretation = when { it < 12 -> "Low"; it < 22 -> "Moderate"; else -> "High" }
                    )
                }
                f.sharpeRatio?.let {
                    RiskBar(
                        label = "Sharpe Ratio", value = String.format("%.2f", it),
                        progress = ((it + 1) / 4.0).toFloat().coerceIn(0f, 1f),
                        color = when { it > 1.0 -> VMColors.MarketUp; it > 0.5 -> VMColors.Warning; else -> VMColors.MarketDown },
                        interpretation = when { it > 1.0 -> "Good"; it > 0.5 -> "Average"; else -> "Poor" }
                    )
                }
                f.sortinoRatio?.let {
                    RiskBar(
                        label = "Sortino Ratio", value = String.format("%.2f", it),
                        progress = ((it + 1) / 4.0).toFloat().coerceIn(0f, 1f),
                        color = when { it > 1.5 -> VMColors.MarketUp; it > 0.5 -> VMColors.Warning; else -> VMColors.MarketDown },
                        interpretation = when { it > 1.5 -> "Good"; it > 0.5 -> "Average"; else -> "Poor" }
                    )
                }
                f.maxDrawdown?.let {
                    val abs = kotlin.math.abs(it)
                    RiskBar(
                        label = "Max Drawdown", value = String.format("%.1f%%", it),
                        progress = (abs / 50.0).toFloat().coerceIn(0f, 1f),
                        color = when { abs < 10 -> VMColors.MarketUp; abs < 25 -> VMColors.Warning; else -> VMColors.MarketDown },
                        interpretation = when { abs < 10 -> "Low"; abs < 25 -> "Moderate"; else -> "Steep" }
                    )
                }
                f.rollingReturn1YAvg?.let {
                    RiskBar(
                        label = "Rolling 1Y Avg", value = String.format("%.1f%%", it),
                        progress = (it / 40.0).toFloat().coerceIn(0f, 1f),
                        color = when { it > 15 -> VMColors.MarketUp; it > 8 -> VMColors.Warning; else -> VMColors.MarketDown },
                        interpretation = when { it > 15 -> "Strong"; it > 8 -> "Steady"; else -> "Weak" }
                    )
                }
            }
        }
    }
}

@Composable
private fun RiskBar(label: String, value: String, progress: Float, color: Color, interpretation: String) {
    Column {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(label, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.weight(1f))
            Text(value, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, fontFamily = NumberFontFamily)
            Spacer(Modifier.width(6.dp))
            Surface(
                shape = RoundedCornerShape(4.dp),
                color = color.copy(alpha = 0.15f)
            ) {
                Text(
                    interpretation, fontSize = 10.sp, fontWeight = FontWeight.SemiBold,
                    color = color, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                )
            }
        }
        Spacer(Modifier.height(6.dp))
        Box(
            modifier = Modifier.fillMaxWidth().height(4.dp).clip(RoundedCornerShape(2.dp))
                .background(MaterialTheme.colorScheme.onSurface.copy(alpha = 0.06f))
        ) {
            Box(
                modifier = Modifier.fillMaxWidth(progress).fillMaxHeight().clip(RoundedCornerShape(2.dp))
                    .background(color)
            )
        }
    }
}

// ════════════════════════════════════════════════════════════════════
//  SNAPSHOT SECTION — Fund Info Grid
// ════════════════════════════════════════════════════════════════════

@Composable
private fun SnapshotSection(f: FundDetailResponse) {
    val items = buildList {
        if (f.fundHouse.isNotBlank()) add("Fund House" to f.fundHouse)
        if (f.category.isNotBlank()) add("Category" to f.category)
        if (f.subCategory.isNotBlank()) add("Sub Category" to f.subCategory)
        f.expenseRatio?.let { add("Expense Ratio" to "${String.format("%.2f", it)}%") }
        f.aum?.let { add("AUM" to "₹${String.format("%.0f", it)} Cr") }
        f.inceptionDate?.let { add("Inception" to it.take(10)) }
        add("Min Investment" to "₹${f.minInvestment}")
        add("Min SIP" to "₹${f.minSIP}")
        f.exitLoad?.let { add("Exit Load" to it) }
    }

    if (items.isEmpty()) return

    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(top = 24.dp)) {
        SectionLabel("Fund Snapshot")
        Spacer(Modifier.height(10.dp))

        Surface(
            shape = RoundedCornerShape(16.dp),
            color = MaterialTheme.colorScheme.surface
        ) {
            Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
                items.forEachIndexed { index, (label, value) ->
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(label, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
                        Text(value, fontSize = 13.sp, fontWeight = FontWeight.Medium, textAlign = TextAlign.End, modifier = Modifier.weight(1f))
                    }
                    if (index < items.size - 1) {
                        HorizontalDivider(color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.05f))
                    }
                }
            }
        }
    }
}

// ════════════════════════════════════════════════════════════════════
//  BOTTOM CTA
// ════════════════════════════════════════════════════════════════════

@Composable
private fun BottomCTA(
    isLoggedIn: Boolean, isInWatchlist: Boolean,
    onWatchlist: () -> Unit, onAddHolding: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shadowElevation = 8.dp,
        color = MaterialTheme.colorScheme.background
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (isLoggedIn) {
                OutlinedButton(
                    onClick = onWatchlist,
                    modifier = Modifier.weight(1f).height(48.dp),
                    shape = RoundedCornerShape(12.dp),
                    border = ButtonDefaults.outlinedButtonBorder
                ) {
                    Icon(
                        if (isInWatchlist) Icons.Filled.Bookmark else Icons.Outlined.BookmarkBorder,
                        contentDescription = null, modifier = Modifier.size(18.dp)
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(if (isInWatchlist) "Saved" else "Save", fontSize = 14.sp, fontWeight = FontWeight.Medium)
                }
                Button(
                    onClick = onAddHolding,
                    modifier = Modifier.weight(1.5f).height(48.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = VMColors.Accent),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Outlined.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Add to Portfolio", fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                }
            } else {
                OutlinedButton(
                    onClick = onWatchlist,
                    modifier = Modifier.weight(1f).height(48.dp),
                    shape = RoundedCornerShape(12.dp),
                    border = ButtonDefaults.outlinedButtonBorder
                ) {
                    Icon(Icons.Outlined.BookmarkBorder, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Save", fontSize = 14.sp, fontWeight = FontWeight.Medium)
                }
                Button(
                    onClick = onAddHolding,
                    modifier = Modifier.weight(1.5f).height(48.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = VMColors.Accent),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Sign In to Track", fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

// ════════════════════════════════════════════════════════════════════
//  ADD HOLDING DIALOG
// ════════════════════════════════════════════════════════════════════

@Composable
private fun AddHoldingDialog(
    fundName: String, currentNav: Double,
    onDismiss: () -> Unit, onAdd: (units: Double, nav: Double, date: String) -> Unit
) {
    var units by remember { mutableStateOf("") }
    var nav by remember { mutableStateOf(if (currentNav > 0) String.format("%.4f", currentNav) else "") }
    var date by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add to Portfolio", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(fundName, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2)
                OutlinedTextField(
                    value = units, onValueChange = { units = it },
                    label = { Text("Units") }, placeholder = { Text("e.g. 100.50") },
                    modifier = Modifier.fillMaxWidth(), singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    shape = RoundedCornerShape(10.dp)
                )
                OutlinedTextField(
                    value = nav, onValueChange = { nav = it },
                    label = { Text("Purchase NAV") }, placeholder = { Text("e.g. 45.6789") },
                    modifier = Modifier.fillMaxWidth(), singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    shape = RoundedCornerShape(10.dp)
                )
                OutlinedTextField(
                    value = date, onValueChange = { date = it },
                    label = { Text("Purchase Date") }, placeholder = { Text("YYYY-MM-DD") },
                    modifier = Modifier.fillMaxWidth(), singleLine = true,
                    shape = RoundedCornerShape(10.dp)
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val u = units.toDoubleOrNull() ?: return@Button
                    val n = nav.toDoubleOrNull() ?: return@Button
                    if (date.isBlank()) return@Button
                    onAdd(u, n, date)
                },
                enabled = units.toDoubleOrNull() != null && nav.toDoubleOrNull() != null && date.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = VMColors.Accent)
            ) { Text("Add") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}

// ════════════════════════════════════════════════════════════════════
//  STAGGERED ENTRY ANIMATION
// ════════════════════════════════════════════════════════════════════

@Composable
private fun StaggeredEntry(delay: Int = 0, content: @Composable () -> Unit) {
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        kotlinx.coroutines.delay(delay.toLong())
        visible = true
    }
    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(tween(300)) + slideInVertically(
            initialOffsetY = { it / 6 },
            animationSpec = tween(350, easing = FastOutSlowInEasing)
        )
    ) {
        content()
    }
}

// ════════════════════════════════════════════════════════════════════
//  UTILITIES
// ════════════════════════════════════════════════════════════════════

@Composable
private fun SectionLabel(text: String) {
    Text(
        text, fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        letterSpacing = 0.5.sp
    )
}

private fun computeReturnFromNav(history: List<NavPoint>, days: Int): Double? {
    if (history.size < 2) return null
    val count = days.coerceAtMost(history.size)
    val latestNav = history.first().nav
    val olderNav = history[count - 1].nav
    if (olderNav <= 0) return null
    return ((latestNav - olderNav) / olderNav) * 100.0
}

private fun extractFundHouse(name: String): String {
    val s = name.uppercase()
    return when {
        s.startsWith("ADITYA BIRLA") -> "Aditya Birla Sun Life"
        s.startsWith("ICICI PRUDENTIAL") || s.startsWith("ICICI PRUD") -> "ICICI Prudential"
        s.startsWith("NIPPON INDIA") -> "Nippon India"
        s.startsWith("FRANKLIN") -> "Franklin Templeton"
        s.startsWith("KOTAK") -> "Kotak Mahindra"
        s.startsWith("TATA ") -> "Tata"
        s.startsWith("HDFC ") -> "HDFC"
        s.startsWith("SBI ") -> "SBI"
        s.startsWith("AXIS ") -> "Axis"
        s.startsWith("UTI") -> "UTI"
        s.startsWith("DSP ") -> "DSP"
        s.startsWith("MIRAE ") -> "Mirae Asset"
        s.startsWith("SUNDARAM ") -> "Sundaram"
        s.startsWith("INVESCO ") -> "Invesco"
        s.startsWith("MOTILAL ") -> "Motilal Oswal"
        s.startsWith("QUANT ") -> "Quant"
        s.startsWith("CANARA ") -> "Canara Robeco"
        s.startsWith("BANDHAN ") -> "Bandhan"
        s.startsWith("BAJAJ ") -> "Bajaj Finserv"
        s.startsWith("EDELWEISS ") -> "Edelweiss"
        s.startsWith("UNION ") -> "Union"
        s.startsWith("MAHINDRA ") -> "Mahindra Manulife"
        s.startsWith("PPFAS") || s.startsWith("PARAG PARIKH") -> "PPFAS"
        s.startsWith("PGIM ") -> "PGIM India"
        s.startsWith("BARODA ") -> "Baroda BNP Paribas"
        s.startsWith("HSBC ") -> "HSBC"
        s.startsWith("ITI ") -> "ITI"
        else -> name.split(" ").first()
    }
}
