package com.vmfinancial.android.ui.screens.fuel

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Share
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
import androidx.compose.animation.AnimatedVisibility
import com.vmfinancial.android.services.AllFuelPrices
import com.vmfinancial.android.services.FuelPriceResult
import com.vmfinancial.android.services.FuelPriceService
import com.vmfinancial.android.services.ShareCardService
import com.vmfinancial.android.services.WeatherService
import com.vmfinancial.android.ui.theme.VMColors
import com.vmfinancial.shared.data.api.BackendApi
import com.vmfinancial.shared.data.models.FuelTaxBreakdown
import com.vmfinancial.shared.data.models.FuelSummaryItem
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FuelPriceScreen(onBack: (() -> Unit)? = null) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val fuelService = remember { FuelPriceService(context) }
    val weatherService = remember { WeatherService(context) }

    val api = remember { BackendApi() }

    var fuelPrices by remember { mutableStateOf<AllFuelPrices?>(null) }
    var petrolBreakdown by remember { mutableStateOf<FuelTaxBreakdown?>(null) }
    var dieselBreakdown by remember { mutableStateOf<FuelTaxBreakdown?>(null) }
    var petrolSummary by remember { mutableStateOf<FuelSummaryItem?>(null) }
    var dieselSummary by remember { mutableStateOf<FuelSummaryItem?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var expandedFuel by remember { mutableStateOf<String?>(null) }

    fun fetchTaxBreakup(stateName: String, petrolPrice: Double? = null, dieselPrice: Double? = null) {
        scope.launch {
            try {
                println("FuelPriceScreen: Fetching tax breakup for state='$stateName' petrol=₹$petrolPrice diesel=₹$dieselPrice")
                val backendData = api.getFuelPrices(stateName, petrolPrice = petrolPrice, dieselPrice = dieselPrice)
                petrolBreakdown = backendData.petrol
                dieselBreakdown = backendData.diesel
                petrolSummary = backendData.summary?.petrol
                dieselSummary = backendData.summary?.diesel
                println("FuelPriceScreen: Tax breakup loaded — Petrol retail=₹${backendData.petrol?.retailPrice}, VAT=${backendData.petrol?.vatPercent}%")
            } catch (e: Exception) {
                println("FuelPriceScreen: Tax breakup fetch failed: ${e.message}")
            }
        }
    }

    fun loadPrices() {
        scope.launch {
            isLoading = true
            weatherService.fetchWeatherIfNeeded()
            val state = weatherService.detectedState.value ?: "Delhi"
            val city = weatherService.detectedCity.value
            val district = weatherService.detectedDistrict.value
            val addr = weatherService.fullAddress.value

            when (val result = fuelService.fetchFuelPrices(state, city, district, addr)) {
                is FuelPriceResult.Success -> {
                    fuelPrices = result.prices
                    fetchTaxBreakup(result.prices.stateName, result.prices.petrolPrice, result.prices.dieselPrice)
                }
                is FuelPriceResult.Error -> {
                    fuelPrices = result.cached
                    result.cached?.let { fetchTaxBreakup(it.stateName, it.petrolPrice, it.dieselPrice) }
                }
            }

            isLoading = false
        }
    }

    LaunchedEffect(Unit) { loadPrices() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Fuel Prices", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    if (onBack != null) {
                        IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).background(MaterialTheme.colorScheme.background),
            contentPadding = PaddingValues(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Location header
            item {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.LocationOn, null, tint = VMColors.Accent, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(4.dp))
                        Column {
                            Text(
                                fuelPrices?.let { "${it.cityName}, ${it.stateName}" } ?: if (isLoading) "Detecting location..." else "Location unavailable",
                                fontSize = 14.sp, fontWeight = FontWeight.SemiBold
                            )
                            if (fuelPrices != null) {
                                Text("Updated: ${formatFetchedDate(fuelPrices!!.fetchedAt)}", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                    TextButton(onClick = { loadPrices() }) {
                        Icon(Icons.Default.Edit, null, modifier = Modifier.size(14.dp), tint = VMColors.Accent)
                        Spacer(Modifier.width(4.dp))
                        Text("Refresh", color = VMColors.Accent, fontSize = 12.sp)
                    }
                }
            }

            if (isLoading) {
                item {
                    Box(Modifier.fillMaxWidth().height(200.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = VMColors.Accent)
                    }
                }
            } else if (fuelPrices != null) {
                val fp = fuelPrices!!

                // All 4 fuel type cards (expandable with tax breakup)
                item {
                    val shareService = remember { ShareCardService(context) }
                    FuelDetailCard("Petrol", fp.petrolPrice, fp.petrolChange, fp.petrolUnit ?: "litre",
                        breakdown = petrolBreakdown, summary = petrolSummary,
                        isExpanded = expandedFuel == "Petrol", onToggle = { expandedFuel = if (expandedFuel == "Petrol") null else "Petrol" },
                        onShare = if (petrolBreakdown != null && petrolSummary != null) { {
                            val card = shareService.generateFuelCard(ShareCardService.FuelShareData(
                                fuelType = "Petrol", retailPrice = petrolBreakdown!!.retailPrice,
                                basePrice = petrolBreakdown!!.basePrice, exciseDuty = petrolBreakdown!!.exciseDuty,
                                dealerCommission = petrolBreakdown!!.dealerCommission, vatPercent = petrolBreakdown!!.vatPercent,
                                vatAmount = petrolBreakdown!!.vatAmount, additionalCess = petrolBreakdown!!.additionalCess,
                                totalTaxPercent = petrolSummary!!.totalTaxPercent, centralTaxPercent = petrolSummary!!.centralTaxPercent,
                                stateTaxPercent = petrolSummary!!.stateTaxPercent, totalTax = petrolSummary!!.totalTax,
                                cityName = fp.cityName, stateName = fp.stateName
                            ))
                            shareService.shareBitmap(card, "Petrol Tax Breakup — ${fp.cityName}, ${fp.stateName}")
                        } } else null)
                }
                item {
                    val shareService = remember { ShareCardService(context) }
                    FuelDetailCard("Diesel", fp.dieselPrice, fp.dieselChange, fp.dieselUnit ?: "litre",
                        breakdown = dieselBreakdown, summary = dieselSummary,
                        isExpanded = expandedFuel == "Diesel", onToggle = { expandedFuel = if (expandedFuel == "Diesel") null else "Diesel" },
                        onShare = if (dieselBreakdown != null && dieselSummary != null) { {
                            val card = shareService.generateFuelCard(ShareCardService.FuelShareData(
                                fuelType = "Diesel", retailPrice = dieselBreakdown!!.retailPrice,
                                basePrice = dieselBreakdown!!.basePrice, exciseDuty = dieselBreakdown!!.exciseDuty,
                                dealerCommission = dieselBreakdown!!.dealerCommission, vatPercent = dieselBreakdown!!.vatPercent,
                                vatAmount = dieselBreakdown!!.vatAmount, additionalCess = dieselBreakdown!!.additionalCess,
                                totalTaxPercent = dieselSummary!!.totalTaxPercent, centralTaxPercent = dieselSummary!!.centralTaxPercent,
                                stateTaxPercent = dieselSummary!!.stateTaxPercent, totalTax = dieselSummary!!.totalTax,
                                cityName = fp.cityName, stateName = fp.stateName
                            ))
                            shareService.shareBitmap(card, "Diesel Tax Breakup — ${fp.cityName}, ${fp.stateName}")
                        } } else null)
                }
                item {
                    FuelDetailCard("CNG", fp.cngPrice, fp.cngChange, fp.cngUnit ?: "kg",
                        breakdown = null, summary = null,
                        isExpanded = expandedFuel == "CNG", onToggle = { expandedFuel = if (expandedFuel == "CNG") null else "CNG" })
                }
                item {
                    FuelDetailCard("LPG", fp.lpgPrice, fp.lpgChange, fp.lpgUnit ?: "14.2kg",
                        breakdown = null, summary = null,
                        isExpanded = expandedFuel == "LPG", onToggle = { expandedFuel = if (expandedFuel == "LPG") null else "LPG" })
                }

                // Price comparison table
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text("Price Summary", fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                            Spacer(Modifier.height(12.dp))

                            PriceSummaryRow("Petrol", fp.petrolPrice, fp.petrolChange, fp.petrolUnit ?: "litre")
                            PriceSummaryRow("Diesel", fp.dieselPrice, fp.dieselChange, fp.dieselUnit ?: "litre")
                            PriceSummaryRow("CNG", fp.cngPrice, fp.cngChange, fp.cngUnit ?: "kg")
                            PriceSummaryRow("LPG", fp.lpgPrice, fp.lpgChange, fp.lpgUnit ?: "14.2kg")
                        }
                    }
                }

                // Info note
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                        shape = RoundedCornerShape(10.dp),
                        colors = CardDefaults.cardColors(containerColor = VMColors.Accent.copy(alpha = 0.05f))
                    ) {
                        Text(
                            "Fuel prices in India are revised daily at 6:00 AM. Prices shown are for ${fp.cityName}, ${fp.stateName}. CNG and LPG availability varies by city.",
                            modifier = Modifier.padding(14.dp),
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            lineHeight = 16.sp
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun FuelDetailCard(
    label: String, price: Double?, change: Double?, unit: String,
    breakdown: FuelTaxBreakdown?, summary: FuelSummaryItem?,
    isExpanded: Boolean, onToggle: () -> Unit,
    onShare: (() -> Unit)? = null
) {
    val hasPrice = price != null && price > 0
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).clickable { onToggle() },
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text(label, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                    Text("per $unit", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        if (hasPrice) "\u20B9${String.format("%.2f", price)}" else "N/A",
                        fontSize = 24.sp, fontWeight = FontWeight.Bold,
                        color = if (hasPrice) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    if (change != null && hasPrice) {
                        if (change == 0.0) {
                            Text("No Change", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        } else {
                            val arrow = if (change > 0) "\u25B2" else "\u25BC"
                            val color = if (change > 0) VMColors.MarketDown else VMColors.MarketUp
                            Text(
                                "$arrow \u20B9${String.format("%.2f", kotlin.math.abs(change))}",
                                fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = color
                            )
                        }
                    }
                }
            }

            // Tap hint
            if (!isExpanded) {
                Text("Tap for price breakup", fontSize = 10.sp, color = VMColors.Accent, modifier = Modifier.padding(top = 4.dp))
            }

            // Expandable tax breakup section
            AnimatedVisibility(visible = isExpanded) {
                Column(modifier = Modifier.padding(top = 12.dp)) {
                    HorizontalDivider(modifier = Modifier.padding(bottom = 10.dp))

                    if (breakdown != null && summary != null) {
                        Text("Tax Breakdown", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        Spacer(Modifier.height(8.dp))

                        BreakdownRow("Base Price", breakdown.basePrice)
                        BreakdownRow("Excise Duty (Central)", breakdown.exciseDuty)
                        BreakdownRow("Dealer Commission", breakdown.dealerCommission)
                        BreakdownRow("VAT (${String.format("%.1f", breakdown.vatPercent)}%)", breakdown.vatAmount)
                        if (breakdown.additionalCess > 0) {
                            BreakdownRow("Additional Cess", breakdown.additionalCess)
                        }

                        HorizontalDivider(modifier = Modifier.padding(vertical = 6.dp))
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Retail Price", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            Text("\u20B9${String.format("%.2f", breakdown.retailPrice)}", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = VMColors.Accent)
                        }

                        Spacer(Modifier.height(8.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                            Text("Central Tax: ${String.format("%.1f", summary.centralTaxPercent)}%", fontSize = 11.sp, color = Color(0xFFEF4444))
                            Text("State Tax: ${String.format("%.1f", summary.stateTaxPercent)}%", fontSize = 11.sp, color = Color(0xFFF59E0B))
                        }
                        Text("Total Tax: ${String.format("%.1f", summary.totalTaxPercent)}% (\u20B9${String.format("%.2f", summary.totalTax)})", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 2.dp))

                        if (onShare != null) {
                            Spacer(Modifier.height(12.dp))
                            OutlinedButton(
                                onClick = onShare,
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(8.dp),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = VMColors.Accent)
                            ) {
                                Icon(Icons.Filled.Share, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(6.dp))
                                Text("Share Tax Breakup", fontSize = 12.sp)
                            }
                        }
                    } else {
                        Text("Tax breakup not available for $label", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
}

@Composable
private fun BreakdownRow(label: String, amount: Double) {
    Row(Modifier.fillMaxWidth().padding(vertical = 3.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text("\u20B9${String.format("%.2f", amount)}", fontSize = 12.sp)
    }
}

@Composable
private fun PriceSummaryRow(label: String, price: Double?, change: Double?, unit: String) {
    val hasPrice = price != null && price > 0
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                if (hasPrice) "\u20B9${String.format("%.2f", price)}/$unit" else "N/A",
                fontSize = 14.sp, fontWeight = FontWeight.SemiBold
            )
            if (change != null) {
                Spacer(Modifier.width(8.dp))
                if (change == 0.0) {
                    Text("No Change", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurfaceVariant)
                } else {
                    val isUp = change > 0
                    Text(
                        "${if (isUp) "+" else ""}${String.format("%.2f", change)}",
                        fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
                        color = if (isUp) VMColors.MarketDown else VMColors.MarketUp
                    )
                }
            }
        }
    }
    HorizontalDivider(color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.08f))
}

private fun formatFetchedDate(fetchedAtMs: Long): String {
    if (fetchedAtMs <= 0) return "Unknown"
    val fetched = Calendar.getInstance().apply { timeInMillis = fetchedAtMs }
    val now = Calendar.getInstance()

    val isToday = now.get(Calendar.YEAR) == fetched.get(Calendar.YEAR) &&
            now.get(Calendar.DAY_OF_YEAR) == fetched.get(Calendar.DAY_OF_YEAR)

    val yesterday = Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, -1) }
    val isYesterday = yesterday.get(Calendar.YEAR) == fetched.get(Calendar.YEAR) &&
            yesterday.get(Calendar.DAY_OF_YEAR) == fetched.get(Calendar.DAY_OF_YEAR)

    return when {
        isToday -> "Today, ${SimpleDateFormat("h:mm a", Locale.US).format(fetched.time)}"
        isYesterday -> "Yesterday"
        else -> SimpleDateFormat("dd MMM yyyy", Locale.US).format(fetched.time)
    }
}
