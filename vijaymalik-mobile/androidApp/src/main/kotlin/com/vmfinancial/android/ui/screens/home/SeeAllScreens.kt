package com.vmfinancial.android.ui.screens.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.activity.ComponentActivity
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import com.vmfinancial.android.ui.theme.VMColors
import com.vmfinancial.shared.data.models.*
import java.text.SimpleDateFormat
import java.util.*

// ═══════════════════════════════════════════════════
// MARK: - All Markets (See All)
// ═══════════════════════════════════════════════════
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AllMarketsScreen(
    onBack: () -> Unit,
    onIndexClick: (String, String) -> Unit,
    viewModel: HomeViewModel = viewModel(viewModelStoreOwner = LocalContext.current as ComponentActivity)
) {
    val uiState by viewModel.uiState.collectAsState()
    var selectedTab by remember { mutableIntStateOf(0) }
    val tabs = listOf("NSE", "BSE")

    val filtered = uiState.indianMarkets.filter { index ->
        if (selectedTab == 0) index.symbol.startsWith("NIFTY") || index.symbol == "NIFTY"
        else index.symbol.startsWith("BSE") || index.symbol == "SENSEX"
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Markets Today", fontWeight = FontWeight.Bold) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            // NSE / BSE toggle
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)
                    .clip(RoundedCornerShape(10.dp)).background(MaterialTheme.colorScheme.surface)
            ) {
                tabs.forEachIndexed { i, tab ->
                    Box(
                        modifier = Modifier.weight(1f)
                            .clip(RoundedCornerShape(10.dp))
                            .background(if (selectedTab == i) VMColors.Accent else Color.Transparent)
                            .clickable { selectedTab = i }
                            .padding(vertical = 10.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(tab, fontSize = 14.sp, fontWeight = FontWeight.SemiBold,
                            color = if (selectedTab == i) Color.White else MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }

            LazyColumn(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)) {
                items(filtered) { index ->
                    MarketIndexRow(index = index, onClick = { onIndexClick(index.symbol, index.name) })
                    HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                }
            }
        }
    }
}

@Composable
private fun MarketIndexRow(index: MarketIndex, onClick: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(index.name, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(index.symbol, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Column(horizontalAlignment = Alignment.End) {
            Text(String.format("%,.2f", index.value), fontSize = 14.sp, fontWeight = FontWeight.Bold)
            val isUp = index.change >= 0
            Text(
                "${if (isUp) "+" else ""}${String.format("%.2f", index.change)} (${String.format("%.2f", index.changePercent)}%)",
                fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
                color = if (isUp) VMColors.MarketUp else VMColors.MarketDown
            )
        }
    }
}

// ═══════════════════════════════════════════════════
// MARK: - All Headlines (See All)
// ═══════════════════════════════════════════════════
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AllHeadlinesScreen(onBack: () -> Unit, viewModel: HomeViewModel = viewModel(viewModelStoreOwner = LocalContext.current as ComponentActivity)) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Headlines", fontWeight = FontWeight.Bold) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(uiState.headlines) { headline ->
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        if (headline.isBreaking) {
                            Text("BREAKING", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = VMColors.Error,
                                modifier = Modifier.padding(bottom = 4.dp))
                        }
                        Text(headline.title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, lineHeight = 20.sp)
                        Spacer(Modifier.height(6.dp))
                        Row {
                            Text(headline.source, fontSize = 11.sp, color = VMColors.Accent, fontWeight = FontWeight.Medium)
                            Spacer(Modifier.width(8.dp))
                            Text(headline.publishedAt, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
        }
    }
}

// ═══════════════════════════════════════════════════
// MARK: - All Events (See All)
// ═══════════════════════════════════════════════════
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AllEventsScreen(onBack: () -> Unit, viewModel: HomeViewModel = viewModel(viewModelStoreOwner = LocalContext.current as ComponentActivity)) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Upcoming Events", fontWeight = FontWeight.Bold) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(uiState.corporateActions) { action ->
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Row(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(action.symbol, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                            Text(action.companyName, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Spacer(Modifier.height(4.dp))
                            Text(action.actionType.replaceFirstChar { it.uppercase() }, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = VMColors.Accent)
                            Text(action.details, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Text(formatDateShort(action.exDate), fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = VMColors.Accent)
                    }
                }
            }
        }
    }
}

// ═══════════════════════════════════════════════════
// MARK: - All Currency Rates (See All)
// ═══════════════════════════════════════════════════
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AllCurrenciesScreen(onBack: () -> Unit, viewModel: HomeViewModel = viewModel(viewModelStoreOwner = LocalContext.current as ComponentActivity)) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Currency Rates", fontWeight = FontWeight.Bold) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(uiState.currencyRates) { rate ->
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Row(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(rate.flag, fontSize = 24.sp)
                        Spacer(Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(rate.pair, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                            Text(rate.name, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text(rate.formattedRate, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                            Text(
                                "${rate.formattedChange} (${rate.formattedChangePercent})",
                                fontSize = 11.sp, color = if (rate.isPositive) VMColors.MarketUp else VMColors.MarketDown
                            )
                        }
                    }
                }
            }
        }
    }
}

// ═══════════════════════════════════════════════════
// MARK: - All Commodities (See All)
// ═══════════════════════════════════════════════════
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AllCommoditiesScreen(onBack: () -> Unit, viewModel: HomeViewModel = viewModel(viewModelStoreOwner = LocalContext.current as ComponentActivity)) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Commodities", fontWeight = FontWeight.Bold) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(uiState.commodities) { commodity ->
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Row(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(commodity.name, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                            if (commodity.unit.isNotEmpty()) {
                                Text("per ${commodity.unit}", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text(commodity.formattedPrice, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                            Text(
                                "${commodity.formattedChange} (${commodity.formattedChangePercent})",
                                fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
                                color = if (commodity.isPositive) VMColors.MarketUp else VMColors.MarketDown
                            )
                        }
                    }
                }
            }
        }
    }
}

// ═══════════════════════════════════════════════════
// MARK: - All NFOs / Recently Launched (See All)
// ═══════════════════════════════════════════════════
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AllNFOsScreen(onBack: () -> Unit, viewModel: HomeViewModel = viewModel(viewModelStoreOwner = LocalContext.current as ComponentActivity)) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Recently Launched Funds", fontWeight = FontWeight.Bold) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(uiState.nfos) { nfo ->
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Text(nfo.schemeName, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, lineHeight = 18.sp)
                        Spacer(Modifier.height(6.dp))
                        Row {
                            Text("AMC: ", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(nfo.amcName, fontSize = 11.sp, fontWeight = FontWeight.Medium)
                        }
                        Spacer(Modifier.height(4.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                            Column {
                                Text("Opens", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text(formatDateShort(nfo.openDate), fontSize = 12.sp, fontWeight = FontWeight.Medium, color = VMColors.MarketUp)
                            }
                            Column {
                                Text("Closes", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text(formatDateShort(nfo.closeDate), fontSize = 12.sp, fontWeight = FontWeight.Medium, color = VMColors.MarketDown)
                            }
                        }
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
