package com.vmfinancial.android.ui.screens.goals

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vmfinancial.android.MainActivity
import com.vmfinancial.android.ui.theme.VMColors
import com.vmfinancial.shared.data.api.BackendApi
import com.vmfinancial.shared.data.models.*
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.util.Locale

private val indianFormat = NumberFormat.getNumberInstance(Locale("en", "IN"))
private fun formatINR(amount: Double): String = "\u20b9${indianFormat.format(amount.toLong())}"

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GoalDetailScreen(goalId: String, onBack: () -> Unit) {
    val context = LocalContext.current
    val authService = (context as? MainActivity)?.authService
    val token = authService?.authToken ?: ""
    val api = remember { BackendApi() }
    val scope = rememberCoroutineScope()

    var isLoading by remember { mutableStateOf(true) }
    var goal by remember { mutableStateOf<Goal?>(null) }
    var projection by remember { mutableStateOf<GoalProjection?>(null) }
    var contributions by remember { mutableStateOf<List<GoalContribution>>(emptyList()) }
    var showDeleteDialog by remember { mutableStateOf(false) }
    var showContributeDialog by remember { mutableStateOf(false) }

    fun load() {
        scope.launch {
            isLoading = true
            try {
                val resp = api.getGoalDetail(token, goalId)
                if (resp.success) {
                    goal = resp.goal
                    projection = resp.projection
                    contributions = resp.contributions
                }
            } catch (_: Exception) {}
            isLoading = false
        }
    }

    LaunchedEffect(goalId) { load() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(goal?.name ?: "Goal Detail", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { showDeleteDialog = true }) {
                        Icon(Icons.Outlined.Delete, contentDescription = "Delete", tint = Color(0xFFEF4444))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent)
            )
        }
    ) { padding ->
        if (isLoading) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = VMColors.Accent, modifier = Modifier.size(32.dp))
            }
        } else if (goal == null) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Text("Goal not found", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        } else {
            val g = goal!!
            val goalColor = try { Color(android.graphics.Color.parseColor(g.color)) } catch (_: Exception) { VMColors.Accent }

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // ── Hero Card: Progress Ring + Success ──
                Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(modifier = Modifier.fillMaxWidth().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(contentAlignment = Alignment.Center, modifier = Modifier.size(120.dp)) {
                            ProgressRingLarge(
                                progress = (g.progressPercent / 100).toFloat().coerceIn(0f, 1f),
                                color = goalColor,
                                modifier = Modifier.size(120.dp)
                            )
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("${String.format("%.1f", g.progressPercent)}%", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = goalColor)
                                Text("saved", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                        Spacer(Modifier.height(16.dp))
                        Text(formatINR(g.currentValue), fontSize = 22.sp, fontWeight = FontWeight.Bold)
                        Text("of ${formatINR(g.targetAmount)} target", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Spacer(Modifier.height(12.dp))
                        // Success badge
                        val successColor = when {
                            g.successProbability >= 80 -> VMColors.MarketUp
                            g.successProbability >= 60 -> Color(0xFFF59E0B)
                            else -> Color(0xFFEF4444)
                        }
                        Surface(shape = RoundedCornerShape(10.dp), color = successColor.copy(alpha = 0.1f)) {
                            Row(modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                                Text("${g.successProbability.toInt()}%", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = successColor)
                                Spacer(Modifier.width(8.dp))
                                Text("Monte Carlo success probability", fontSize = 12.sp, color = successColor)
                            }
                        }
                    }
                }

                // ── Projection Fan Chart ──
                if (projection != null && projection!!.chartData.isNotEmpty()) {
                    Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                        Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                            Text("Projection (10k simulations)", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            Spacer(Modifier.height(12.dp))
                            ProjectionFanChart(
                                chartData = projection!!.chartData,
                                targetAmount = g.targetAmount,
                                color = goalColor,
                                modifier = Modifier.fillMaxWidth().height(180.dp)
                            )
                            Spacer(Modifier.height(12.dp))
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                                ProjectionLabel("Pessimistic (P10)", formatINR(projection!!.p10), Color(0xFFEF4444))
                                ProjectionLabel("Median (P50)", formatINR(projection!!.p50), goalColor)
                                ProjectionLabel("Optimistic (P90)", formatINR(projection!!.p90), VMColors.MarketUp)
                            }
                        }
                    }
                }

                // ── Key Metrics ──
                Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text("Details", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        MetricRow("Monthly SIP", formatINR(g.monthlySip))
                        MetricRow("Recommended SIP", formatINR(g.recommendedSip))
                        if (g.recommendedSip > g.monthlySip && g.monthlySip > 0) {
                            Surface(shape = RoundedCornerShape(8.dp), color = Color(0xFFF59E0B).copy(alpha = 0.1f)) {
                                Text(
                                    "Increase SIP by ${formatINR(g.recommendedSip - g.monthlySip)}/mo for 90% success",
                                    fontSize = 11.sp, color = Color(0xFFF59E0B), fontWeight = FontWeight.Medium,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                )
                            }
                        }
                        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.1f))
                        MetricRow("Target Date", g.targetDate.take(10))
                        MetricRow("Criticality", g.criticality.replaceFirstChar { it.uppercase() })
                        MetricRow("Expected Return", "${g.expectedReturn}%")
                        MetricRow("Inflation Rate", "${g.inflationRate}%")
                        MetricRow("Total Contributed", formatINR(g.totalContributed))
                    }
                }

                // ── Linked Funds ──
                if (g.linkedFunds.isNotEmpty()) {
                    Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                        Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                            Text("Linked Funds", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            Spacer(Modifier.height(8.dp))
                            g.linkedFunds.forEach { fund ->
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(Icons.Outlined.AccountBalance, contentDescription = null, modifier = Modifier.size(18.dp), tint = goalColor)
                                    Spacer(Modifier.width(10.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(fund.schemeName ?: fund.schemeCode, fontSize = 13.sp, maxLines = 1)
                                    }
                                    Text("${fund.allocationPct.toInt()}%", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = goalColor)
                                }
                            }
                        }
                    }
                }

                // ── Contributions ──
                if (contributions.isNotEmpty()) {
                    Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                        Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                            Text("Recent Contributions", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            Spacer(Modifier.height(8.dp))
                            contributions.take(10).forEach { c ->
                                Row(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Text(c.date.take(10), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    Text(formatINR(c.amount), fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = VMColors.MarketUp)
                                }
                            }
                        }
                    }
                }

                // ── Contribute Button ──
                Button(
                    onClick = { showContributeDialog = true },
                    modifier = Modifier.fillMaxWidth().height(50.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = goalColor),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Icon(Icons.Outlined.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Record Contribution", fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                }

                Spacer(Modifier.height(32.dp))
            }
        }
    }

    // ── Delete Dialog ──
    if (showDeleteDialog && goal != null) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text("Delete Goal") },
            text = { Text("Are you sure you want to delete \"${goal!!.name}\"? This action cannot be undone.") },
            confirmButton = {
                TextButton(onClick = {
                    scope.launch {
                        try { api.deleteGoal(token, goalId) } catch (_: Exception) {}
                        showDeleteDialog = false
                        onBack()
                    }
                }) { Text("Delete", color = Color(0xFFEF4444)) }
            },
            dismissButton = { TextButton(onClick = { showDeleteDialog = false }) { Text("Cancel") } }
        )
    }

    // ── Contribute Dialog ──
    if (showContributeDialog) {
        var amount by remember { mutableStateOf("") }
        var isSubmitting by remember { mutableStateOf(false) }
        AlertDialog(
            onDismissRequest = { showContributeDialog = false },
            title = { Text("Record Contribution") },
            text = {
                OutlinedTextField(
                    value = amount,
                    onValueChange = { amount = it.filter { c -> c.isDigit() || c == '.' } },
                    label = { Text("Amount (\u20b9)") },
                    singleLine = true,
                    shape = RoundedCornerShape(10.dp)
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        val amt = amount.toDoubleOrNull()
                        if (amt != null && amt > 0) {
                            isSubmitting = true
                            scope.launch {
                                try {
                                    api.contributeToGoal(token, goalId, amt)
                                    showContributeDialog = false
                                    load()
                                } catch (_: Exception) {}
                                isSubmitting = false
                            }
                        }
                    },
                    enabled = !isSubmitting
                ) { Text("Save", color = VMColors.Accent) }
            },
            dismissButton = { TextButton(onClick = { showContributeDialog = false }) { Text("Cancel") } }
        )
    }
}

@Composable
private fun ProgressRingLarge(progress: Float, color: Color, modifier: Modifier = Modifier) {
    val animatedProgress by animateFloatAsState(
        targetValue = progress,
        animationSpec = tween(durationMillis = 1000, easing = FastOutSlowInEasing),
        label = "progress"
    )
    Canvas(modifier = modifier) {
        val strokeWidth = 8.dp.toPx()
        drawArc(color = color.copy(alpha = 0.12f), startAngle = -90f, sweepAngle = 360f, useCenter = false, style = Stroke(width = strokeWidth, cap = StrokeCap.Round))
        drawArc(color = color, startAngle = -90f, sweepAngle = animatedProgress * 360f, useCenter = false, style = Stroke(width = strokeWidth, cap = StrokeCap.Round))
    }
}

@Composable
private fun ProjectionFanChart(
    chartData: List<ProjectionPoint>,
    targetAmount: Double,
    color: Color,
    modifier: Modifier = Modifier
) {
    Canvas(modifier = modifier) {
        if (chartData.size < 2) return@Canvas
        val maxVal = maxOf(chartData.maxOf { it.p90 }, targetAmount) * 1.1
        val w = size.width
        val h = size.height

        fun xFor(i: Int) = w * i / (chartData.size - 1).toFloat()
        fun yFor(v: Double) = h - (h * v / maxVal).toFloat()

        // Fan area (P10-P90)
        val fanPath = Path().apply {
            moveTo(xFor(0), yFor(chartData[0].p90))
            chartData.forEachIndexed { i, d -> lineTo(xFor(i), yFor(d.p90)) }
            for (i in chartData.indices.reversed()) lineTo(xFor(i), yFor(chartData[i].p10))
            close()
        }
        drawPath(fanPath, color = color.copy(alpha = 0.1f))

        // P50 line
        chartData.forEachIndexed { i, d ->
            if (i > 0) {
                drawLine(color = color, start = Offset(xFor(i - 1), yFor(chartData[i - 1].p50)), end = Offset(xFor(i), yFor(d.p50)), strokeWidth = 3.dp.toPx())
            }
        }

        // Target line
        val targetY = yFor(targetAmount)
        drawLine(color = Color(0xFFEF4444).copy(alpha = 0.5f), start = Offset(0f, targetY), end = Offset(w, targetY), strokeWidth = 1.dp.toPx(), pathEffect = androidx.compose.ui.graphics.PathEffect.dashPathEffect(floatArrayOf(8f, 8f)))
    }
}

@Composable
private fun ProjectionLabel(label: String, value: String, color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = color)
        Text(label, fontSize = 9.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun MetricRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
    }
}
