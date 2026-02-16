package com.vmfinancial.android.ui.screens.portfolio

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.outlined.BarChart
import androidx.compose.material.icons.outlined.PieChart
import androidx.compose.material.icons.outlined.TrendingUp
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vmfinancial.android.MainActivity
import com.vmfinancial.android.ui.theme.VMColors
import com.vmfinancial.shared.data.api.BackendApi
import com.vmfinancial.shared.data.models.HoldingItem
import com.vmfinancial.shared.data.models.PortfolioSummary
import kotlinx.coroutines.launch

data class AllocationBucket(val label: String, val value: Double, val percentage: Double, val color: Color)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AnalyticsScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val authService = (context as? MainActivity)?.authService
    val token = authService?.authToken
    val api = remember { BackendApi() }
    val scope = rememberCoroutineScope()

    var holdings by remember { mutableStateOf<List<HoldingItem>>(emptyList()) }
    var summary by remember { mutableStateOf<PortfolioSummary?>(null) }
    var isLoading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        if (token != null) {
            try {
                val holdingsResp = api.getHoldings(token)
                val summaryResp = api.getPortfolioSummary(token)
                holdings = holdingsResp.holdings
                summary = summaryResp.summary
            } catch (e: Exception) {
                println("Analytics error: ${e.message}")
            }
        }
        isLoading = false
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Portfolio Analytics", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        if (isLoading) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = VMColors.Accent)
            }
        } else if (holdings.isEmpty()) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Outlined.PieChart, contentDescription = null, modifier = Modifier.size(64.dp), tint = VMColors.Accent.copy(alpha = 0.4f))
                    Spacer(Modifier.height(16.dp))
                    Text("No Holdings Yet", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    Text("Import your CAS or add holdings to see analytics", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding),
                contentPadding = PaddingValues(bottom = 32.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Portfolio Overview
                item { PortfolioOverviewCard(summary, holdings.size) }

                // Allocation by AMC
                item { AllocationCard(holdings) }

                // Top Holdings
                item { TopHoldingsCard(holdings) }

                // Gainers & Losers
                item { GainersLosersCard(holdings) }

                // Risk Summary
                item { RiskSummaryCard(holdings, summary) }
            }
        }
    }
}

@Composable
private fun PortfolioOverviewCard(summary: PortfolioSummary?, holdingsCount: Int) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.TrendingUp, contentDescription = null, tint = VMColors.Accent, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text("Portfolio Overview", fontSize = 16.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.height(16.dp))

            if (summary != null) {
                Row(modifier = Modifier.fillMaxWidth()) {
                    OverviewMetric("Invested", "₹${formatAmount(summary.totalInvested)}", Modifier.weight(1f))
                    OverviewMetric("Current", "₹${formatAmount(summary.currentValue)}", Modifier.weight(1f))
                }
                Spacer(Modifier.height(12.dp))
                Row(modifier = Modifier.fillMaxWidth()) {
                    val isPos = summary.totalReturns >= 0
                    OverviewMetric(
                        "P&L",
                        "${if (isPos) "+" else ""}₹${formatAmount(summary.totalReturns)}",
                        Modifier.weight(1f),
                        valueColor = if (isPos) VMColors.MarketUp else VMColors.MarketDown
                    )
                    OverviewMetric(
                        "Return %",
                        String.format("%+.1f%%", summary.returnsPercentage),
                        Modifier.weight(1f),
                        valueColor = if (isPos) VMColors.MarketUp else VMColors.MarketDown
                    )
                }
                Spacer(Modifier.height(12.dp))
                OverviewMetric("Holdings", "$holdingsCount schemes", Modifier.fillMaxWidth())
            } else {
                Text("No summary available", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun OverviewMetric(label: String, value: String, modifier: Modifier, valueColor: Color = MaterialTheme.colorScheme.onSurface) {
    Column(modifier = modifier) {
        Text(label, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = valueColor)
    }
}

@Composable
private fun AllocationCard(holdings: List<HoldingItem>) {
    val allocationColors = listOf(
        Color(0xFF14B8A6), Color(0xFF3B82F6), Color(0xFFF59E0B),
        Color(0xFFEF4444), Color(0xFF8B5CF6), Color(0xFFEC4899),
        Color(0xFF6366F1), Color(0xFF10B981)
    )

    // Group by AMC (extract from scheme name — first word before "Mutual Fund" or first 2-3 words)
    val totalValue = holdings.sumOf { it.currentValue }
    val amcGroups = holdings.groupBy { extractAmc(it.schemeName) }
        .map { (amc, items) ->
            val value = items.sumOf { it.currentValue }
            AllocationBucket(amc, value, if (totalValue > 0) value / totalValue * 100 else 0.0, Color.Transparent)
        }
        .sortedByDescending { it.value }

    val coloredBuckets = amcGroups.mapIndexed { i, bucket ->
        bucket.copy(color = allocationColors[i % allocationColors.size])
    }

    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.PieChart, contentDescription = null, tint = VMColors.Accent, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text("AMC Allocation", fontSize = 16.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.height(16.dp))

            // Stacked bar
            if (coloredBuckets.isNotEmpty()) {
                Row(
                    modifier = Modifier.fillMaxWidth().height(12.dp).clip(RoundedCornerShape(6.dp))
                ) {
                    coloredBuckets.forEach { bucket ->
                        Box(
                            modifier = Modifier
                                .weight(bucket.percentage.toFloat().coerceAtLeast(0.5f))
                                .fillMaxHeight()
                                .background(bucket.color)
                        )
                    }
                }
                Spacer(Modifier.height(16.dp))

                coloredBuckets.take(8).forEach { bucket ->
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(modifier = Modifier.size(10.dp).clip(CircleShape).background(bucket.color))
                        Spacer(Modifier.width(8.dp))
                        Text(bucket.label, fontSize = 13.sp, modifier = Modifier.weight(1f))
                        Text("₹${formatAmount(bucket.value)}", fontSize = 13.sp, fontWeight = FontWeight.Medium)
                        Spacer(Modifier.width(8.dp))
                        Text(
                            String.format("%.1f%%", bucket.percentage),
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun TopHoldingsCard(holdings: List<HoldingItem>) {
    val totalValue = holdings.sumOf { it.currentValue }
    val topHoldings = holdings.sortedByDescending { it.currentValue }.take(5)

    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.BarChart, contentDescription = null, tint = VMColors.Accent, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text("Top Holdings", fontSize = 16.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.height(16.dp))

            topHoldings.forEachIndexed { index, holding ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        "${index + 1}",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.width(20.dp)
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            holding.schemeName,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                            maxLines = 1,
                            lineHeight = 16.sp
                        )
                        val pct = if (totalValue > 0) holding.currentValue / totalValue * 100 else 0.0
                        Text(
                            String.format("%.1f%% of portfolio", pct),
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text("₹${formatAmount(holding.currentValue)}", fontSize = 13.sp, fontWeight = FontWeight.Medium)
                        val isPos = holding.returnsPercentage >= 0
                        Text(
                            String.format("%+.1f%%", holding.returnsPercentage),
                            fontSize = 12.sp,
                            color = if (isPos) VMColors.MarketUp else VMColors.MarketDown
                        )
                    }
                }
                if (index < topHoldings.lastIndex) {
                    HorizontalDivider(modifier = Modifier.padding(vertical = 2.dp))
                }
            }
        }
    }
}

@Composable
private fun GainersLosersCard(holdings: List<HoldingItem>) {
    val gainers = holdings.filter { it.returnsPercentage > 0 }.sortedByDescending { it.returnsPercentage }.take(3)
    val losers = holdings.filter { it.returnsPercentage < 0 }.sortedBy { it.returnsPercentage }.take(3)

    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("Top Gainers & Losers", fontSize = 16.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(12.dp))

            if (gainers.isNotEmpty()) {
                Text("🟢 Top Gainers", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = VMColors.MarketUp)
                Spacer(Modifier.height(6.dp))
                gainers.forEach { h ->
                    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp)) {
                        Text(h.schemeName, fontSize = 12.sp, modifier = Modifier.weight(1f), maxLines = 1)
                        Text(String.format("%+.1f%%", h.returnsPercentage), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = VMColors.MarketUp)
                    }
                }
            }

            if (losers.isNotEmpty()) {
                Spacer(Modifier.height(12.dp))
                Text("🔴 Top Losers", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = VMColors.MarketDown)
                Spacer(Modifier.height(6.dp))
                losers.forEach { h ->
                    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp)) {
                        Text(h.schemeName, fontSize = 12.sp, modifier = Modifier.weight(1f), maxLines = 1)
                        Text(String.format("%+.1f%%", h.returnsPercentage), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = VMColors.MarketDown)
                    }
                }
            }

            if (gainers.isEmpty() && losers.isEmpty()) {
                Text("Add holdings to see gainers and losers", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun RiskSummaryCard(holdings: List<HoldingItem>, summary: PortfolioSummary?) {
    val totalValue = summary?.currentValue ?: holdings.sumOf { it.currentValue }
    val holdingsCount = holdings.size

    // Concentration risk: if top holding > 40% of portfolio
    val topHoldingPct = if (totalValue > 0) {
        (holdings.maxByOrNull { it.currentValue }?.currentValue ?: 0.0) / totalValue * 100
    } else 0.0

    // Diversification score
    val amcCount = holdings.map { extractAmc(it.schemeName) }.distinct().size
    val diversificationLevel = when {
        amcCount >= 5 -> "Good"
        amcCount >= 3 -> "Moderate"
        else -> "Low"
    }

    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Warning, contentDescription = null, tint = Color(0xFFF59E0B), modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text("Risk Summary", fontSize = 16.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.height(16.dp))

            RiskRow("Holdings", "$holdingsCount schemes")
            RiskRow("AMCs", "$amcCount fund houses")
            RiskRow("Diversification", diversificationLevel,
                valueColor = when (diversificationLevel) {
                    "Good" -> VMColors.MarketUp
                    "Moderate" -> Color(0xFFF59E0B)
                    else -> VMColors.MarketDown
                }
            )
            RiskRow("Top Holding Concentration", String.format("%.1f%%", topHoldingPct),
                valueColor = if (topHoldingPct > 40) VMColors.MarketDown else VMColors.MarketUp
            )

            if (topHoldingPct > 40) {
                Spacer(Modifier.height(8.dp))
                Text(
                    "⚠ Your portfolio is highly concentrated. Consider diversifying across more schemes.",
                    fontSize = 12.sp,
                    color = Color(0xFFF59E0B),
                    lineHeight = 16.sp
                )
            }
        }
    }
}

@Composable
private fun RiskRow(label: String, value: String, valueColor: Color = MaterialTheme.colorScheme.onSurface) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.weight(1f))
        Text(value, fontSize = 13.sp, fontWeight = FontWeight.Medium, color = valueColor)
    }
}

private fun extractAmc(schemeName: String): String {
    val name = schemeName.trim()
    val knownAmcs = listOf(
        "HDFC", "ICICI", "SBI", "Axis", "Kotak", "Nippon", "Aditya Birla",
        "UTI", "DSP", "Tata", "Mirae", "Canara", "PGIM", "Motilal",
        "Parag Parikh", "PPFAS", "Quant", "Sundaram", "Franklin", "Bandhan",
        "Edelweiss", "HSBC", "Invesco", "L&T", "Mahindra", "WhiteOak",
        "Baroda", "JM", "ITI", "Trust", "360 ONE", "Bajaj", "Groww",
        "Zerodha", "LIC", "Bank of India"
    )
    return knownAmcs.firstOrNull { name.startsWith(it, ignoreCase = true) }
        ?: name.split(" ").take(2).joinToString(" ")
}

private fun formatAmount(amount: Double): String {
    return when {
        amount >= 10_000_000 -> String.format("%.1f Cr", amount / 10_000_000)
        amount >= 100_000 -> String.format("%.1f L", amount / 100_000)
        amount >= 1_000 -> String.format("%.0f K", amount / 1_000)
        else -> String.format("%.0f", amount)
    }
}
