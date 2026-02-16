package com.vmfinancial.android.ui.screens.portfolio

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ShowChart
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vmfinancial.android.MainActivity
import com.vmfinancial.android.services.AuthUser
import com.vmfinancial.android.ui.theme.VMColors
import com.vmfinancial.shared.data.api.BackendApi
import com.vmfinancial.shared.data.models.*
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.util.Locale

private val indianFormat = NumberFormat.getNumberInstance(Locale("en", "IN"))

private fun formatINR(amount: Double): String {
    return "\u20b9${indianFormat.format(amount.toLong())}"
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PortfolioScreen(
    onNavigateToAuth: () -> Unit = {},
    onNavigateToFund: ((String, String) -> Unit)? = null,
    onNavigateToCASImport: (() -> Unit)? = null
) {
    val context = LocalContext.current
    val authService = (context as? MainActivity)?.authService
    val currentUser by authService?.currentUser?.collectAsState() ?: remember { mutableStateOf<AuthUser?>(null) }

    if (currentUser == null) {
        GuestPortfolio(onSignIn = onNavigateToAuth)
    } else {
        SignedInPortfolio(
            user = currentUser!!,
            token = authService?.authToken ?: "",
            onNavigateToFund = onNavigateToFund,
            onNavigateToCASImport = onNavigateToCASImport
        )
    }
}

@Composable
private fun GuestPortfolio(onSignIn: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(Icons.Outlined.PieChart, contentDescription = null, modifier = Modifier.size(70.dp), tint = VMColors.Accent.copy(alpha = 0.3f))
        Spacer(Modifier.height(20.dp))
        Text("Track Your Investments", fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text(
            "Sign in to view your portfolio, track performance, and manage your watchlist.",
            fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center, modifier = Modifier.padding(horizontal = 40.dp)
        )
        Spacer(Modifier.height(28.dp))
        PortfolioFeature(Icons.AutoMirrored.Outlined.ShowChart, "Real-time portfolio value")
        PortfolioFeature(Icons.Outlined.BookmarkBorder, "Fund watchlist")
        PortfolioFeature(Icons.Outlined.Description, "Import CAS statement")
        PortfolioFeature(Icons.Outlined.Notifications, "Smart alerts & reminders")
        Spacer(Modifier.height(32.dp))
        Button(
            onClick = onSignIn,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 32.dp).height(48.dp),
            colors = ButtonDefaults.buttonColors(containerColor = VMColors.Accent),
            shape = RoundedCornerShape(10.dp)
        ) { Text("Sign In to Continue", fontSize = 16.sp, fontWeight = FontWeight.SemiBold) }
    }
}

@Composable
private fun PortfolioFeature(icon: ImageVector, text: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 48.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Icon(icon, contentDescription = null, tint = VMColors.Accent, modifier = Modifier.size(18.dp))
        Text(text, fontSize = 14.sp)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SignedInPortfolio(
    user: AuthUser, token: String,
    onNavigateToFund: ((String, String) -> Unit)? = null,
    onNavigateToCASImport: (() -> Unit)? = null
) {
    val scope = rememberCoroutineScope()
    val api = remember { BackendApi() }

    var selectedTab by remember { mutableIntStateOf(0) }
    var isLoading by remember { mutableStateOf(true) }
    var summary by remember { mutableStateOf<PortfolioSummary?>(null) }
    var holdings by remember { mutableStateOf<List<HoldingItem>>(emptyList()) }
    var watchlist by remember { mutableStateOf<List<WatchlistItem>>(emptyList()) }
    var sips by remember { mutableStateOf<List<SIPItem>>(emptyList()) }
    var showSearchSheet by remember { mutableStateOf(false) }

    fun loadData() {
        scope.launch {
            isLoading = true
            try {
                val summaryResp = api.getPortfolioSummary(token)
                if (summaryResp.success) summary = summaryResp.summary

                val holdingsResp = api.getHoldings(token)
                if (holdingsResp.success) holdings = holdingsResp.holdings

                val watchlistResp = api.getWatchlist(token)
                if (watchlistResp.success) watchlist = watchlistResp.watchlist

                try {
                    val sipResp = api.getSIPs(token)
                    if (sipResp.success) sips = sipResp.sips
                } catch (_: Exception) { }
            } catch (_: Exception) { }
            isLoading = false
        }
    }

    LaunchedEffect(token) { loadData() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Portfolio", fontWeight = FontWeight.Bold)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(user.fullName, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Spacer(Modifier.width(4.dp))
                            Icon(Icons.Filled.Star, contentDescription = "Premium", tint = Color(0xFFF59E0B), modifier = Modifier.size(12.dp))
                        }
                    }
                },
                actions = {
                    IconButton(onClick = { onNavigateToCASImport?.invoke() }) {
                        Icon(Icons.Outlined.Description, "Import CAS", tint = VMColors.Accent)
                    }
                    IconButton(onClick = { showSearchSheet = true }) {
                        Icon(Icons.Default.Add, "Add", tint = VMColors.Accent)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).background(MaterialTheme.colorScheme.background)) {
            // Dashboard bar
            DashboardBar(summary, holdings.size, sips)

            // Tab selector: Mutual Funds | Live SIPs | Watchlist
            val tabs = listOf("Mutual Funds", "Live SIPs", "Watchlist")
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)
                    .clip(RoundedCornerShape(10.dp)).background(MaterialTheme.colorScheme.surface),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                tabs.forEachIndexed { index, label ->
                    val isSelected = selectedTab == index
                    Box(
                        modifier = Modifier.weight(1f)
                            .clip(RoundedCornerShape(10.dp))
                            .background(if (isSelected) VMColors.Accent else Color.Transparent)
                            .clickable { selectedTab = index }
                            .padding(vertical = 10.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(label, fontSize = 12.sp, fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            color = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }

            Spacer(Modifier.height(12.dp))

            if (isLoading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = VMColors.Accent, modifier = Modifier.size(32.dp))
                }
            } else {
                when (selectedTab) {
                    0 -> HoldingsTab(holdings, token, api, onNavigateToFund) { loadData() }
                    1 -> SIPsTab(sips, onNavigateToFund)
                    2 -> WatchlistTab(watchlist, token, api, onNavigateToFund = onNavigateToFund, onAddClick = { showSearchSheet = true }) { loadData() }
                }
            }
        }
    }

    // Search & Add to Watchlist bottom sheet
    if (showSearchSheet) {
        SearchAddSheet(
            token = token,
            api = api,
            onDismiss = { showSearchSheet = false },
            onAdded = { loadData() }
        )
    }
}

@Composable
private fun DashboardBar(summary: PortfolioSummary?, holdingsCount: Int, sips: List<SIPItem>) {
    val totalSIP = sips.sumOf { it.sipAmount }

    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(top = 8.dp, bottom = 12.dp),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            if (summary != null && summary.holdingsCount > 0) {
                // ── Top row: Current value + returns ──
                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Current Value", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(formatINR(summary.currentValue), fontSize = 26.sp, fontWeight = FontWeight.Bold)
                    }
                    val retSign = if (summary.totalReturns >= 0) "+" else ""
                    val retColor = if (summary.totalReturns >= 0) VMColors.MarketUp else VMColors.MarketDown
                    Column(horizontalAlignment = Alignment.End) {
                        Text("P&L", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text("$retSign${formatINR(summary.totalReturns)}", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = retColor)
                        Text("$retSign${String.format("%.1f", summary.returnsPercentage)}%", fontSize = 12.sp, color = retColor)
                    }
                }
                Spacer(Modifier.height(12.dp))
                HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.15f))
                Spacer(Modifier.height(10.dp))
                // ── Bottom row: Key metrics ──
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    MetricPill("Invested", formatINR(summary.totalInvested))
                    MetricPill("Funds", "${summary.holdingsCount}")
                    MetricPill("Monthly SIP", if (totalSIP > 0) formatINR(totalSIP) else "--")
                    MetricPill("XIRR", "${String.format("%+.1f", summary.returnsPercentage)}%")
                }
            } else {
                // No holdings yet — simple metric row
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                    MetricPill("Funds", "$holdingsCount")
                    MetricPill("SIPs", "${sips.size}")
                    MetricPill("Monthly SIP", if (totalSIP > 0) formatINR(totalSIP) else "--")
                }
            }
        }
    }
}

@Composable
private fun MetricPill(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = VMColors.Accent)
        Text(label, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SearchAddSheet(token: String, api: BackendApi, onDismiss: () -> Unit, onAdded: () -> Unit) {
    val scope = rememberCoroutineScope()
    var query by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<FundSearchItem>>(emptyList()) }
    var isSearching by remember { mutableStateOf(false) }
    var addingCode by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(query) {
        if (query.length >= 2) {
            delay(400)
            isSearching = true
            try {
                val resp = api.searchFunds(query)
                results = resp.funds
            } catch (_: Exception) { results = emptyList() }
            isSearching = false
        } else {
            results = emptyList()
        }
    }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
            Text("Add to Watchlist", fontSize = 18.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 12.dp))
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("Search mutual funds...", fontSize = 14.sp) },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(20.dp)) },
                trailingIcon = {
                    if (query.isNotEmpty()) IconButton(onClick = { query = ""; results = emptyList() }) {
                        Icon(Icons.Default.Close, contentDescription = null, modifier = Modifier.size(18.dp))
                    }
                },
                shape = RoundedCornerShape(10.dp),
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = VMColors.Accent)
            )

            Spacer(Modifier.height(8.dp))

            if (isSearching) {
                Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = VMColors.Accent, modifier = Modifier.size(24.dp))
                }
            } else {
                LazyColumn(modifier = Modifier.heightIn(max = 400.dp)) {
                    items(results, key = { it.schemeCode }) { fund ->
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(fund.name, fontSize = 13.sp, fontWeight = FontWeight.Medium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                Text(fund.fundHouse, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Spacer(Modifier.width(8.dp))
                            Button(
                                onClick = {
                                    addingCode = fund.schemeCode
                                    scope.launch {
                                        try {
                                            api.addToWatchlist(token, fund.schemeCode)
                                            onAdded()
                                        } catch (_: Exception) {}
                                        addingCode = null
                                    }
                                },
                                modifier = Modifier.height(32.dp),
                                contentPadding = PaddingValues(horizontal = 12.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = VMColors.Accent),
                                shape = RoundedCornerShape(8.dp),
                                enabled = addingCode != fund.schemeCode
                            ) {
                                if (addingCode == fund.schemeCode) {
                                    CircularProgressIndicator(modifier = Modifier.size(14.dp), color = Color.White, strokeWidth = 2.dp)
                                } else {
                                    Text("+ Add", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                }
                            }
                        }
                        HorizontalDivider()
                    }
                }
            }

            Spacer(Modifier.height(32.dp))
        }
    }
}

@Composable
private fun WatchlistTab(
    watchlist: List<WatchlistItem>, token: String, api: BackendApi,
    onNavigateToFund: ((String, String) -> Unit)? = null,
    onAddClick: () -> Unit, onRefresh: () -> Unit
) {
    val scope = rememberCoroutineScope()

    if (watchlist.isEmpty()) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(48.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(Icons.Outlined.BookmarkBorder, contentDescription = null, modifier = Modifier.size(48.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.3f))
            Spacer(Modifier.height(12.dp))
            Text("No funds in your watchlist", fontSize = 16.sp, fontWeight = FontWeight.Medium)
            Text("Search for funds and add them to your watchlist.",
                fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
            Spacer(Modifier.height(16.dp))
            Button(
                onClick = onAddClick,
                colors = ButtonDefaults.buttonColors(containerColor = VMColors.Accent),
                shape = RoundedCornerShape(10.dp)
            ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(6.dp))
                Text("Add Funds", fontWeight = FontWeight.SemiBold)
            }
        }
    } else {
        LazyColumn(
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(watchlist, key = { it.id }) { item ->
                val cleanName = item.schemeName
                    .replace("- Direct Plan", "").replace("Direct Plan", "")
                    .replace("- Growth Option", "").replace("- Growth", "").replace("Growth", "")
                    .replace("  ", " ").trim().removeSuffix("-").trim()
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    modifier = Modifier.clickable {
                        onNavigateToFund?.invoke(item.schemeCode, item.schemeName)
                    }
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(cleanName, fontSize = 14.sp, fontWeight = FontWeight.Medium, maxLines = 2)
                            Spacer(Modifier.height(4.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                Text("NAV: ${String.format("%.2f", item.currentNav)}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                if (item.return1y != 0.0) {
                                    val retColor = if (item.return1y >= 0) VMColors.MarketUp else VMColors.MarketDown
                                    Text("1Y: ${String.format("%.1f", item.return1y)}%", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = retColor)
                                }
                            }
                        }
                        IconButton(onClick = {
                            scope.launch {
                                try { api.removeFromWatchlist(token, item.schemeCode) } catch (_: Exception) {}
                                onRefresh()
                            }
                        }) {
                            Icon(Icons.Outlined.BookmarkRemove, contentDescription = "Remove", tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f), modifier = Modifier.size(20.dp))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun HoldingsTab(
    holdings: List<HoldingItem>,
    token: String,
    api: BackendApi,
    onNavigateToFund: ((String, String) -> Unit)? = null,
    onRefresh: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var deleteTarget by remember { mutableStateOf<HoldingItem?>(null) }
    var isDeleting by remember { mutableStateOf(false) }

    if (holdings.isEmpty()) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(48.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(Icons.Outlined.AccountBalance, contentDescription = null, modifier = Modifier.size(48.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.3f))
            Spacer(Modifier.height(12.dp))
            Text("No mutual fund holdings", fontSize = 16.sp, fontWeight = FontWeight.Medium)
            Text("Import your CAS statement to see holdings here.",
                fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
        }
    } else {
        LazyColumn(
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(holdings, key = { it.id }) { item ->
                val cleanName = item.schemeName
                    .replace("- Direct Plan", "").replace("Direct Plan", "")
                    .replace("- Growth Option", "").replace("- Growth", "").replace("Growth", "")
                    .replace("  ", " ").trim().removeSuffix("-").trim()
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    modifier = Modifier.clickable {
                        onNavigateToFund?.invoke(item.schemeCode, item.schemeName)
                    }
                ) {
                    Column(modifier = Modifier.fillMaxWidth().padding(14.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
                            Text(cleanName, fontSize = 14.sp, fontWeight = FontWeight.Medium, maxLines = 2,
                                modifier = Modifier.weight(1f))
                            IconButton(
                                onClick = { deleteTarget = item },
                                modifier = Modifier.size(28.dp)
                            ) {
                                Icon(Icons.Outlined.Delete, contentDescription = "Remove",
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                                    modifier = Modifier.size(18.dp))
                            }
                        }
                        Spacer(Modifier.height(8.dp))
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Column {
                                Text("Invested", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text(formatINR(item.purchaseAmount), fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text("Current", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text(formatINR(item.currentValue), fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                            }
                        }
                        Spacer(Modifier.height(6.dp))
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("${String.format("%.3f", item.units)} units @ ${String.format("%.2f", item.purchaseNav)}",
                                fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            val retSign = if (item.returns >= 0) "+" else ""
                            val retColor = if (item.returns >= 0) VMColors.MarketUp else VMColors.MarketDown
                            Text("$retSign${formatINR(item.returns)} ($retSign${String.format("%.1f", item.returnsPercentage)}%)",
                                fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = retColor)
                        }
                    }
                }
            }
        }
    }

    // Delete confirmation dialog
    if (deleteTarget != null) {
        val target = deleteTarget!!
        val targetClean = target.schemeName
            .replace("- Direct Plan", "").replace("Direct Plan", "")
            .replace("- Growth Option", "").replace("- Growth", "").replace("Growth", "")
            .replace("  ", " ").trim().removeSuffix("-").trim()
        AlertDialog(
            onDismissRequest = { if (!isDeleting) deleteTarget = null },
            confirmButton = {
                Button(
                    onClick = {
                        isDeleting = true
                        scope.launch {
                            try { api.deleteHolding(token, target.id) } catch (_: Exception) {}
                            isDeleting = false
                            deleteTarget = null
                            onRefresh()
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = VMColors.MarketDown),
                    enabled = !isDeleting
                ) {
                    if (isDeleting) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White, strokeWidth = 2.dp)
                    } else {
                        Text("Delete")
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = { deleteTarget = null }, enabled = !isDeleting) {
                    Text("Cancel")
                }
            },
            title = { Text("Remove Holding?", fontWeight = FontWeight.Bold) },
            text = {
                Text("This will permanently remove \"$targetClean\" (${String.format("%.3f", target.units)} units) from your portfolio.")
            }
        )
    }
}

@Composable
private fun SIPsTab(sips: List<SIPItem>, onNavigateToFund: ((String, String) -> Unit)? = null) {
    if (sips.isEmpty()) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(48.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(Icons.Outlined.Autorenew, contentDescription = null, modifier = Modifier.size(48.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.3f))
            Spacer(Modifier.height(12.dp))
            Text("No SIPs detected", fontSize = 16.sp, fontWeight = FontWeight.Medium)
            Text("Import your CAS statement to see active SIPs here.",
                fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
        }
    } else {
        LazyColumn(
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            item {
                val totalSIP = sips.sumOf { it.sipAmount }
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = VMColors.Accent.copy(alpha = 0.1f))
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("Monthly SIP", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(formatINR(totalSIP), fontSize = 22.sp, fontWeight = FontWeight.Bold, color = VMColors.Accent)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text("${sips.size} Active", fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                            Text("Systematic Plans", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }

            items(sips, key = { it.id }) { sip ->
                val cleanName = sip.schemeName
                    .replace("- Direct Plan", "").replace("Direct Plan", "")
                    .replace("- Growth Option", "").replace("- Growth", "").replace("Growth", "")
                    .replace("  ", " ").trim().removeSuffix("-").trim()
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    modifier = if (sip.schemeCode != null && onNavigateToFund != null) {
                        Modifier.clickable { onNavigateToFund(sip.schemeCode!!, sip.schemeName) }
                    } else Modifier
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(cleanName, fontSize = 13.sp, fontWeight = FontWeight.Medium, maxLines = 2)
                            Spacer(Modifier.height(4.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                Text(sip.frequency, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                sip.lastSipDate?.let {
                                    Text("Last: $it", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                        }
                        Text(
                            formatINR(sip.sipAmount),
                            fontSize = 15.sp, fontWeight = FontWeight.Bold, color = VMColors.Accent
                        )
                    }
                }
            }
        }
    }
}
