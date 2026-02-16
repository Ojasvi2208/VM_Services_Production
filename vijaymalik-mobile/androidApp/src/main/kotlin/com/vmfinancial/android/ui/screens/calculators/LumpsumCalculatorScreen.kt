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
fun LumpsumCalculatorScreen(onBack: () -> Unit) {
    var investment by remember { mutableFloatStateOf(100000f) }
    var annualReturn by remember { mutableFloatStateOf(12f) }
    var durationYears by remember { mutableFloatStateOf(10f) }

    val futureValue = investment.toDouble() * (1.0 + annualReturn.toDouble() / 100.0).pow(durationYears.toDouble())
    val wealthGained = futureValue - investment.toDouble()
    val formatter = NumberFormat.getNumberInstance(Locale("en", "IN"))

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Lumpsum Calculator", fontWeight = FontWeight.Bold) },
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
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Box(contentAlignment = Alignment.Center, modifier = Modifier.size(180.dp)) {
                        val investedColor = VMColors.Accent
                        val gainsColor = Color(0xFF22C55E)
                        val investedAngle = if (futureValue > 0) (investment.toDouble() / futureValue * 360.0).toFloat() else 180f
                        val gainsAngle = 360f - investedAngle

                        Canvas(modifier = Modifier.size(180.dp)) {
                            val strokeWidth = 32f
                            val arcSize = Size(size.width - strokeWidth, size.height - strokeWidth)
                            val topLeft = Offset(strokeWidth / 2, strokeWidth / 2)

                            drawArc(color = investedColor, startAngle = -90f, sweepAngle = investedAngle, useCenter = false, topLeft = topLeft, size = arcSize, style = Stroke(width = strokeWidth, cap = StrokeCap.Butt))
                            drawArc(color = gainsColor, startAngle = -90f + investedAngle, sweepAngle = gainsAngle, useCenter = false, topLeft = topLeft, size = arcSize, style = Stroke(width = strokeWidth, cap = StrokeCap.Butt))
                        }

                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("Total Value", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text("₹${formatter.format(futureValue.toLong())}", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    Spacer(Modifier.height(16.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                        LegendDot("Invested", "₹${formatter.format(investment.toLong())}", VMColors.Accent)
                        LegendDot("Gains", "₹${formatter.format(wealthGained.toLong())}", Color(0xFF22C55E))
                    }
                }
            }

            InputSliderCard("Total Investment", investment, "₹${formatter.format(investment.toLong())}", 10000f..10000000f, 0) { investment = it }
            InputSliderCard("Expected Return Rate (p.a.)", annualReturn, "${String.format("%.1f", annualReturn)}%", 1f..30f, 0) { annualReturn = it }
            InputSliderCard("Time Period", durationYears, "${durationYears.toInt()} Years", 1f..40f, 38) { durationYears = it }

            Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                    SummaryRow("Total Invested", "₹${formatter.format(investment.toLong())}")
                    SummaryRow("Est. Returns", "₹${formatter.format(wealthGained.toLong())}")
                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                    SummaryRow("Total Value", "₹${formatter.format(futureValue.toLong())}", bold = true, color = VMColors.Accent)
                }
            }

            Card(shape = RoundedCornerShape(10.dp), colors = CardDefaults.cardColors(containerColor = VMColors.Accent.copy(alpha = 0.05f))) {
                Text(
                    "Lumpsum investment is a one-time investment in mutual funds. Returns are compounded annually. Actual returns may vary based on market conditions.",
                    modifier = Modifier.padding(14.dp), fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, lineHeight = 16.sp
                )
            }

            Spacer(Modifier.height(16.dp))
        }
    }
}

@Composable
private fun LegendDot(label: String, value: String, color: Color) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(modifier = Modifier.size(10.dp).background(color, RoundedCornerShape(2.dp)))
        Spacer(Modifier.width(6.dp))
        Column {
            Text(label, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(value, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}
