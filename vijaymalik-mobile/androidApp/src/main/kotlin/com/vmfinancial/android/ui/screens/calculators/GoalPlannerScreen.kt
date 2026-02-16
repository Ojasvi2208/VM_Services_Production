package com.vmfinancial.android.ui.screens.calculators

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vmfinancial.android.ui.theme.VMColors
import java.text.NumberFormat
import java.util.Locale
import kotlin.math.pow

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GoalPlannerScreen(onBack: () -> Unit) {
    var goalAmount by remember { mutableFloatStateOf(5000000f) }
    var annualReturn by remember { mutableFloatStateOf(12f) }
    var durationYears by remember { mutableFloatStateOf(15f) }

    val months = (durationYears * 12).toInt()
    val monthlyRate = annualReturn.toDouble() / 12.0 / 100.0

    // Reverse SIP formula: PMT = FV * r / ((1+r)^n - 1) / (1+r)
    val requiredSIP = if (monthlyRate > 0 && months > 0) {
        goalAmount.toDouble() * monthlyRate / ((1 + monthlyRate).pow(months) - 1) / (1 + monthlyRate)
    } else if (months > 0) {
        goalAmount.toDouble() / months
    } else 0.0

    // Reverse lumpsum formula: PV = FV / (1+r)^n
    val requiredLumpsum = goalAmount.toDouble() / (1.0 + annualReturn.toDouble() / 100.0).pow(durationYears.toDouble())

    val totalSIPInvested = requiredSIP * months
    val sipGains = goalAmount.toDouble() - totalSIPInvested
    val lumpsumGains = goalAmount.toDouble() - requiredLumpsum

    val formatter = NumberFormat.getNumberInstance(Locale("en", "IN"))

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Goal Planner", fontWeight = FontWeight.Bold) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // Goal Target Display
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = VMColors.Accent.copy(alpha = 0.08f))
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("Your Goal", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(
                        "₹${formatter.format(goalAmount.toLong())}",
                        fontSize = 28.sp, fontWeight = FontWeight.Bold, color = VMColors.Accent
                    )
                    Text(
                        "in ${durationYears.toInt()} years at ${String.format("%.1f", annualReturn)}% p.a.",
                        fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            InputSliderCard("Goal Amount", goalAmount, "₹${formatter.format(goalAmount.toLong())}", 100000f..50000000f, 0) { goalAmount = it }
            InputSliderCard("Expected Return Rate (p.a.)", annualReturn, "${String.format("%.1f", annualReturn)}%", 1f..30f, 0) { annualReturn = it }
            InputSliderCard("Time Period", durationYears, "${durationYears.toInt()} Years", 1f..40f, 38) { durationYears = it }

            // SIP Route
            Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(modifier = Modifier.size(8.dp).background(VMColors.Accent, RoundedCornerShape(4.dp)))
                        Spacer(Modifier.width(8.dp))
                        Text("Via Monthly SIP", fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                    }
                    Spacer(Modifier.height(12.dp))
                    SummaryRow("Required Monthly SIP", "₹${formatter.format(requiredSIP.toLong())}", bold = true, color = VMColors.Accent)
                    SummaryRow("Total You Invest", "₹${formatter.format(totalSIPInvested.toLong())}")
                    SummaryRow("Wealth Gained", "₹${formatter.format(sipGains.toLong())}")
                }
            }

            // Lumpsum Route
            Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(modifier = Modifier.size(8.dp).background(Color(0xFF22C55E), RoundedCornerShape(4.dp)))
                        Spacer(Modifier.width(8.dp))
                        Text("Via One-Time Lumpsum", fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                    }
                    Spacer(Modifier.height(12.dp))
                    SummaryRow("Required Lumpsum", "₹${formatter.format(requiredLumpsum.toLong())}", bold = true, color = Color(0xFF22C55E))
                    SummaryRow("Wealth Gained", "₹${formatter.format(lumpsumGains.toLong())}")
                }
            }

            Card(shape = RoundedCornerShape(10.dp), colors = CardDefaults.cardColors(containerColor = VMColors.Accent.copy(alpha = 0.05f))) {
                Text(
                    "Goal Planner shows how much you need to invest today (lumpsum) or monthly (SIP) to reach your financial goal. A combination of both is often the best approach.",
                    modifier = Modifier.padding(14.dp), fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, lineHeight = 16.sp
                )
            }

            Spacer(Modifier.height(16.dp))
        }
    }
}
