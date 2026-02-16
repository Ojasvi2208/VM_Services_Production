package com.vmfinancial.shared.data.models

import kotlinx.serialization.Serializable

// ── Goal Planning Models ──

@Serializable
data class Goal(
    val id: String = "",
    val name: String = "",
    val icon: String = "target",
    val color: String = "#6366F1",
    val targetAmount: Double = 0.0,
    val targetDate: String = "",
    val criticality: String = "important",
    val monthlySip: Double = 0.0,
    val recommendedSip: Double = 0.0,
    val inflationRate: Double = 6.0,
    val expectedReturn: Double = 12.0,
    val currentValue: Double = 0.0,
    val successProbability: Double = 0.0,
    val progressPercent: Double = 0.0,
    val linkedFunds: List<GoalFundLink> = emptyList(),
    val totalContributed: Double = 0.0,
    val notes: String? = null,
    val isActive: Boolean = true,
    val createdAt: String? = null,
    val updatedAt: String? = null
)

@Serializable
data class GoalFundLink(
    val id: String = "",
    val schemeCode: String = "",
    val allocationPct: Double = 100.0,
    val schemeName: String? = null,
    val currentNav: Double? = null
)

@Serializable
data class GoalSummary(
    val totalGoals: Int = 0,
    val totalTargetValue: Double = 0.0,
    val totalCurrentValue: Double = 0.0,
    val totalMonthlySip: Double = 0.0,
    val overallProgressPercent: Double = 0.0,
    val criticalGoalsOnTrack: Int = 0,
    val criticalGoalsAtRisk: Int = 0
)

@Serializable
data class GoalsResponse(
    val success: Boolean = false,
    val goals: List<Goal> = emptyList(),
    val summary: GoalSummary? = null,
    val error: String? = null
)

@Serializable
data class GoalDetailResponse(
    val success: Boolean = false,
    val goal: Goal? = null,
    val projection: GoalProjection? = null,
    val contributions: List<GoalContribution> = emptyList(),
    val error: String? = null
)

@Serializable
data class GoalProjection(
    val successProbability: Double = 0.0,
    val p10: Double = 0.0,
    val p50: Double = 0.0,
    val p90: Double = 0.0,
    val mean: Double = 0.0,
    val shortfall: Double = 0.0,
    val chartData: List<ProjectionPoint> = emptyList()
)

@Serializable
data class ProjectionPoint(
    val month: Int = 0,
    val p10: Double = 0.0,
    val p50: Double = 0.0,
    val p90: Double = 0.0
)

@Serializable
data class GoalContribution(
    val id: String = "",
    val amount: Double = 0.0,
    val date: String = "",
    val source: String = "manual",
    val notes: String? = null,
    val createdAt: String? = null
)

@Serializable
data class CreateGoalResponse(
    val success: Boolean = false,
    val goal: Goal? = null,
    val error: String? = null
)

@Serializable
data class ContributeResponse(
    val success: Boolean = false,
    val contributionId: String? = null,
    val newCurrentValue: Double = 0.0,
    val error: String? = null
)

// ── Autonomous Evaluation Models ──

@Serializable
data class GoalFlag(
    val goalId: String = "",
    val goalName: String = "",
    val icon: String = "target",
    val color: String = "#6366F1",
    val criticality: String = "important",
    val flag: String = "green",
    val flagReason: String = "",
    val suggestedAction: String = "",
    val rebalanceAmount: Double? = null,
    val extensionMonths: Int? = null,
    val topupAmount: Double? = null,
    val successProbability: Double = 0.0,
    val projectedP50: Double = 0.0,
    val shortfall: Double = 0.0,
    val confidenceScore: Double = 0.0,
    val geminiEnhanced: Boolean = false,
    val evaluatedAt: String? = null,
    val navDate: String? = null,
    val trend: List<FlagTrendPoint> = emptyList()
)

@Serializable
data class FlagTrendPoint(
    val date: String = "",
    val flag: String = "green",
    val probability: Double = 0.0
)

@Serializable
data class WeeklyFlag(
    val goalId: String = "",
    val goalName: String = "",
    val flag: String = "green",
    val flagReason: String = "",
    val suggestedAction: String = "",
    val successProbability: Double = 0.0
)

@Serializable
data class MonthlyNarrative(
    val monthKey: String = "",
    val summary: String = "",
    val goalsEvaluated: Int = 0,
    val criticalFlags: Int = 0,
    val generatedAt: String? = null
)

@Serializable
data class OverallStatus(
    val totalGoals: Int = 0,
    val green: Int = 0,
    val amber: Int = 0,
    val red: Int = 0
)

@Serializable
data class EvaluationsResponse(
    val success: Boolean = false,
    val flags: List<GoalFlag> = emptyList(),
    val weeklyFlags: List<WeeklyFlag> = emptyList(),
    val monthlyNarrative: MonthlyNarrative? = null,
    val overallStatus: OverallStatus? = null,
    val disclosure: String = "",
    val error: String? = null
)
