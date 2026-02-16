package com.vmfinancial.android.ui.screens.markets

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.foundation.clickable
import androidx.navigation.NavController
import com.vmfinancial.android.ui.theme.VMColors
import com.vmfinancial.shared.data.api.BackendApi
import com.vmfinancial.shared.data.models.MarketIndex
import com.vmfinancial.shared.data.models.MarketDataItem
import kotlinx.coroutines.async
import kotlinx.coroutines.launch
import java.net.URLEncoder
import java.util.Calendar
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MarketsScreen(navController: NavController? = null) {
    val scope = rememberCoroutineScope()
    val api = remember { BackendApi() }

    var selectedRegion by remember { mutableIntStateOf(0) }
    val regions = listOf("India", "US", "Europe", "Asia")

    // Same symbols as HomeViewModel / iOS
    val indianSymbols = remember { listOf(
        "NIFTY", "BANKNIFTY", "NIFTYIT", "NIFTYNEXT50",
        "NIFTYMIDCAP150", "NIFTYSMALLCAP100", "NIFTYPHARMA", "NIFTYAUTO",
        "NIFTYFMCG", "NIFTYMETAL", "NIFTYREALTY", "NIFTYENERGY",
        "NIFTYINFRA", "NIFTYPSE", "NIFTYFINSERVICE", "NIFTYPVTBANK",
        "SENSEX", "BSE500", "BSEMIDCAP", "BSESMALLCAP", "BSEFMCG",
        "BSEIT", "BSEHEALTHCARE", "BSEAUTO", "BSEMETAL", "BSEOILGAS",
        "BSEREALTY", "BSECG", "BSEPOWER"
    ) }
    val usSymbols = remember { listOf("SPX", "IXIC", "DJI", "RUT", "VIX") }
    val euSymbols = remember { listOf("FTSE", "DAX", "CAC", "STOXX50E") }
    val asiaSymbols = remember { listOf("HSI", "N225", "KOSPI", "TWII", "STI") }

    var allIndices by remember { mutableStateOf<Map<String, List<MarketIndex>>>(emptyMap()) }
    var isLoading by remember { mutableStateOf(true) }

    fun toMarketIndex(item: MarketDataItem): MarketIndex {
        return MarketIndex(
            symbol = item.symbol, name = item.name, country = "IN", countryFlag = "",
            value = item.price, change = item.change, changePercent = item.changePercent,
            previousClose = item.price - item.change, lastUpdated = item.lastUpdated,
            isMarketOpen = item.isMarketOpen
        )
    }

    fun loadData() {
        scope.launch {
            isLoading = true
            try {
                val indiaDeferred = async { runCatching { api.getMarketData(indianSymbols) }.getOrNull() }
                val usDeferred = async { runCatching { api.getMarketData(usSymbols) }.getOrNull() }
                val euDeferred = async { runCatching { api.getMarketData(euSymbols) }.getOrNull() }
                val asiaDeferred = async { runCatching { api.getMarketData(asiaSymbols) }.getOrNull() }

                allIndices = mapOf(
                    "India" to (indiaDeferred.await()?.data?.map { toMarketIndex(it) } ?: emptyList()),
                    "US" to (usDeferred.await()?.data?.map { toMarketIndex(it) } ?: emptyList()),
                    "Europe" to (euDeferred.await()?.data?.map { toMarketIndex(it) } ?: emptyList()),
                    "Asia" to (asiaDeferred.await()?.data?.map { toMarketIndex(it) } ?: emptyList())
                )
            } catch (_: Exception) {}
            isLoading = false
        }
    }

    LaunchedEffect(Unit) { loadData() }

    val currentIndices = allIndices[regions[selectedRegion]] ?: emptyList()
    val isMarketOpen = currentIndices.any { it.isMarketOpen }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Markets", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).background(MaterialTheme.colorScheme.background),
            contentPadding = PaddingValues(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Region selector
            item {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)
                        .clip(RoundedCornerShape(10.dp)).background(MaterialTheme.colorScheme.surface),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    regions.forEachIndexed { index, label ->
                        val isSelected = selectedRegion == index
                        Box(
                            modifier = Modifier.weight(1f)
                                .clip(RoundedCornerShape(10.dp))
                                .background(if (isSelected) VMColors.Accent else Color.Transparent)
                                .clickable { selectedRegion = index }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(label, fontSize = 13.sp, fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                color = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }

            // Market status banner
            item {
                MarketStatusBanner(isOpen = isMarketOpen, region = regions[selectedRegion])
            }

            // Index cards
            if (isLoading) {
                item {
                    Box(Modifier.fillMaxWidth().height(120.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = VMColors.Accent)
                    }
                }
            } else {
                items(currentIndices) { index ->
                    MarketIndexDetailCard(index = index, onClick = {
                        val encodedName = URLEncoder.encode(index.name, "UTF-8")
                        navController?.navigate("index_detail/${index.symbol}/$encodedName")
                    })
                }
            }

            // Sectoral Performance
            item {
                Text(
                    "Sectoral Performance",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                )
            }
            item { SectoralPerformanceGrid(indices = allIndices["India"] ?: emptyList()) }
        }
    }
}

@Composable
private fun MarketStatusBanner(isOpen: Boolean, region: String) {
    val nextOpenDay = remember {
        val cal = Calendar.getInstance()
        // Advance to next weekday
        do { cal.add(Calendar.DAY_OF_YEAR, 1) } while (cal.get(Calendar.DAY_OF_WEEK) == Calendar.SATURDAY || cal.get(Calendar.DAY_OF_WEEK) == Calendar.SUNDAY)
        cal.getDisplayName(Calendar.DAY_OF_WEEK, Calendar.SHORT, Locale.getDefault()) ?: "Mon"
    }
    val nextOpen = when (region) {
        "India" -> "Opens $nextOpenDay 9:15 AM IST"
        "US" -> "Opens $nextOpenDay 9:30 AM EST"
        "Europe" -> "Opens $nextOpenDay 8:00 AM GMT"
        "Asia" -> "Opens $nextOpenDay 9:00 AM JST"
        else -> ""
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(if (isOpen) VMColors.Success.copy(alpha = 0.1f) else Color.Gray.copy(alpha = 0.1f))
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier.size(8.dp).clip(CircleShape)
                .background(if (isOpen) VMColors.Success else MaterialTheme.colorScheme.onSurfaceVariant)
        )
        Spacer(Modifier.width(8.dp))
        Text(
            if (isOpen) "Market Open" else "Market Closed",
            fontSize = 14.sp, fontWeight = FontWeight.Medium
        )
        Spacer(Modifier.weight(1f))
        if (!isOpen) {
            Text(nextOpen, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun MarketIndexDetailCard(index: MarketIndex, onClick: () -> Unit = {}) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).clickable { onClick() },
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(index.countryFlag, fontSize = 22.sp)
                Spacer(Modifier.width(10.dp))
                Column {
                    Text(index.symbol, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    Text(index.name, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Spacer(Modifier.weight(1f))
                Column(horizontalAlignment = Alignment.End) {
                    Text(index.formattedValue, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            if (index.isPositive) "▲" else "▼",
                            fontSize = 10.sp,
                            color = if (index.isPositive) VMColors.MarketUp else VMColors.MarketDown
                        )
                        Spacer(Modifier.width(2.dp))
                        Text(
                            "${index.formattedChange} (${index.formattedChangePercent})",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                            color = if (index.isPositive) VMColors.MarketUp else VMColors.MarketDown
                        )
                    }
                }
            }

            Spacer(Modifier.height(10.dp))

            // Change indicator bar
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(4.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.1f))
            ) {
                val pct = kotlin.math.abs(index.changePercent).coerceIn(0.0, 5.0) / 5.0
                Box(
                    modifier = Modifier
                        .fillMaxWidth(pct.toFloat().coerceAtLeast(0.05f))
                        .fillMaxHeight()
                        .clip(RoundedCornerShape(2.dp))
                        .background(if (index.isPositive) VMColors.MarketUp.copy(alpha = 0.7f) else VMColors.MarketDown.copy(alpha = 0.7f))
                )
            }
        }
    }
}

@Composable
private fun SectoralPerformanceGrid(indices: List<MarketIndex>) {
    // Map sectoral index symbols to display names — uses real-time data from backend
    val sectorMap = linkedMapOf(
        "NIFTYIT" to "IT", "BANKNIFTY" to "Banking", "NIFTYPHARMA" to "Pharma",
        "NIFTYAUTO" to "Auto", "NIFTYFMCG" to "FMCG", "NIFTYMETAL" to "Metal",
        "NIFTYREALTY" to "Realty", "NIFTYENERGY" to "Energy"
    )

    val sectors = sectorMap.mapNotNull { (symbol, label) ->
        indices.find { it.symbol == symbol }?.let { label to it.changePercent }
    }

    if (sectors.isEmpty()) return

    Column(modifier = Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        sectors.chunked(2).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { (name, change) ->
                    Card(
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(8.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(name, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                            Text(
                                if (change >= 0) "+${String.format("%.1f", change)}%" else "${String.format("%.1f", change)}%",
                                fontSize = 14.sp, fontWeight = FontWeight.Bold,
                                color = if (change >= 0) VMColors.MarketUp else VMColors.MarketDown
                            )
                        }
                    }
                }
                if (row.size < 2) Spacer(Modifier.weight(1f))
            }
        }
    }
}
