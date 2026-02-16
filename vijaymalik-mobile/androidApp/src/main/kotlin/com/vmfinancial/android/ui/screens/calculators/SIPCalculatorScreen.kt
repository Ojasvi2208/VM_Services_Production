package com.vmfinancial.android.ui.screens.calculators

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vmfinancial.android.ui.theme.VMColors
import java.text.NumberFormat
import java.util.Locale
import kotlin.math.pow

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SIPCalculatorScreen(onBack: () -> Unit) {
    var monthlyInvestment by remember { mutableFloatStateOf(5000f) }
    var annualReturn by remember { mutableFloatStateOf(12f) }
    var durationYears by remember { mutableFloatStateOf(10f) }

    val months = (durationYears * 12).toInt()
    val monthlyRate = annualReturn.toDouble() / 12.0 / 100.0
    val totalInvested = monthlyInvestment.toDouble() * months
    val futureValue = if (monthlyRate > 0) {
        monthlyInvestment.toDouble() * ((1 + monthlyRate).pow(months) - 1) / monthlyRate * (1 + monthlyRate)
    } else {
        totalInvested
    }
    val wealthGained = futureValue - totalInvested
    val formatter = NumberFormat.getNumberInstance(Locale("en", "IN"))

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("SIP Calculator", fontWeight = FontWeight.Bold) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
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
                        val investedAngle = if (futureValue > 0) (totalInvested / futureValue * 360.0).toFloat() else 180f
                        val gainsAngle = 360f - investedAngle

                        Canvas(modifier = Modifier.size(180.dp)) {
                            val strokeWidth = 32f
                            val arcSize = Size(size.width - strokeWidth, size.height - strokeWidth)
                            val topLeft = Offset(strokeWidth / 2, strokeWidth / 2)

                            drawArc(
                                color = investedColor, startAngle = -90f, sweepAngle = investedAngle,
                                useCenter = false, topLeft = topLeft, size = arcSize,
                                style = Stroke(width = strokeWidth, cap = StrokeCap.Butt)
                            )
                            drawArc(
                                color = gainsColor, startAngle = -90f + investedAngle, sweepAngle = gainsAngle,
                                useCenter = false, topLeft = topLeft, size = arcSize,
                                style = Stroke(width = strokeWidth, cap = StrokeCap.Butt)
                            )
                        }

                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("Total Value", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(
                                "₹${formatter.format(futureValue.toLong())}",
                                fontSize = 18.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface
                            )
                        }
                    }

                    Spacer(Modifier.height(16.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceEvenly
                    ) {
                        LegendItem("Invested", "₹${formatter.format(totalInvested.toLong())}", VMColors.Accent)
                        LegendItem("Gains", "₹${formatter.format(wealthGained.toLong())}", Color(0xFF22C55E))
                    }
                }
            }

            // Monthly Investment Slider
            InputSliderCard(
                label = "Monthly Investment",
                value = monthlyInvestment,
                valueDisplay = "₹${formatter.format(monthlyInvestment.toLong())}",
                range = 500f..200000f,
                steps = 0,
                onValueChange = { monthlyInvestment = it }
            )

            // Expected Return Rate
            InputSliderCard(
                label = "Expected Return Rate (p.a.)",
                value = annualReturn,
                valueDisplay = "${String.format("%.1f", annualReturn)}%",
                range = 1f..30f,
                steps = 0,
                onValueChange = { annualReturn = it }
            )

            // Duration
            InputSliderCard(
                label = "Time Period",
                value = durationYears,
                valueDisplay = "${durationYears.toInt()} Years",
                range = 1f..40f,
                steps = 38,
                onValueChange = { durationYears = it }
            )

            // Summary
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                    SummaryRow("Total Invested", "₹${formatter.format(totalInvested.toLong())}")
                    SummaryRow("Est. Returns", "₹${formatter.format(wealthGained.toLong())}")
                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                    SummaryRow("Total Value", "₹${formatter.format(futureValue.toLong())}", bold = true, color = VMColors.Accent)
                }
            }

            // Info
            Card(
                shape = RoundedCornerShape(10.dp),
                colors = CardDefaults.cardColors(containerColor = VMColors.Accent.copy(alpha = 0.05f))
            ) {
                Text(
                    "SIP (Systematic Investment Plan) allows you to invest a fixed amount regularly in mutual funds. Returns are compounded monthly. Actual returns may vary.",
                    modifier = Modifier.padding(14.dp), fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant, lineHeight = 16.sp
                )
            }

            Spacer(Modifier.height(16.dp))
        }
    }
}

@Composable
internal fun InputSliderCard(
    label: String,
    value: Float,
    valueDisplay: String,
    range: ClosedFloatingPointRange<Float>,
    steps: Int,
    onValueChange: (Float) -> Unit
) {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(label, fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(valueDisplay, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = VMColors.Accent)
            }
            Spacer(Modifier.height(8.dp))
            Slider(
                value = value,
                onValueChange = onValueChange,
                valueRange = range,
                steps = steps,
                colors = SliderDefaults.colors(
                    thumbColor = VMColors.Accent,
                    activeTrackColor = VMColors.Accent,
                    inactiveTrackColor = VMColors.Accent.copy(alpha = 0.15f)
                )
            )
        }
    }
}

@Composable
private fun LegendItem(label: String, value: String, color: Color) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(modifier = Modifier.size(10.dp).background(color, RoundedCornerShape(2.dp)))
        Spacer(Modifier.width(6.dp))
        Column {
            Text(label, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(value, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
internal fun SummaryRow(label: String, value: String, bold: Boolean = false, color: Color? = null) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, fontWeight = if (bold) FontWeight.SemiBold else FontWeight.Normal)
        Text(value, fontSize = 14.sp, fontWeight = if (bold) FontWeight.Bold else FontWeight.SemiBold, color = color ?: MaterialTheme.colorScheme.onSurface)
    }
}
