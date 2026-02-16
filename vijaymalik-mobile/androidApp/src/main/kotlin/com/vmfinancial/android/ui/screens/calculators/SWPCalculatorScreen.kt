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
fun SWPCalculatorScreen(onBack: () -> Unit) {
    var totalInvestment by remember { mutableFloatStateOf(2500000f) }
    var monthlyWithdrawal by remember { mutableFloatStateOf(20000f) }
    var annualReturn by remember { mutableFloatStateOf(8f) }
    var durationYears by remember { mutableFloatStateOf(20f) }

    val months = (durationYears * 12).toInt()
    val monthlyRate = annualReturn.toDouble() / 12.0 / 100.0

    // SWP: remaining corpus after monthly withdrawals with compounding
    // FV = PV*(1+r)^n - W*((1+r)^n - 1)/r
    val growthFactor = (1.0 + monthlyRate).pow(months)
    val remainingCorpus = if (monthlyRate > 0) {
        totalInvestment.toDouble() * growthFactor - monthlyWithdrawal.toDouble() * (growthFactor - 1.0) / monthlyRate
    } else {
        totalInvestment.toDouble() - monthlyWithdrawal.toDouble() * months
    }

    val totalWithdrawn = monthlyWithdrawal.toDouble() * months
    val finalCorpus = maxOf(remainingCorpus, 0.0)
    val corpusExhausted = remainingCorpus < 0.0

    val formatter = NumberFormat.getNumberInstance(Locale("en", "IN"))

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("SWP Calculator", fontWeight = FontWeight.Bold) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // Result Card
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (corpusExhausted) Color(0xFFEF4444).copy(alpha = 0.08f)
                    else MaterialTheme.colorScheme.surface
                )
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    if (corpusExhausted) {
                        Text("Corpus Exhausted!", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color(0xFFEF4444))
                        Spacer(Modifier.height(4.dp))
                        Text(
                            "Your withdrawals exceed growth. Reduce monthly withdrawal or increase investment.",
                            fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, lineHeight = 16.sp
                        )
                    } else {
                        Box(contentAlignment = Alignment.Center, modifier = Modifier.size(180.dp)) {
                            val withdrawnAngle = if (totalWithdrawn + finalCorpus > 0)
                                (totalWithdrawn / (totalWithdrawn + finalCorpus) * 360.0).toFloat() else 180f
                            val corpusAngle = 360f - withdrawnAngle

                            Canvas(modifier = Modifier.size(180.dp)) {
                                val sw = 32f
                                val arcSize = Size(size.width - sw, size.height - sw)
                                val tl = Offset(sw / 2, sw / 2)
                                drawArc(color = Color(0xFFF59E0B), startAngle = -90f, sweepAngle = withdrawnAngle, useCenter = false, topLeft = tl, size = arcSize, style = Stroke(sw, cap = StrokeCap.Butt))
                                drawArc(color = VMColors.Accent, startAngle = -90f + withdrawnAngle, sweepAngle = corpusAngle, useCenter = false, topLeft = tl, size = arcSize, style = Stroke(sw, cap = StrokeCap.Butt))
                            }

                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("Remaining", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text("₹${formatter.format(finalCorpus.toLong())}", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                            }
                        }

                        Spacer(Modifier.height(16.dp))
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(modifier = Modifier.size(10.dp).background(Color(0xFFF59E0B), RoundedCornerShape(2.dp)))
                                Spacer(Modifier.width(6.dp))
                                Column {
                                    Text("Withdrawn", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    Text("₹${formatter.format(totalWithdrawn.toLong())}", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                }
                            }
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(modifier = Modifier.size(10.dp).background(VMColors.Accent, RoundedCornerShape(2.dp)))
                                Spacer(Modifier.width(6.dp))
                                Column {
                                    Text("Remaining", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    Text("₹${formatter.format(finalCorpus.toLong())}", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                }
                            }
                        }
                    }
                }
            }

            InputSliderCard("Total Investment", totalInvestment, "₹${formatter.format(totalInvestment.toLong())}", 100000f..50000000f, 0) { totalInvestment = it }
            InputSliderCard("Monthly Withdrawal", monthlyWithdrawal, "₹${formatter.format(monthlyWithdrawal.toLong())}", 1000f..500000f, 0) { monthlyWithdrawal = it }
            InputSliderCard("Expected Return Rate (p.a.)", annualReturn, "${String.format("%.1f", annualReturn)}%", 1f..20f, 0) { annualReturn = it }
            InputSliderCard("Withdrawal Period", durationYears, "${durationYears.toInt()} Years", 1f..40f, 38) { durationYears = it }

            Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                    SummaryRow("Initial Investment", "₹${formatter.format(totalInvestment.toLong())}")
                    SummaryRow("Total Withdrawn", "₹${formatter.format(totalWithdrawn.toLong())}")
                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                    SummaryRow(
                        "Final Corpus",
                        if (corpusExhausted) "Exhausted" else "₹${formatter.format(finalCorpus.toLong())}",
                        bold = true,
                        color = if (corpusExhausted) Color(0xFFEF4444) else VMColors.Accent
                    )
                }
            }

            Card(shape = RoundedCornerShape(10.dp), colors = CardDefaults.cardColors(containerColor = VMColors.Accent.copy(alpha = 0.05f))) {
                Text(
                    "SWP (Systematic Withdrawal Plan) lets you withdraw a fixed amount regularly from your investment while the remaining corpus continues to earn returns.",
                    modifier = Modifier.padding(14.dp), fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, lineHeight = 16.sp
                )
            }

            Spacer(Modifier.height(16.dp))
        }
    }
}
