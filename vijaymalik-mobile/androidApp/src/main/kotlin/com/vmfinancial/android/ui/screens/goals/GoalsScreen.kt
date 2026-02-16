package com.vmfinancial.android.ui.screens.goals

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
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
fun GoalsScreen(
    onNavigateToAuth: () -> Unit = {},
    onNavigateToCreateGoal: () -> Unit = {},
    onNavigateToGoalDetail: (String) -> Unit = {}
) {
    val context = LocalContext.current
    val authService = (context as? MainActivity)?.authService
    val token = authService?.authToken ?: ""
    val isLoggedIn = authService?.isLoggedIn == true

    if (!isLoggedIn) {
        GuestGoals(onSignIn = onNavigateToAuth)
        return
    }

    val scope = rememberCoroutineScope()
    val api = remember { BackendApi() }
    var isLoading by remember { mutableStateOf(true) }
    var goals by remember { mutableStateOf<List<Goal>>(emptyList()) }
    var summary by remember { mutableStateOf<GoalSummary?>(null) }
    var evaluations by remember { mutableStateOf<EvaluationsResponse?>(null) }

    fun loadGoals() {
        scope.launch {
            isLoading = true
            try {
                val resp = api.getGoals(token)
                if (resp.success) {
                    goals = resp.goals
                    summary = resp.summary
                }
            } catch (_: Exception) {}
            // Fetch AI evaluations in parallel
            try {
                val evalResp = api.getGoalEvaluations(token)
                if (evalResp.success) evaluations = evalResp
            } catch (_: Exception) {}
            isLoading = false
        }
    }

    LaunchedEffect(token) { loadGoals() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Goals", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = onNavigateToCreateGoal,
                containerColor = VMColors.Accent,
                contentColor = Color.White,
                shape = RoundedCornerShape(16.dp)
            ) {
                Icon(Icons.Default.Add, contentDescription = "Create Goal")
            }
        }
    ) { padding ->
        if (isLoading) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = VMColors.Accent, modifier = Modifier.size(32.dp))
            }
        } else if (goals.isEmpty()) {
            EmptyGoals(onCreateGoal = onNavigateToCreateGoal, modifier = Modifier.padding(padding))
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Summary card
                if (summary != null) {
                    item { GoalSummaryCard(summary!!) }
                }

                // AI Evaluation Insight Card
                if (evaluations != null && evaluations!!.flags.isNotEmpty()) {
                    item { AIInsightCard(evaluations!!) }
                }

                // Goal cards grouped by criticality
                val critical = goals.filter { it.criticality == "critical" }
                val important = goals.filter { it.criticality == "important" }
                val discretionary = goals.filter { it.criticality == "discretionary" }

                if (critical.isNotEmpty()) {
                    item { CriticalityHeader("Critical Goals", Color(0xFFEF4444), critical.size) }
                    items(critical, key = { it.id }) { goal ->
                        GoalCard(goal = goal, onClick = { onNavigateToGoalDetail(goal.id) })
                    }
                }
                if (important.isNotEmpty()) {
                    item { CriticalityHeader("Important Goals", VMColors.Accent, important.size) }
                    items(important, key = { it.id }) { goal ->
                        GoalCard(goal = goal, onClick = { onNavigateToGoalDetail(goal.id) })
                    }
                }
                if (discretionary.isNotEmpty()) {
                    item { CriticalityHeader("Discretionary Goals", VMColors.MarketUp, discretionary.size) }
                    items(discretionary, key = { it.id }) { goal ->
                        GoalCard(goal = goal, onClick = { onNavigateToGoalDetail(goal.id) })
                    }
                }

                item { Spacer(Modifier.height(80.dp)) }
            }
        }
    }
}

@Composable
private fun AIInsightCard(evaluations: EvaluationsResponse) {
    val status = evaluations.overallStatus ?: return
    val redFlags = evaluations.flags.filter { it.flag == "red" }
    val amberFlags = evaluations.flags.filter { it.flag == "amber" }
    val topAction = redFlags.firstOrNull() ?: amberFlags.firstOrNull()

    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = when {
                status.red > 0 -> Color(0xFFEF4444).copy(alpha = 0.06f)
                status.amber > 0 -> Color(0xFFF59E0B).copy(alpha = 0.06f)
                else -> VMColors.MarketUp.copy(alpha = 0.06f)
            }
        )
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Outlined.AutoAwesome,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = VMColors.Accent
                )
                Spacer(Modifier.width(6.dp))
                Text("AI Evaluation", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = VMColors.Accent)
                Spacer(Modifier.weight(1f))
                // Flag pills
                if (status.green > 0) FlagPill("${status.green}", VMColors.MarketUp)
                if (status.amber > 0) { Spacer(Modifier.width(4.dp)); FlagPill("${status.amber}", Color(0xFFF59E0B)) }
                if (status.red > 0) { Spacer(Modifier.width(4.dp)); FlagPill("${status.red}", Color(0xFFEF4444)) }
            }
            if (topAction != null) {
                Spacer(Modifier.height(8.dp))
                Text(
                    topAction.suggestedAction,
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 2
                )
            }
            // Monthly narrative summary
            if (evaluations.monthlyNarrative != null) {
                Spacer(Modifier.height(6.dp))
                Text(
                    evaluations.monthlyNarrative!!.summary,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2
                )
            }
            // Compliance disclosure
            Spacer(Modifier.height(6.dp))
            Text(
                evaluations.disclosure.take(120) + "...",
                fontSize = 8.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
            )
        }
    }
}

@Composable
private fun FlagPill(count: String, color: Color) {
    Surface(shape = RoundedCornerShape(6.dp), color = color.copy(alpha = 0.15f)) {
        Text(count, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = color,
            modifier = Modifier.padding(horizontal = 7.dp, vertical = 2.dp))
    }
}

@Composable
private fun GoalSummaryCard(summary: GoalSummary) {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Goal Progress", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("${String.format("%.1f", summary.overallProgressPercent)}%", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = VMColors.Accent)
                }
                // Mini progress ring
                Box(contentAlignment = Alignment.Center, modifier = Modifier.size(56.dp)) {
                    ProgressRing(
                        progress = (summary.overallProgressPercent / 100).toFloat().coerceIn(0f, 1f),
                        color = VMColors.Accent,
                        modifier = Modifier.size(56.dp)
                    )
                    Text("${summary.totalGoals}", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                }
            }
            Spacer(Modifier.height(12.dp))
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.1f))
            Spacer(Modifier.height(10.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                SummaryMetric("Target", formatINR(summary.totalTargetValue))
                SummaryMetric("Saved", formatINR(summary.totalCurrentValue))
                SummaryMetric("Monthly SIP", formatINR(summary.totalMonthlySip))
            }
            if (summary.criticalGoalsAtRisk > 0) {
                Spacer(Modifier.height(8.dp))
                Surface(shape = RoundedCornerShape(8.dp), color = Color(0xFFEF4444).copy(alpha = 0.1f)) {
                    Text(
                        "${summary.criticalGoalsAtRisk} critical goal${if (summary.criticalGoalsAtRisk > 1) "s" else ""} at risk",
                        fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFFEF4444),
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun SummaryMetric(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, fontSize = 14.sp, fontWeight = FontWeight.Bold)
        Text(label, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun CriticalityHeader(title: String, color: Color, count: Int) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(Modifier.size(8.dp).clip(CircleShape).background(color))
        Spacer(Modifier.width(8.dp))
        Text(title, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.width(6.dp))
        Text("$count", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f))
    }
}

@Composable
private fun GoalCard(goal: Goal, onClick: () -> Unit) {
    val iconRes = goalIcon(goal.icon)
    val goalColor = try { Color(android.graphics.Color.parseColor(goal.color)) } catch (_: Exception) { VMColors.Accent }
    val successColor = when {
        goal.successProbability >= 80 -> VMColors.MarketUp
        goal.successProbability >= 60 -> Color(0xFFF59E0B)
        goal.successProbability > 0 -> Color(0xFFEF4444)
        else -> MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.3f)
    }

    Card(
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick)
    ) {
        Row(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            // Progress ring with icon
            Box(contentAlignment = Alignment.Center, modifier = Modifier.size(52.dp)) {
                ProgressRing(
                    progress = (goal.progressPercent / 100).toFloat().coerceIn(0f, 1f),
                    color = goalColor,
                    modifier = Modifier.size(52.dp)
                )
                Icon(iconRes, contentDescription = null, tint = goalColor, modifier = Modifier.size(20.dp))
            }

            Spacer(Modifier.width(14.dp))

            // Goal info
            Column(modifier = Modifier.weight(1f)) {
                Text(goal.name, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(2.dp))
                Text(
                    "${formatINR(goal.currentValue)} / ${formatINR(goal.targetAmount)}",
                    fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    // SIP pill
                    if (goal.monthlySip > 0) {
                        Surface(shape = RoundedCornerShape(4.dp), color = goalColor.copy(alpha = 0.1f)) {
                            Text("SIP ${formatINR(goal.monthlySip)}/mo", fontSize = 10.sp, color = goalColor,
                                fontWeight = FontWeight.Medium, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                        }
                    }
                    // Target date
                    Text(goal.targetDate.take(10), fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            Spacer(Modifier.width(8.dp))

            // Success probability badge
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    "${goal.successProbability.toInt()}%",
                    fontSize = 18.sp, fontWeight = FontWeight.Bold, color = successColor
                )
                Text("success", fontSize = 9.sp, color = successColor)
            }
        }
    }
}

@Composable
private fun ProgressRing(progress: Float, color: Color, modifier: Modifier = Modifier) {
    val animatedProgress by animateFloatAsState(
        targetValue = progress,
        animationSpec = tween(durationMillis = 800, easing = FastOutSlowInEasing),
        label = "progress"
    )
    Canvas(modifier = modifier) {
        val strokeWidth = 4.dp.toPx()
        // Background ring
        drawArc(
            color = color.copy(alpha = 0.12f),
            startAngle = -90f, sweepAngle = 360f, useCenter = false,
            style = Stroke(width = strokeWidth, cap = StrokeCap.Round)
        )
        // Progress arc
        drawArc(
            color = color,
            startAngle = -90f, sweepAngle = animatedProgress * 360f, useCenter = false,
            style = Stroke(width = strokeWidth, cap = StrokeCap.Round)
        )
    }
}

@Composable
private fun EmptyGoals(onCreateGoal: () -> Unit, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(Icons.Outlined.Flag, contentDescription = null, modifier = Modifier.size(64.dp),
            tint = VMColors.Accent.copy(alpha = 0.3f))
        Spacer(Modifier.height(20.dp))
        Text("Plan Your Future", fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text(
            "Set financial goals with AI-powered projections.\nTrack progress and stay on course.",
            fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center, modifier = Modifier.padding(horizontal = 40.dp)
        )
        Spacer(Modifier.height(28.dp))
        Button(
            onClick = onCreateGoal,
            colors = ButtonDefaults.buttonColors(containerColor = VMColors.Accent),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.height(48.dp)
        ) {
            Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text("Create Your First Goal", fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun GuestGoals(onSignIn: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(Icons.Outlined.Flag, contentDescription = null, modifier = Modifier.size(70.dp),
            tint = VMColors.Accent.copy(alpha = 0.3f))
        Spacer(Modifier.height(20.dp))
        Text("Goal Planning", fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text(
            "Sign in to create financial goals with Monte Carlo projections.",
            fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center, modifier = Modifier.padding(horizontal = 40.dp)
        )
        Spacer(Modifier.height(28.dp))
        Button(
            onClick = onSignIn,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 32.dp).height(48.dp),
            colors = ButtonDefaults.buttonColors(containerColor = VMColors.Accent),
            shape = RoundedCornerShape(10.dp)
        ) { Text("Sign In to Continue", fontSize = 16.sp, fontWeight = FontWeight.SemiBold) }
    }
}

private fun goalIcon(icon: String): ImageVector = when (icon) {
    "graduation" -> Icons.Outlined.School
    "house" -> Icons.Outlined.Home
    "plane" -> Icons.Outlined.Flight
    "car" -> Icons.Outlined.DirectionsCar
    "ring" -> Icons.Outlined.Favorite
    "baby" -> Icons.Outlined.ChildCare
    "shield" -> Icons.Outlined.Shield
    "piggy" -> Icons.Outlined.Savings
    "star" -> Icons.Outlined.Star
    else -> Icons.Outlined.Flag
}
