package com.vmfinancial.android.ui.screens.expenses

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.ArrowDropUp
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vmfinancial.android.data.db.AkshayaDatabase
import com.vmfinancial.android.data.db.CategorySum
import com.vmfinancial.android.data.db.DailySummaryEntity
import com.vmfinancial.android.data.db.TransactionEntity
import com.vmfinancial.android.services.SmsTransactionParser
import com.vmfinancial.android.ui.theme.VMColors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.*

// ════════════════════════════════════════════════════════════════════
//  EXPENSES SCREEN — Privacy-first spending tracker
//  All data from local Room DB. Nothing ever leaves the device.
// ════════════════════════════════════════════════════════════════════

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExpensesScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val dao = remember { AkshayaDatabase.getInstance(context).transactionDao() }

    val dateFormat = remember { SimpleDateFormat("yyyy-MM-dd", Locale.US) }
    val monthFormat = remember { SimpleDateFormat("yyyy-MM", Locale.US) }
    val displayDateFormat = remember { SimpleDateFormat("dd MMM", Locale.US) }
    val displayMonthFormat = remember { SimpleDateFormat("MMMM yyyy", Locale.US) }

    var selectedTab by remember { mutableIntStateOf(0) } // 0=Today, 1=Week, 2=Month
    val tabs = listOf("Today", "This Week", "This Month")

    // Data states
    var todaySpent by remember { mutableStateOf(0.0) }
    var todayReceived by remember { mutableStateOf(0.0) }
    var todayTxns by remember { mutableStateOf<List<TransactionEntity>>(emptyList()) }
    var categoryBreakdown by remember { mutableStateOf<List<CategorySum>>(emptyList()) }
    var weeklySpent by remember { mutableStateOf(0.0) }
    var monthlySpent by remember { mutableStateOf(0.0) }
    var discretionarySpend by remember { mutableStateOf(0.0) }
    var dailySummaries by remember { mutableStateOf<List<DailySummaryEntity>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

    // Load data based on selected tab
    LaunchedEffect(selectedTab) {
        isLoading = true
        withContext(Dispatchers.IO) {
            val cal = Calendar.getInstance()
            val today = dateFormat.format(cal.time)

            when (selectedTab) {
                0 -> { // Today
                    todaySpent = dao.totalSpentOnDate(today)
                    todayReceived = dao.totalReceivedOnDate(today)
                    todayTxns = dao.transactionsByDate(today)
                    categoryBreakdown = dao.categoryBreakdown(today, today)
                }
                1 -> { // This Week (Mon-Today)
                    cal.set(Calendar.DAY_OF_WEEK, Calendar.MONDAY)
                    val weekStart = dateFormat.format(cal.time)
                    cal.time = Date()
                    val weekEnd = dateFormat.format(cal.time)
                    weeklySpent = dao.totalSpentOnDate(weekStart).let { 0.0 } // placeholder
                    val txns = dao.transactionsBetween(weekStart, weekEnd)
                    todayTxns = txns
                    weeklySpent = txns.filter { it.transactionType == "DEBIT" }.sumOf { it.amount }
                    todayReceived = txns.filter { it.transactionType == "CREDIT" }.sumOf { it.amount }
                    categoryBreakdown = dao.categoryBreakdown(weekStart, weekEnd)
                    discretionarySpend = dao.discretionarySpendBetween(weekStart, weekEnd)
                    dailySummaries = dao.dailySummariesBetween(weekStart, weekEnd)
                }
                2 -> { // This Month
                    val monthStart = "${monthFormat.format(cal.time)}-01"
                    val monthEnd = dateFormat.format(cal.time)
                    val txns = dao.transactionsBetween(monthStart, monthEnd)
                    todayTxns = txns
                    monthlySpent = txns.filter { it.transactionType == "DEBIT" }.sumOf { it.amount }
                    todayReceived = txns.filter { it.transactionType == "CREDIT" }.sumOf { it.amount }
                    categoryBreakdown = dao.categoryBreakdown(monthStart, monthEnd)
                    discretionarySpend = dao.discretionarySpendBetween(monthStart, monthEnd)
                    dailySummaries = dao.dailySummariesBetween(monthStart, monthEnd)
                }
            }
        }
        isLoading = false
    }

    val totalSpent = when (selectedTab) {
        0 -> todaySpent
        1 -> weeklySpent
        else -> monthlySpent
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Expenses", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent)
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(bottom = 32.dp)
        ) {
            // ── Tab selector ──
            item {
                TabRow(
                    selectedTabIndex = selectedTab,
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)
                        .clip(RoundedCornerShape(12.dp)),
                    containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                    contentColor = VMColors.Accent,
                    indicator = {},
                    divider = {}
                ) {
                    tabs.forEachIndexed { i, title ->
                        Tab(
                            selected = selectedTab == i,
                            onClick = { selectedTab = i },
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(
                                    if (selectedTab == i) VMColors.Accent
                                    else Color.Transparent
                                )
                        ) {
                            Text(
                                title,
                                modifier = Modifier.padding(vertical = 10.dp),
                                fontSize = 13.sp,
                                fontWeight = if (selectedTab == i) FontWeight.SemiBold else FontWeight.Normal,
                                color = if (selectedTab == i) Color.White
                                else MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }

            // ── Hero: Total Spent ──
            item {
                SpendHeroCard(totalSpent, todayReceived, selectedTab, discretionarySpend)
            }

            // ── Category Breakdown ──
            if (categoryBreakdown.isNotEmpty()) {
                item {
                    SectionHeader("Spending Breakdown")
                }
                item {
                    CategoryBreakdownCard(categoryBreakdown, totalSpent)
                }
            }

            // ── Insight Card (if discretionary > 0) ──
            if (discretionarySpend > 500 && selectedTab > 0) {
                item {
                    InsightCard(discretionarySpend, selectedTab)
                }
            }

            // ── Transaction list ──
            item {
                SectionHeader(
                    when (selectedTab) {
                        0 -> "Today's Transactions"
                        1 -> "This Week's Transactions"
                        else -> "This Month's Transactions"
                    }
                )
            }

            if (todayTxns.isEmpty() && !isLoading) {
                item {
                    EmptyState()
                }
            } else {
                items(todayTxns) { txn ->
                    TransactionRow(txn, displayDateFormat)
                }
            }
        }
    }
}

// ════════════════════════════════════════════════════════════════════
//  SPEND HERO CARD
// ════════════════════════════════════════════════════════════════════

@Composable
private fun SpendHeroCard(
    totalSpent: Double,
    totalReceived: Double,
    tabIndex: Int,
    discretionary: Double
) {
    Surface(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp),
        shape = RoundedCornerShape(16.dp),
        color = VMColors.Primary
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Text(
                when (tabIndex) {
                    0 -> "Today's Spend"
                    1 -> "This Week"
                    else -> "This Month"
                },
                fontSize = 13.sp, color = VMColors.TextTertiary
            )
            Spacer(Modifier.height(4.dp))

            // Total spent
            Text(
                formatAmount(totalSpent),
                fontSize = 36.sp, fontWeight = FontWeight.Bold,
                color = Color.White, letterSpacing = (-1).sp
            )

            Spacer(Modifier.height(12.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                // Received
                if (totalReceived > 0) {
                    MiniMetric(
                        label = "Received",
                        value = formatAmount(totalReceived),
                        color = VMColors.MarketUp
                    )
                }
                // Discretionary
                if (discretionary > 0 && tabIndex > 0) {
                    MiniMetric(
                        label = "Luxuries",
                        value = formatAmount(discretionary),
                        color = VMColors.Warning
                    )
                }
            }
        }
    }
}

@Composable
private fun MiniMetric(label: String, value: String, color: Color) {
    Column {
        Text(label, fontSize = 11.sp, color = VMColors.TextTertiary)
        Text(value, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = color)
    }
}

// ════════════════════════════════════════════════════════════════════
//  CATEGORY BREAKDOWN
// ════════════════════════════════════════════════════════════════════

@Composable
private fun CategoryBreakdownCard(categories: List<CategorySum>, total: Double) {
    val categoryColors = mapOf(
        "coffee" to Color(0xFF8B4513),
        "alcohol" to Color(0xFFDAA520),
        "dining" to Color(0xFFFF6347),
        "shopping" to Color(0xFF4169E1),
        "entertainment" to Color(0xFF9370DB),
        "ride" to Color(0xFF20B2AA),
        "subscription" to Color(0xFFFF69B4),
        "grocery" to Color(0xFF32CD32),
        "fuel" to Color(0xFFFF8C00),
        "medical" to Color(0xFFDC143C),
        "utility" to Color(0xFF708090),
        "emi" to Color(0xFF2F4F4F),
        "transfer" to Color(0xFF4682B4),
        "uncategorized" to Color(0xFFA9A9A9)
    )

    Surface(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 4.dp),
        shape = RoundedCornerShape(14.dp),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 1.dp
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            categories.take(6).forEach { cat ->
                val pct = if (total > 0) (cat.total / total * 100) else 0.0
                val emoji = SmsTransactionParser.CATEGORY_EMOJI[cat.category] ?: ""
                val color = categoryColors[cat.category] ?: VMColors.TextSecondary

                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(emoji, fontSize = 18.sp)
                    Spacer(Modifier.width(10.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            cat.category.replaceFirstChar { it.uppercase() },
                            fontSize = 13.sp, fontWeight = FontWeight.Medium
                        )
                        Spacer(Modifier.height(4.dp))
                        // Progress bar
                        Box(
                            modifier = Modifier.fillMaxWidth().height(6.dp)
                                .clip(RoundedCornerShape(3.dp))
                                .background(MaterialTheme.colorScheme.surfaceVariant)
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth(fraction = (pct / 100f).toFloat().coerceIn(0f, 1f))
                                    .fillMaxHeight()
                                    .clip(RoundedCornerShape(3.dp))
                                    .background(color)
                            )
                        }
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(horizontalAlignment = Alignment.End) {
                        Text(
                            formatAmount(cat.total),
                            fontSize = 13.sp, fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            "${String.format("%.0f", pct)}%",
                            fontSize = 11.sp, color = VMColors.TextTertiary
                        )
                    }
                }
            }
        }
    }
}

// ════════════════════════════════════════════════════════════════════
//  INSIGHT CARD — The "Legacy Angle"
// ════════════════════════════════════════════════════════════════════

@Composable
private fun InsightCard(discretionary: Double, tabIndex: Int) {
    val sipAmount = if (tabIndex == 1) discretionary / 4 else discretionary // weekly→monthly SIP
    val growth5Y = SmsTransactionParser.projectGrowth(sipAmount, 5)
    val growth10Y = SmsTransactionParser.projectGrowth(sipAmount, 10)
    val period = if (tabIndex == 1) "week" else "month"

    Surface(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp),
        shape = RoundedCornerShape(14.dp),
        color = VMColors.Accent.copy(alpha = 0.08f),
        border = null
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                "Akshaya Legacy Insight",
                fontSize = 14.sp, fontWeight = FontWeight.Bold,
                color = VMColors.Accent
            )
            Spacer(Modifier.height(8.dp))
            Text(
                buildString {
                    append("You spent ${formatAmount(discretionary)} on luxuries this $period. ")
                    append("If ${formatAmount(sipAmount)}/month went into a SIP:\n\n")
                    append("  5 years  →  $growth5Y\n")
                    append("  10 years →  $growth10Y\n\n")
                    append("Your father's discipline. Your legacy.")
                },
                fontSize = 13.sp, lineHeight = 20.sp,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f)
            )
        }
    }
}

// ════════════════════════════════════════════════════════════════════
//  TRANSACTION ROW
// ════════════════════════════════════════════════════════════════════

@Composable
private fun TransactionRow(txn: TransactionEntity, dateFormat: SimpleDateFormat) {
    val emoji = SmsTransactionParser.CATEGORY_EMOJI[txn.category] ?: ""
    val isDebit = txn.transactionType == "DEBIT"

    Surface(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 3.dp),
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 0.5.dp
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Category emoji circle
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(
                        if (isDebit) VMColors.MarketDown.copy(alpha = 0.1f)
                        else VMColors.MarketUp.copy(alpha = 0.1f)
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text(emoji.ifEmpty { if (isDebit) "↗" else "↙" }, fontSize = 18.sp)
            }

            Spacer(Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    txn.merchant.take(30),
                    fontSize = 14.sp, fontWeight = FontWeight.Medium,
                    maxLines = 1, overflow = TextOverflow.Ellipsis
                )
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        txn.category.replaceFirstChar { it.uppercase() },
                        fontSize = 11.sp, color = VMColors.TextTertiary
                    )
                    if (txn.accountTail.isNotBlank()) {
                        Text("••${txn.accountTail}", fontSize = 11.sp, color = VMColors.TextTertiary)
                    }
                }
            }

            // Amount
            Text(
                "${if (isDebit) "-" else "+"}${formatAmount(txn.amount)}",
                fontSize = 15.sp, fontWeight = FontWeight.SemiBold,
                color = if (isDebit) VMColors.MarketDown else VMColors.MarketUp
            )
        }
    }
}

// ════════════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════════════

@Composable
private fun SectionHeader(title: String) {
    Text(
        title,
        modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp),
        fontSize = 15.sp, fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.onSurface
    )
}

@Composable
private fun EmptyState() {
    Column(
        modifier = Modifier.fillMaxWidth().padding(40.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("📭", fontSize = 48.sp)
        Spacer(Modifier.height(12.dp))
        Text(
            "No transactions detected yet",
            fontSize = 15.sp, fontWeight = FontWeight.Medium,
            textAlign = TextAlign.Center
        )
        Spacer(Modifier.height(4.dp))
        Text(
            "Bank SMS messages will appear here automatically.\nGrant SMS permission to get started.",
            fontSize = 12.sp, color = VMColors.TextTertiary,
            textAlign = TextAlign.Center, lineHeight = 18.sp
        )
    }
}

private fun formatAmount(amount: Double): String {
    return when {
        amount >= 1_00_000 -> String.format("₹%.1fL", amount / 1_00_000)
        amount >= 1_000 -> String.format("₹%.1fK", amount / 1_000)
        amount == amount.toLong().toDouble() -> String.format("₹%.0f", amount)
        else -> String.format("₹%.2f", amount)
    }
}
