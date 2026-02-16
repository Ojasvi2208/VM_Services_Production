package com.vmfinancial.android.ui.screens.funds

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.vmfinancial.android.services.FundDetailCache
import com.vmfinancial.android.ui.theme.NumberFontFamily
import com.vmfinancial.android.ui.theme.VMColors
import com.vmfinancial.shared.data.api.BackendApi
import com.vmfinancial.shared.data.models.FundSearchItem
import com.vmfinancial.shared.data.models.MutualFund
import com.vmfinancial.shared.data.repository.HomeRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.net.URLEncoder

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FundsScreen(navController: NavController? = null) {
    val api = remember { BackendApi() }
    val scope = rememberCoroutineScope()

    var selectedCategory by remember { mutableIntStateOf(0) }
    val categories = listOf("Equity", "Debt", "Hybrid", "Index", "Liquid")
    var searchText by remember { mutableStateOf("") }
    var isSearching by remember { mutableStateOf(false) }
    var searchResults by remember { mutableStateOf<List<FundSearchItem>>(emptyList()) }
    var searchJob by remember { mutableStateOf<Job?>(null) }

    // Category-filtered funds from API (top 25 by 1Y returns)
    var categoryFunds by remember { mutableStateOf<List<FundSearchItem>>(emptyList()) }
    var isCategoryLoading by remember { mutableStateOf(false) }

    // Load category funds when filter changes (top 25 per category, sorted by return)
    LaunchedEffect(selectedCategory) {
        isCategoryLoading = true
        categoryFunds = emptyList()
        try {
            val catName = categories[selectedCategory]
            val result = api.searchFundsByCategory(category = catName, limit = 25)
            categoryFunds = result.funds
        } catch (_: Exception) {
            categoryFunds = emptyList()
        }
        isCategoryLoading = false
    }

    // Debounced search — loosened: search from 1 char, 300ms delay
    LaunchedEffect(searchText) {
        if (searchText.isNotBlank()) {
            searchJob?.cancel()
            searchJob = scope.launch {
                delay(300)
                isSearching = true
                try {
                    val result = api.searchFunds(searchText.trim())
                    searchResults = result.funds
                } catch (_: Exception) {
                    searchResults = emptyList()
                }
                isSearching = false
            }
        } else {
            searchResults = emptyList()
        }
    }

    val showingSearch = searchText.isNotBlank()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Discover Funds", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(MaterialTheme.colorScheme.background)
        ) {
            // Search bar
            OutlinedTextField(
                value = searchText,
                onValueChange = { searchText = it },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                placeholder = { Text("Search funds by name or AMC...", fontSize = 14.sp) },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(20.dp)) },
                trailingIcon = {
                    if (searchText.isNotEmpty()) {
                        IconButton(onClick = { searchText = ""; searchResults = emptyList() }) {
                            Icon(Icons.Default.Close, contentDescription = null, modifier = Modifier.size(18.dp))
                        }
                    }
                },
                shape = RoundedCornerShape(10.dp),
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = VMColors.Accent,
                    unfocusedBorderColor = MaterialTheme.colorScheme.outline
                )
            )

            if (showingSearch) {
                // Live search results
                if (isSearching) {
                    ShimmerFundList(count = 5)
                } else if (searchResults.isEmpty()) {
                    Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                        Text("No funds found for \"$searchText\"", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                } else {
                    // Group search results by master fund family
                    val grouped = remember(searchResults) { groupByFamily(searchResults) }
                    Text("${grouped.size} fund families (${searchResults.size} variants)",
                        fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp))
                    LazyColumn(
                        contentPadding = PaddingValues(bottom = 24.dp),
                        verticalArrangement = Arrangement.spacedBy(1.dp)
                    ) {
                        items(grouped, key = { it.masterName }) { family ->
                            LaunchedEffect(family.bestVariant.schemeCode) {
                                FundDetailCache.prefetch(family.bestVariant.schemeCode)
                            }
                            FundFamilyCard(
                                family = family,
                                onVariantClick = { fund ->
                                    val encodedName = URLEncoder.encode(fund.name, "UTF-8")
                                    navController?.navigate("fund_detail/${fund.schemeCode}/$encodedName")
                                }
                            )
                        }
                    }
                }
            } else {
                // Category chips
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    categories.forEachIndexed { index, label ->
                        FilterChip(
                            selected = selectedCategory == index,
                            onClick = { selectedCategory = index },
                            label = { Text(label, fontSize = 13.sp) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = VMColors.Accent,
                                selectedLabelColor = Color.White
                            ),
                            shape = RoundedCornerShape(20.dp)
                        )
                    }
                }

                // Category funds list (top 25 by 1Y return)
                if (isCategoryLoading) {
                    ShimmerFundList(count = 8)
                } else if (categoryFunds.isEmpty()) {
                    Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                        Text("No ${categories[selectedCategory]} funds found", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                } else {
                    Text(
                        "Top ${categoryFunds.size} ${categories[selectedCategory]} funds by 3Y CAGR",
                        fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                    )
                    LazyColumn(
                        contentPadding = PaddingValues(bottom = 24.dp),
                        verticalArrangement = Arrangement.spacedBy(1.dp)
                    ) {
                        itemsIndexed(categoryFunds, key = { _, f -> f.schemeCode }) { index, fund ->
                            CategoryFundRow(rank = index + 1, fund = fund, onClick = {
                                val encodedName = URLEncoder.encode(fund.name, "UTF-8")
                                navController?.navigate("fund_detail/${fund.schemeCode}/$encodedName")
                            })
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SearchResultRow(fund: FundSearchItem, onClick: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(fund.name, fontSize = 13.sp, fontWeight = FontWeight.Medium, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(2.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(fund.fundHouse, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                if (fund.nav != null) {
                    Text("NAV: ${String.format("%.2f", fund.nav)}", fontSize = 11.sp, color = VMColors.Accent, fontWeight = FontWeight.SemiBold, fontFamily = NumberFontFamily)
                }
            }
        }
        val searchCagr = fund.cagr3y ?: fund.cagr5y
        searchCagr?.let { ret ->
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    String.format("%+.1f%%", ret),
                    fontSize = 13.sp, fontWeight = FontWeight.Bold,
                    color = if (ret >= 0) VMColors.MarketUp else VMColors.MarketDown,
                    fontFamily = NumberFontFamily
                )
                Text(if (fund.cagr3y != null) "3Y" else "5Y", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Spacer(Modifier.width(4.dp))
        }
        Icon(Icons.Default.ChevronRight, contentDescription = null, modifier = Modifier.size(16.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
}

@Composable
private fun CategoryFundRow(rank: Int, fund: FundSearchItem, onClick: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            "$rank",
            fontSize = 14.sp, fontWeight = FontWeight.Bold,
            color = if (rank <= 3) VMColors.Accent else MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(28.dp)
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(fund.name, fontSize = 13.sp, fontWeight = FontWeight.Medium, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(2.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(fund.fundHouse, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                if (fund.nav != null) {
                    Text("₹${String.format("%.2f", fund.nav)}", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, fontFamily = NumberFontFamily)
                }
            }
        }
        val cagr = fund.cagr3y ?: fund.cagr5y
        val cagrLabel = if (fund.cagr3y != null) "3Y CAGR" else "5Y CAGR"
        cagr?.let { ret ->
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    String.format("%+.1f%%", ret),
                    fontSize = 14.sp, fontWeight = FontWeight.Bold,
                    color = if (ret >= 0) VMColors.MarketUp else VMColors.MarketDown,
                    fontFamily = NumberFontFamily
                )
                Text(cagrLabel, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        Spacer(Modifier.width(4.dp))
        Icon(Icons.Default.ChevronRight, contentDescription = null, modifier = Modifier.size(14.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
}

@Composable
private fun FundCategorySection(title: String, subtitle: String, funds: List<MutualFund>, navController: NavController? = null, onSeeAll: () -> Unit = {}) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(title, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                Text(subtitle, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Spacer(Modifier.weight(1f))
            TextButton(onClick = onSeeAll) {
                Text("See All", fontSize = 12.sp, color = VMColors.Accent)
            }
        }

        Card(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Column {
                funds.take(5).forEachIndexed { index, fund ->
                    FundListRow(rank = index + 1, fund = fund, onClick = {
                        val encodedName = URLEncoder.encode(fund.schemeName, "UTF-8")
                        navController?.navigate("fund_detail/${fund.schemeCode}/$encodedName")
                    })
                    if (index < minOf(4, funds.size - 1)) {
                        HorizontalDivider(modifier = Modifier.padding(start = 50.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun FundListRow(rank: Int, fund: MutualFund, onClick: () -> Unit = {}) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable { onClick() }.padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            "$rank",
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            color = if (rank <= 3) VMColors.Accent else MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(24.dp)
        )

        Spacer(Modifier.width(10.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(fund.schemeName, fontSize = 13.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(fund.fundHouse, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                // Rating stars
                Row(horizontalArrangement = Arrangement.spacedBy(1.dp)) {
                    repeat(5) { i ->
                        Icon(
                            if (i < 3) Icons.Filled.Star else Icons.Outlined.Star,
                            contentDescription = null,
                            modifier = Modifier.size(10.dp),
                            tint = if (i < 3) Color(0xFFF59E0B) else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.3f)
                        )
                    }
                }
            }
        }

        fund.returns?.let { returns ->
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    returns.formatReturn(returns.return1Y),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = if ((returns.return1Y ?: 0.0) >= 0) VMColors.MarketUp else VMColors.MarketDown,
                    fontFamily = NumberFontFamily
                )
                Text("1Y Return", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }

        Spacer(Modifier.width(4.dp))
        Icon(Icons.Default.ChevronRight, contentDescription = null, modifier = Modifier.size(14.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun SubCategoryGrid(items: List<Pair<String, String>>) {
    Column(
        modifier = Modifier.padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items.chunked(3).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { (name, emoji) ->
                    Card(
                        modifier = Modifier.weight(1f).clickable { },
                        shape = RoundedCornerShape(10.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp).fillMaxWidth(),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(emoji, fontSize = 20.sp)
                            Spacer(Modifier.height(4.dp))
                            Text(name, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                        }
                    }
                }
                repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

// ════════════════════════════════════════════════════════════════════
//  SHIMMER SKELETON — matches SearchResultRow / CategoryFundRow exactly
// ════════════════════════════════════════════════════════════════════

@Composable
private fun ShimmerFundList(count: Int = 5) {
    val shimmerColors = listOf(
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)
    )
    val transition = rememberInfiniteTransition(label = "fundShimmer")
    val translateAnim by transition.animateFloat(
        initialValue = 0f, targetValue = 1200f,
        animationSpec = infiniteRepeatable(tween(1200, easing = LinearEasing), RepeatMode.Restart),
        label = "shimmerTranslate"
    )
    val brush = Brush.linearGradient(
        colors = shimmerColors,
        start = Offset(translateAnim - 400f, 0f),
        end = Offset(translateAnim, 0f)
    )

    Column {
        repeat(count) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Box(Modifier.fillMaxWidth(0.75f).height(14.dp).clip(RoundedCornerShape(4.dp)).background(brush))
                    Spacer(Modifier.height(6.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(Modifier.width(80.dp).height(11.dp).clip(RoundedCornerShape(4.dp)).background(brush))
                        Box(Modifier.width(55.dp).height(11.dp).clip(RoundedCornerShape(4.dp)).background(brush))
                    }
                }
                Column(horizontalAlignment = Alignment.End) {
                    Box(Modifier.width(48.dp).height(14.dp).clip(RoundedCornerShape(4.dp)).background(brush))
                    Spacer(Modifier.height(4.dp))
                    Box(Modifier.width(24.dp).height(10.dp).clip(RoundedCornerShape(4.dp)).background(brush))
                }
            }
            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
        }
    }
}

// ════════════════════════════════════════════════════════════════════
//  FUND FAMILY GROUPING — collapse variants into a single card
// ════════════════════════════════════════════════════════════════════

private data class FundFamily(
    val masterName: String,
    val fundHouse: String,
    val variants: List<FundSearchItem>,
    val bestVariant: FundSearchItem,
    val minReturn: Double?,
    val maxReturn: Double?
)

private fun groupByFamily(funds: List<FundSearchItem>): List<FundFamily> {
    // Strip plan/option suffixes to get the "master" fund name
    fun masterKey(item: FundSearchItem): String {
        return item.schemeName.uppercase()
            .replace(Regex("\\s*-?\\s*(DIRECT|REGULAR)\\s*(PLAN)?"), "")
            .replace(Regex("\\s*-?\\s*(GROWTH|IDCW|DIVIDEND)\\s*(OPTION|PAYOUT|REINVESTMENT)?"), "")
            .replace(Regex("\\s+"), " ").trim().removeSuffix("-").trim()
    }
    return funds.groupBy { masterKey(it) }
        .map { (key, variants) ->
            val returns = variants.mapNotNull { it.cagr3y ?: it.cagr5y }
            val best = variants.maxByOrNull { it.cagr3y ?: it.cagr5y ?: -999.0 } ?: variants.first()
            FundFamily(
                masterName = key.lowercase().replaceFirstChar { it.uppercase() }.let { best.name },
                fundHouse = best.fundHouse,
                variants = variants,
                bestVariant = best,
                minReturn = returns.minOrNull(),
                maxReturn = returns.maxOrNull()
            )
        }
        .sortedByDescending { it.bestVariant.cagr3y ?: it.bestVariant.cagr5y ?: -999.0 }
}

@Composable
private fun FundFamilyCard(family: FundFamily, onVariantClick: (FundSearchItem) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    val hasMultiple = family.variants.size > 1

    Column {
        // Master card row
        Row(
            modifier = Modifier.fillMaxWidth()
                .clickable {
                    if (hasMultiple) expanded = !expanded
                    else onVariantClick(family.bestVariant)
                }
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(family.masterName, fontSize = 13.sp, fontWeight = FontWeight.Medium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(2.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(family.fundHouse, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                    if (hasMultiple) {
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = VMColors.Accent.copy(alpha = 0.1f)
                        ) {
                            Text(
                                "${family.variants.size} plans",
                                fontSize = 10.sp, fontWeight = FontWeight.SemiBold,
                                color = VMColors.Accent,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }
                }
            }

            // Return range or single return
            Column(horizontalAlignment = Alignment.End) {
                if (family.minReturn != null && family.maxReturn != null && family.minReturn != family.maxReturn) {
                    Text(
                        "${String.format("%+.1f", family.minReturn)}…${String.format("%+.1f%%", family.maxReturn)}",
                        fontSize = 13.sp, fontWeight = FontWeight.Bold, fontFamily = NumberFontFamily,
                        color = if ((family.maxReturn) >= 0) VMColors.MarketUp else VMColors.MarketDown
                    )
                } else {
                    val ret = family.bestVariant.cagr3y ?: family.bestVariant.cagr5y
                    ret?.let {
                        Text(
                            String.format("%+.1f%%", it),
                            fontSize = 13.sp, fontWeight = FontWeight.Bold, fontFamily = NumberFontFamily,
                            color = if (it >= 0) VMColors.MarketUp else VMColors.MarketDown
                        )
                    }
                }
                Text(
                    if (family.bestVariant.cagr3y != null) "3Y CAGR" else "5Y CAGR",
                    fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Spacer(Modifier.width(4.dp))
            Icon(
                if (hasMultiple) {
                    if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore
                } else Icons.Default.ChevronRight,
                contentDescription = null, modifier = Modifier.size(16.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))

        // Expanded variant list
        AnimatedVisibility(
            visible = expanded,
            enter = expandVertically(spring(dampingRatio = 0.8f)) + fadeIn(),
            exit = shrinkVertically(spring(dampingRatio = 0.8f)) + fadeOut()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.15f))
            ) {
                family.variants.forEach { variant ->
                    val planTag = when {
                        variant.schemeName.contains("Direct", true) -> "Direct"
                        variant.schemeName.contains("Regular", true) -> "Regular"
                        else -> ""
                    }
                    val optionTag = when {
                        variant.schemeName.contains("IDCW", true) || variant.schemeName.contains("Dividend", true) -> "IDCW"
                        variant.schemeName.contains("Growth", true) -> "Growth"
                        else -> ""
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth()
                            .clickable { onVariantClick(variant) }
                            .padding(horizontal = 28.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(modifier = Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            if (planTag.isNotBlank()) {
                                val isDirect = planTag == "Direct"
                                Surface(
                                    shape = RoundedCornerShape(4.dp),
                                    color = if (isDirect) VMColors.Accent.copy(alpha = 0.12f) else MaterialTheme.colorScheme.surfaceVariant
                                ) {
                                    Text(
                                        planTag, fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
                                        color = if (isDirect) VMColors.Accent else MaterialTheme.colorScheme.onSurfaceVariant,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                    )
                                }
                            }
                            if (optionTag.isNotBlank()) {
                                Surface(
                                    shape = RoundedCornerShape(4.dp),
                                    color = MaterialTheme.colorScheme.surfaceVariant
                                ) {
                                    Text(
                                        optionTag, fontSize = 11.sp, fontWeight = FontWeight.Medium,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                    )
                                }
                            }
                            variant.nav?.let {
                                Text(
                                    "₹${String.format("%.2f", it)}", fontSize = 11.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    fontFamily = NumberFontFamily
                                )
                            }
                        }
                        val ret = variant.cagr3y ?: variant.cagr5y
                        ret?.let {
                            Text(
                                String.format("%+.1f%%", it),
                                fontSize = 12.sp, fontWeight = FontWeight.Bold, fontFamily = NumberFontFamily,
                                color = if (it >= 0) VMColors.MarketUp else VMColors.MarketDown
                            )
                        }
                        Spacer(Modifier.width(4.dp))
                        Icon(Icons.Default.ChevronRight, contentDescription = null, modifier = Modifier.size(14.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    HorizontalDivider(modifier = Modifier.padding(horizontal = 28.dp), color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.04f))
                }
            }
        }
    }
}
