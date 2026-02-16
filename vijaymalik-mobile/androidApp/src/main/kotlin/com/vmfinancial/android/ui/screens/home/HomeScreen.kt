package com.vmfinancial.android.ui.screens.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.sp
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.ComponentActivity
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.vmfinancial.android.MainActivity
import com.vmfinancial.android.services.AllFuelPrices
import com.vmfinancial.android.services.AuthUser
import com.vmfinancial.android.services.ShareCardService
import com.vmfinancial.android.services.WeatherData
import com.vmfinancial.android.ui.navigation.Screen
import com.vmfinancial.android.ui.components.*
import com.vmfinancial.android.ui.theme.VMColors
import com.vmfinancial.shared.data.models.*
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    navController: NavController,
    onMenuClick: () -> Unit = {},
    viewModel: HomeViewModel = viewModel(viewModelStoreOwner = androidx.compose.ui.platform.LocalContext.current as ComponentActivity)
) {
    val uiState by viewModel.uiState.collectAsState()
    val context2 = LocalContext.current
    val authService = (context2 as? MainActivity)?.authService
    val currentUser by authService?.currentUser?.collectAsState() ?: remember { mutableStateOf<AuthUser?>(null) }

    // Request location permission on first load for accurate weather + fuel prices
    val locationPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val granted = permissions.values.any { it }
        if (granted) {
            viewModel.onLocationPermissionGranted()
        }
    }

    LaunchedEffect(Unit) {
        locationPermissionLauncher.launch(
            arrayOf(
                android.Manifest.permission.ACCESS_FINE_LOCATION,
                android.Manifest.permission.ACCESS_COARSE_LOCATION
            )
        )
    }


    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("VijayMalik", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Text("Financial Services", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                },
                navigationIcon = {
                    if (currentUser != null) {
                        val initials = currentUser!!.fullName.split(" ").take(2)
                            .mapNotNull { it.firstOrNull()?.uppercase() }.joinToString("")
                        IconButton(onClick = onMenuClick) {
                            Box(
                                modifier = Modifier.size(32.dp)
                                    .clip(CircleShape)
                                    .background(VMColors.Accent.copy(alpha = 0.15f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(initials, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = VMColors.Accent)
                            }
                        }
                    } else {
                        IconButton(onClick = onMenuClick) {
                            Icon(Icons.Default.Menu, contentDescription = "Menu")
                        }
                    }
                },
                actions = {
                    IconButton(onClick = { navController.navigate("funds") { launchSingleTop = true } }) {
                        Icon(Icons.Default.Search, contentDescription = "Search", tint = VMColors.Accent)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(MaterialTheme.colorScheme.background),
            contentPadding = PaddingValues(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // ── Stale data refresh indicator ──
            if (uiState.isRefreshing) {
                item {
                    LinearProgressIndicator(
                        modifier = Modifier.fillMaxWidth().height(2.dp),
                        color = VMColors.Accent,
                        trackColor = VMColors.Accent.copy(alpha = 0.1f)
                    )
                }
            }

            // ── 1. Greeting + Weather ──
            item { GreetingSection(weather = uiState.weather) }

            // ── Gift Nifty (pre-market indicator) ──
            if (uiState.isLoading) {
                item { ShimmerGiftNiftyCard() }
            } else if (uiState.giftNifty != null) {
                item { GiftNiftyCard(data = uiState.giftNifty!!) }
            }

            // ── 2. Markets Today ──
            item { SectionHeader(title = "Markets Today", onClick = { navController.navigate(Screen.AllMarkets.route) }) }
            item {
                if (uiState.isLoading && uiState.indianMarkets.isEmpty()) {
                    ShimmerMarketIndicesRow()
                } else {
                    MarketIndicesRow(indices = uiState.indianMarkets, onIndexClick = { index ->
                        val encodedName = URLEncoder.encode(index.name, "UTF-8")
                        navController.navigate("index_detail/${index.symbol}/$encodedName")
                    })
                }
            }

            // ── 3. Headlines ──
            item { SectionHeader(title = "Headlines", onClick = { navController.navigate(Screen.AllHeadlines.route) }) }
            if (uiState.isLoading && uiState.headlines.isEmpty()) {
                item { ShimmerHeadlinesCard() }
            } else if (uiState.headlines.isNotEmpty()) {
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                    ) {
                        Column {
                            uiState.headlines.take(4).forEachIndexed { index, headline ->
                                HeadlineCard(headline = headline, onArticleClick = { url, title, source ->
                                    val encodedUrl = java.net.URLEncoder.encode(url, "UTF-8")
                                    val encodedTitle = java.net.URLEncoder.encode(title, "UTF-8")
                                    val encodedSource = java.net.URLEncoder.encode(source, "UTF-8")
                                    navController.navigate("article_viewer/$encodedUrl/$encodedTitle/$encodedSource")
                                })
                                if (index < minOf(3, uiState.headlines.size - 1)) {
                                    HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
                                }
                            }
                        }
                    }
                }
            }

            // ── 4. Upcoming Events ──
            if (uiState.isLoading && uiState.corporateActions.isEmpty()) {
                item { SectionHeader(title = "Upcoming Events") }
                item { ShimmerHorizontalRow(cardWidth = 180.dp, cardHeight = 100.dp) }
            } else if (uiState.corporateActions.isNotEmpty()) {
                item { SectionHeader(title = "Upcoming Events", onClick = { navController.navigate(Screen.AllEvents.route) }) }
                item { CorporateActionsRow(actions = uiState.corporateActions) }
            }

            // ── 5. Currency Rates ──
            if (uiState.isLoading && uiState.currencyRates.isEmpty()) {
                item { SectionHeader(title = "Currency Rates") }
                item { ShimmerHorizontalRow(cardWidth = 145.dp, cardHeight = 90.dp) }
            } else if (uiState.currencyRates.isNotEmpty()) {
                item { SectionHeader(title = "Currency Rates", onClick = { navController.navigate(Screen.AllCurrencies.route) }) }
                item { CurrencyRatesRow(rates = uiState.currencyRates) }
            }

            // ── 6. Commodities ──
            if (uiState.isLoading && uiState.commodities.isEmpty()) {
                item { SectionHeader(title = "Commodities") }
                item { ShimmerHorizontalRow(cardWidth = 145.dp, cardHeight = 90.dp) }
            } else if (uiState.commodities.isNotEmpty()) {
                item { SectionHeader(title = "Commodities", onClick = { navController.navigate(Screen.AllCommodities.route) }) }
                item { CommoditiesRow(commodities = uiState.commodities) }
            }

            // ── 7. Fuel Prices ──
            item { SectionHeader(title = "Fuel Prices", onClick = { navController.navigate(Screen.FuelPrices.route) }) }
            item {
                if (uiState.isLoading && uiState.fuelPrices == null) {
                    ShimmerFuelGrid()
                } else {
                    FuelPriceSection(fuelPrices = uiState.fuelPrices)
                }
            }

            // ── 8. Recently Launched Funds ──
            if (uiState.isLoading && uiState.nfos.isEmpty()) {
                item { SectionHeader(title = "Recently Launched Funds") }
                item { ShimmerHorizontalRow(cardWidth = 180.dp, cardHeight = 100.dp) }
            } else if (uiState.nfos.isNotEmpty()) {
                item { SectionHeader(title = "Recently Launched Funds", onClick = { navController.navigate(Screen.AllNFOs.route) }) }
                item { NFORow(nfos = uiState.nfos) }
            }

            // ── 9. Top Performing Funds ──
            if (uiState.isLoading && uiState.topFunds.isEmpty()) {
                item { SectionHeader(title = "Top Performing Funds") }
                item { ShimmerTopFundsList() }
            } else if (uiState.topFunds.isNotEmpty()) {
                item { SectionHeader(title = "Top Performing Funds") }
                item { TopFundsSection(funds = uiState.topFunds) }
            }
        }
    }

    LaunchedEffect(Unit) {
        viewModel.loadDailyBriefing()
    }
}

// ═══════════════════════════════════════════════════
// MARK: - Greeting + Weather
// ═══════════════════════════════════════════════════
@Composable
private fun GreetingSection(weather: WeatherData?) {
    val greeting = remember {
        val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        when {
            hour < 12 -> "Good Morning"
            hour < 17 -> "Good Afternoon"
            else -> "Good Evening"
        }
    }
    val greetingEmoji = remember {
        val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        when {
            hour in 5..11 -> "☀️"
            hour in 12..16 -> "🌤️"
            hour in 17..20 -> "🌅"
            else -> "🌙"
        }
    }
    val dateFormat = remember { SimpleDateFormat("EEE, d MMM yyyy", Locale.getDefault()) }
    val today = remember { dateFormat.format(Date()) }

    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Top
    ) {
        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(greeting, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Spacer(Modifier.width(6.dp))
                Text(greetingEmoji, fontSize = 22.sp)
            }
            Spacer(Modifier.height(2.dp))
            Text(today, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }

        // Weather badge
        if (weather != null) {
            Column(horizontalAlignment = Alignment.End) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(weather.iconRes, fontSize = 20.sp)
                    Spacer(Modifier.width(4.dp))
                    Text("${weather.temperature.toInt()}°", fontSize = 24.sp, fontWeight = FontWeight.SemiBold)
                }
                Text(weather.conditionText, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                weather.cityName?.let {
                    Text(it, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f))
                }
            }
        }
    }
}

// ═══════════════════════════════════════════════════
// MARK: - Gift Nifty Card
// ═══════════════════════════════════════════════════
@Composable
private fun GiftNiftyCard(data: GiftNiftyData) {
    val context = LocalContext.current
    val shareService = remember { ShareCardService(context) }
    val isPositive = data.change >= 0
    val direction = if (isPositive) "▲" else "▼"
    val color = if (isPositive) VMColors.MarketUp else VMColors.MarketDown

    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text("Gift Nifty", fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                    Text(
                        if (data.marketStatus.isNotBlank()) data.marketStatus else "Pre-Market Indicator",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(horizontalAlignment = Alignment.End) {
                        Text(
                            String.format("%.2f", data.price),
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(direction, fontSize = 10.sp, color = color)
                            Spacer(Modifier.width(2.dp))
                            Text(
                                "${String.format("%.2f", data.change)} (${String.format("%.2f", data.changePercent)}%)",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium,
                                color = color
                            )
                        }
                    }
                    Spacer(Modifier.width(10.dp))
                    IconButton(
                        onClick = {
                            val card = shareService.generateGiftNiftyCard(
                                ShareCardService.GiftNiftyShareData(
                                    price = data.price, change = data.change,
                                    changePercent = data.changePercent,
                                    previousClose = data.previousClose,
                                    marketStatus = data.marketStatus
                                )
                            )
                            shareService.shareBitmap(card, "Gift Nifty — ${String.format("%.2f", data.price)}")
                        },
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(Icons.Default.Share, contentDescription = "Share", tint = VMColors.Accent, modifier = Modifier.size(18.dp))
                    }
                }
            }
        }
    }
}

// ═══════════════════════════════════════════════════
// MARK: - Section Header
// ═══════════════════════════════════════════════════
@Composable
private fun SectionHeader(title: String, onClick: (() -> Unit)? = null) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier.width(3.dp).height(18.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(VMColors.Accent)
        )
        Spacer(Modifier.width(8.dp))
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.weight(1f))
        if (onClick != null) {
            TextButton(onClick = onClick) {
                Text("See All", fontSize = 12.sp, color = VMColors.Accent)
                Icon(Icons.Default.ChevronRight, contentDescription = null, tint = VMColors.Accent, modifier = Modifier.size(16.dp))
            }
        }
    }
}

// ═══════════════════════════════════════════════════
// MARK: - Market Indices Row
// ═══════════════════════════════════════════════════
@Composable
private fun MarketIndicesRow(indices: List<MarketIndex>, onIndexClick: (MarketIndex) -> Unit = {}) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(indices.take(4)) { index -> MarketIndexCard(index = index, onClick = { onIndexClick(index) }) }
    }
}

@Composable
private fun MarketIndexCard(index: MarketIndex, onClick: () -> Unit = {}) {
    Card(
        modifier = Modifier.width(155.dp).clickable { onClick() },
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(index.countryFlag, fontSize = 14.sp)
                Text(index.symbol, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.height(6.dp))
            Text(index.formattedValue, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(2.dp))
            Text(
                "${index.formattedChange} (${index.formattedChangePercent})",
                fontSize = 12.sp,
                color = if (index.isPositive) VMColors.MarketUp else VMColors.MarketDown,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

// ═══════════════════════════════════════════════════
// MARK: - Headlines
// ═══════════════════════════════════════════════════
@Composable
private fun HeadlineCard(headline: Headline, onArticleClick: (url: String, title: String, source: String) -> Unit = { _, _, _ -> }) {
    Column(modifier = Modifier
        .fillMaxWidth()
        .clickable(enabled = !headline.url.isNullOrBlank()) {
            headline.url?.let { onArticleClick(it, headline.title, headline.source) }
        }
        .padding(horizontal = 16.dp, vertical = 12.dp)
    ) {
        if (headline.isBreaking) {
            Text("BREAKING", fontSize = 10.sp, color = VMColors.Error, fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 2.dp))
        }
        Text(headline.title, fontSize = 14.sp, fontWeight = FontWeight.Medium, maxLines = 2, overflow = TextOverflow.Ellipsis)
        Spacer(Modifier.height(4.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(headline.source, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text("•", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(headline.publishedAt, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

// ═══════════════════════════════════════════════════
// MARK: - Corporate Actions
// ═══════════════════════════════════════════════════
@Composable
private fun CorporateActionsRow(actions: List<CorporateActionItem>) {
    LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        items(actions.take(4)) { action ->
            Card(
                modifier = Modifier.width(180.dp),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(action.symbol, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    Text(action.companyName, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Spacer(Modifier.height(6.dp))
                    Text(action.actionType.replaceFirstChar { it.uppercase() }, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = VMColors.Accent)
                    Text(action.details, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                    Spacer(Modifier.height(4.dp))
                    Text(formatDateShort(action.exDate), fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

// ═══════════════════════════════════════════════════
// MARK: - Currency Rates
// ═══════════════════════════════════════════════════
@Composable
private fun CurrencyRatesRow(rates: List<CurrencyRate>) {
    LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        items(rates.take(4)) { rate ->
            Card(
                modifier = Modifier.width(145.dp),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (rate.flag.isNotEmpty()) Text(rate.flag, fontSize = 14.sp)
                        Spacer(Modifier.width(4.dp))
                        Text(rate.pair, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    }
                    Spacer(Modifier.height(6.dp))
                    Text("₹${rate.formattedRate}", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    Text(
                        "${rate.formattedChange} (${rate.formattedChangePercent})",
                        fontSize = 11.sp,
                        color = if (rate.isPositive) VMColors.MarketUp else VMColors.MarketDown
                    )
                }
            }
        }
    }
}

// ═══════════════════════════════════════════════════
// MARK: - Commodities
// ═══════════════════════════════════════════════════
@Composable
private fun CommoditiesRow(commodities: List<CommodityItem>) {
    LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        items(commodities.take(4)) { commodity ->
            Card(
                modifier = Modifier.width(145.dp),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(commodity.name, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Spacer(Modifier.height(6.dp))
                    Text(commodity.formattedPrice, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    if (commodity.unit.isNotEmpty()) {
                        Text("per ${commodity.unit}", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Text(
                        "${commodity.formattedChange} (${commodity.formattedChangePercent})",
                        fontSize = 11.sp,
                        color = if (commodity.isPositive) VMColors.MarketUp else VMColors.MarketDown
                    )
                }
            }
        }
    }
}

// ═══════════════════════════════════════════════════
// MARK: - Fuel Price Section (4 tiles, 2 per row)
// ═══════════════════════════════════════════════════
@Composable
private fun FuelPriceSection(fuelPrices: AllFuelPrices?) {
    Column(modifier = Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (fuelPrices != null) {
            Text(
                "${fuelPrices.cityName}, ${fuelPrices.stateName}",
                fontSize = 12.sp, color = VMColors.Accent, fontWeight = FontWeight.Medium,
                modifier = Modifier.padding(bottom = 2.dp)
            )
        }

        // Row 1: Petrol + Diesel
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            FuelTile(Modifier.weight(1f), "Petrol", fuelPrices?.petrolPrice, fuelPrices?.petrolUnit ?: "litre", fuelPrices?.petrolChange)
            FuelTile(Modifier.weight(1f), "Diesel", fuelPrices?.dieselPrice, fuelPrices?.dieselUnit ?: "litre", fuelPrices?.dieselChange)
        }
        // Row 2: CNG + LPG
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            FuelTile(Modifier.weight(1f), "CNG", fuelPrices?.cngPrice, fuelPrices?.cngUnit ?: "kg", fuelPrices?.cngChange)
            FuelTile(Modifier.weight(1f), "LPG", fuelPrices?.lpgPrice, fuelPrices?.lpgUnit ?: "14.2kg", fuelPrices?.lpgChange)
        }
    }
}

@Composable
private fun FuelTile(modifier: Modifier, label: String, price: Double?, unit: String, change: Double?) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(label, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(8.dp))
            Text(
                if (price != null && price > 0) "\u20B9${String.format("%.2f", price)}" else "\u2014",
                fontSize = 22.sp, fontWeight = FontWeight.Bold
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("per $unit", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (change != null) {
                    Spacer(Modifier.width(6.dp))
                    if (change == 0.0) {
                        Text("No Change", fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    } else {
                        val isUp = change > 0
                        Text(
                            "${if (isUp) "+" else ""}${String.format("%.2f", change)}",
                            fontSize = 10.sp, fontWeight = FontWeight.SemiBold,
                            color = if (isUp) VMColors.MarketDown else VMColors.MarketUp
                        )
                    }
                }
            }
        }
    }
}

// ═══════════════════════════════════════════════════
// MARK: - Date Formatting Helper
// ═══════════════════════════════════════════════════
private fun formatDateShort(dateStr: String): String {
    return try {
        val inputFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        val outputFormat = SimpleDateFormat("dd MMM", Locale.US)
        val date = inputFormat.parse(dateStr) ?: return dateStr
        outputFormat.format(date)
    } catch (e: Exception) { dateStr }
}

// ═══════════════════════════════════════════════════
// MARK: - NFO Row
// ═══════════════════════════════════════════════════
@Composable
private fun NFORow(nfos: List<NFOLiveItem>) {
    LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        items(nfos.take(4)) { nfo ->
            Card(
                modifier = Modifier.width(180.dp),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(nfo.schemeName, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Spacer(Modifier.height(4.dp))
                    Text(nfo.amcName, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                    Spacer(Modifier.height(4.dp))
                    Text(nfo.fundType, fontSize = 10.sp, color = VMColors.Accent, fontWeight = FontWeight.Medium)
                    Spacer(Modifier.height(4.dp))
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(4.dp))
                            .background(VMColors.Success.copy(alpha = 0.1f))
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Text("Open Now", fontSize = 10.sp, fontWeight = FontWeight.Medium, color = VMColors.Success)
                    }
                }
            }
        }
    }
}

// ═══════════════════════════════════════════════════
// MARK: - Top Funds Section
// ═══════════════════════════════════════════════════
@Composable
private fun TopFundsSection(funds: List<TopFundItem>) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            funds.take(4).forEachIndexed { index, fund ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("${index + 1}.", fontWeight = FontWeight.Bold, modifier = Modifier.width(24.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            fund.fundName.take(40) + if (fund.fundName.length > 40) "…" else "",
                            fontSize = 13.sp, fontWeight = FontWeight.Medium, maxLines = 1
                        )
                        Text(fund.fundHouse, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Spacer(Modifier.width(8.dp))
                    Column(horizontalAlignment = Alignment.End) {
                        Text("₹${fund.nav}", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        val pct = fund.changePercent
                        val isPositive = !pct.startsWith("-")
                        Text(
                            pct,
                            fontSize = 11.sp, fontWeight = FontWeight.Medium,
                            color = if (isPositive) VMColors.MarketUp else VMColors.MarketDown
                        )
                    }
                }
                if (index < minOf(3, funds.size - 1)) {
                    HorizontalDivider(modifier = Modifier.padding(start = 24.dp))
                }
            }
        }
    }
}
