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
fun StepUpSIPCalculatorScreen(onBack: () -> Unit) {
    var monthlyInvestment by remember { mutableFloatStateOf(5000f) }
    var annualReturn by remember { mutableFloatStateOf(12f) }
    var durationYears by remember { mutableFloatStateOf(15f) }
    var annualStepUp by remember { mutableFloatStateOf(10f) }

    val monthlyRate = annualReturn.toDouble() / 12.0 / 100.0
    val years = durationYears.toInt()

    // Calculate year by year with step-up
    var totalInvested = 0.0
    var futureValue = 0.0
    var currentSIP = monthlyInvestment.toDouble()

    for (year in 1..years) {
        for (month in 1..12) {
            val remainingMonths = (years - year) * 12 + (12 - month)
            totalInvested += currentSIP
            futureValue += currentSIP * (1.0 + monthlyRate).pow(remainingMonths + 1)
        }
        if (year < years) {
            currentSIP *= (1.0 + annualStepUp.toDouble() / 100.0)
        }
    }

    val wealthGained = futureValue - totalInvested

    // Also calculate normal SIP for comparison
    val normalMonths = years * 12
    val normalFV = if (monthlyRate > 0) {
        monthlyInvestment.toDouble() * ((1.0 + monthlyRate).pow(normalMonths) - 1.0) / monthlyRate * (1.0 + monthlyRate)
    } else {
        monthlyInvestment.toDouble() * normalMonths
    }
    val extraGains = futureValue - normalFV

    val formatter = NumberFormat.getNumberInstance(Locale("en", "IN"))

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Step-up SIP Calculator", fontWeight = FontWeight.Bold) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // Donut Chart
            Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column(modifier = Modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(contentAlignment = Alignment.Center, modifier = Modifier.size(180.dp)) {
                        val investedAngle = if (futureValue > 0) (totalInvested / futureValue * 360.0).toFloat() else 180f
                        val gainsAngle = 360f - investedAngle

                        Canvas(modifier = Modifier.size(180.dp)) {
                            val sw = 32f
                            val arcSize = Size(size.width - sw, size.height - sw)
                            val tl = Offset(sw / 2, sw / 2)
                            drawArc(color = VMColors.Accent, startAngle = -90f, sweepAngle = investedAngle, useCenter = false, topLeft = tl, size = arcSize, style = Stroke(sw, cap = StrokeCap.Butt))
                            drawArc(color = Color(0xFF22C55E), startAngle = -90f + investedAngle, sweepAngle = gainsAngle, useCenter = false, topLeft = tl, size = arcSize, style = Stroke(sw, cap = StrokeCap.Butt))
                        }

                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("Total Value", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text("₹${formatter.format(futureValue.toLong())}", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    Spacer(Modifier.height(16.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(modifier = Modifier.size(10.dp).background(VMColors.Accent, RoundedCornerShape(2.dp)))
                            Spacer(Modifier.width(6.dp))
                            Column {
                                Text("Invested", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text("₹${formatter.format(totalInvested.toLong())}", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            }
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(modifier = Modifier.size(10.dp).background(Color(0xFF22C55E), RoundedCornerShape(2.dp)))
                            Spacer(Modifier.width(6.dp))
                            Column {
                                Text("Gains", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text("₹${formatter.format(wealthGained.toLong())}", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                }
            }

            InputSliderCard("Starting Monthly SIP", monthlyInvestment, "₹${formatter.format(monthlyInvestment.toLong())}", 500f..200000f, 0) { monthlyInvestment = it }
            InputSliderCard("Annual Step-up", annualStepUp, "${String.format("%.0f", annualStepUp)}%", 0f..50f, 0) { annualStepUp = it }
            InputSliderCard("Expected Return Rate (p.a.)", annualReturn, "${String.format("%.1f", annualReturn)}%", 1f..30f, 0) { annualReturn = it }
            InputSliderCard("Time Period", durationYears, "${durationYears.toInt()} Years", 1f..40f, 38) { durationYears = it }

            // Summary
            Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                    SummaryRow("Total Invested", "₹${formatter.format(totalInvested.toLong())}")
                    SummaryRow("Est. Returns", "₹${formatter.format(wealthGained.toLong())}")
                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                    SummaryRow("Total Value", "₹${formatter.format(futureValue.toLong())}", bold = true, color = VMColors.Accent)
                }
            }

            // Comparison with Normal SIP
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF22C55E).copy(alpha = 0.06f))
            ) {
                Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                    Text("Step-up Advantage", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    Spacer(Modifier.height(8.dp))
                    SummaryRow("Normal SIP Value", "₹${formatter.format(normalFV.toLong())}")
                    SummaryRow("Step-up SIP Value", "₹${formatter.format(futureValue.toLong())}")
                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                    SummaryRow(
                        "Extra Wealth Created",
                        "₹${formatter.format(extraGains.toLong())}",
                        bold = true,
                        color = Color(0xFF22C55E)
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Final SIP: ₹${formatter.format(currentSIP.toLong())}/month",
                        fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Card(shape = RoundedCornerShape(10.dp), colors = CardDefaults.cardColors(containerColor = VMColors.Accent.copy(alpha = 0.05f))) {
                Text(
                    "Step-up SIP increases your monthly investment by a fixed percentage every year (e.g., 10% annual raise). This dramatically boosts long-term wealth creation.",
                    modifier = Modifier.padding(14.dp), fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, lineHeight = 16.sp
                )
            }

            Spacer(Modifier.height(16.dp))
        }
    }
}
