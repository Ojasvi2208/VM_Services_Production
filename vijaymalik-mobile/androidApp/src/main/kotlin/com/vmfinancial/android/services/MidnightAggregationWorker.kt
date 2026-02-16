package com.vmfinancial.android.services

import android.app.NotificationManager
import android.content.Context
import androidx.core.app.NotificationCompat
import androidx.work.*
import com.vmfinancial.android.R
import com.vmfinancial.android.data.db.AkshayaDatabase
import com.vmfinancial.android.data.db.DailySummaryEntity
import com.vmfinancial.android.data.db.MonthlyReportEntity
import com.vmfinancial.android.data.db.WeeklyReportEntity
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.TimeUnit

/**
 * Runs every night at 2:00 AM to:
 * 1. Finalize yesterday's DailySummary (total spent, top category)
 * 2. Aggregate into WeeklyReport (if Sunday)
 * 3. Aggregate into MonthlyReport (if 1st of month)
 * 4. Trigger insight push if discretionary spend exceeds threshold
 *
 * Result: Expenses Screen loads in <100ms — just reads pre-computed rows.
 */
class MidnightAggregationWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    companion object {
        const val WORK_NAME = "midnight_aggregation"

        fun schedule(context: Context) {
            // Calculate delay to next 2:00 AM
            val now = Calendar.getInstance()
            val target = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, 2)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
                if (before(now)) add(Calendar.DAY_OF_MONTH, 1)
            }
            val delayMs = target.timeInMillis - now.timeInMillis

            val request = PeriodicWorkRequestBuilder<MidnightAggregationWorker>(
                24, TimeUnit.HOURS
            )
                .setInitialDelay(delayMs, TimeUnit.MILLISECONDS)
                .setConstraints(
                    Constraints.Builder()
                        .setRequiresBatteryNotLow(true)
                        .build()
                )
                .addTag(WORK_NAME)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
            println("MidnightAggregation: Scheduled, next run in ${delayMs / 60000} min")
        }
    }

    private val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)
    private val monthFormat = SimpleDateFormat("yyyy-MM", Locale.US)

    override suspend fun doWork(): Result {
        println("MidnightAggregation: Starting nightly aggregation")
        val dao = AkshayaDatabase.getInstance(applicationContext).transactionDao()

        try {
            val cal = Calendar.getInstance()
            cal.add(Calendar.DAY_OF_MONTH, -1)
            val yesterday = dateFormat.format(cal.time)

            // ── 1. Finalize yesterday's daily summary ──
            val existingSummary = dao.getDailySummary(yesterday)
            if (existingSummary == null || !existingSummary.isFinalized) {
                val totalSpent = dao.totalSpentOnDate(yesterday)
                val totalReceived = dao.totalReceivedOnDate(yesterday)
                val txnCount = dao.todayCount(yesterday)
                val categories = dao.categoryBreakdown(yesterday, yesterday)
                val topCat = categories.firstOrNull()

                dao.upsertDailySummary(
                    DailySummaryEntity(
                        id = existingSummary?.id ?: 0,
                        date = yesterday,
                        totalSpent = totalSpent,
                        totalReceived = totalReceived,
                        transactionCount = txnCount,
                        topCategory = topCat?.category ?: "",
                        topCategoryAmount = topCat?.total ?: 0.0,
                        isFinalized = true,
                        finalizedAt = System.currentTimeMillis()
                    )
                )
                println("MidnightAggregation: Finalized $yesterday — Spent ₹$totalSpent, $txnCount txns")
            }

            // ── 2. Weekly report (every Sunday night → aggregates Mon-Sun) ──
            cal.time = Date() // reset to today
            if (cal.get(Calendar.DAY_OF_WEEK) == Calendar.MONDAY) {
                // Just finished Sunday, aggregate previous week
                cal.add(Calendar.DAY_OF_MONTH, -7)
                val weekStart = dateFormat.format(cal.time)
                cal.add(Calendar.DAY_OF_MONTH, 6)
                val weekEnd = dateFormat.format(cal.time)

                val summaries = dao.dailySummariesBetween(weekStart, weekEnd)
                val weeklySpent = summaries.sumOf { it.totalSpent }
                val weeklyReceived = summaries.sumOf { it.totalReceived }
                val weeklyTxns = summaries.sumOf { it.transactionCount }
                val discretionary = dao.discretionarySpendBetween(weekStart, weekEnd)
                val categories = dao.categoryBreakdown(weekStart, weekEnd)
                val topCat = categories.firstOrNull()

                dao.upsertWeeklyReport(
                    WeeklyReportEntity(
                        weekStart = weekStart,
                        weekEnd = weekEnd,
                        totalSpent = weeklySpent,
                        totalReceived = weeklyReceived,
                        avgDailySpend = if (summaries.isNotEmpty()) weeklySpent / summaries.size else 0.0,
                        transactionCount = weeklyTxns,
                        topCategory = topCat?.category ?: "",
                        topCategoryAmount = topCat?.total ?: 0.0,
                        discretionarySpend = discretionary
                    )
                )
                println("MidnightAggregation: Weekly report $weekStart→$weekEnd — Spent ₹$weeklySpent")

                // Insight: weekly discretionary spend nudge
                if (discretionary > 0) {
                    val growth = SmsTransactionParser.projectGrowth(discretionary / 4, 10)
                    sendInsightNotification(
                        "You spent ₹${discretionary.toLong()} on luxuries this week",
                        "If ₹${(discretionary / 4).toLong()}/week went into your Akshaya Legacy Fund via SIP, " +
                                "it could grow to $growth in 10 years!"
                    )
                }
            }

            // ── 3. Monthly report (1st of every month → aggregates previous month) ──
            cal.time = Date()
            if (cal.get(Calendar.DAY_OF_MONTH) == 1) {
                cal.add(Calendar.MONTH, -1)
                val prevMonth = monthFormat.format(cal.time)
                val monthStart = "$prevMonth-01"
                cal.set(Calendar.DAY_OF_MONTH, cal.getActualMaximum(Calendar.DAY_OF_MONTH))
                val monthEnd = dateFormat.format(cal.time)

                val summaries = dao.dailySummariesBetween(monthStart, monthEnd)
                val monthlySpent = summaries.sumOf { it.totalSpent }
                val monthlyReceived = summaries.sumOf { it.totalReceived }
                val monthlyTxns = summaries.sumOf { it.transactionCount }
                val discretionary = dao.discretionarySpendBetween(monthStart, monthEnd)
                val categories = dao.categoryBreakdown(monthStart, monthEnd)
                val topCat = categories.firstOrNull()

                dao.upsertMonthlyReport(
                    MonthlyReportEntity(
                        month = prevMonth,
                        totalSpent = monthlySpent,
                        totalReceived = monthlyReceived,
                        avgDailySpend = if (summaries.isNotEmpty()) monthlySpent / summaries.size else 0.0,
                        transactionCount = monthlyTxns,
                        topCategory = topCat?.category ?: "",
                        topCategoryAmount = topCat?.total ?: 0.0,
                        discretionarySpend = discretionary,
                        potentialSip = discretionary * 0.5 // suggest investing 50% of luxuries
                    )
                )
                println("MidnightAggregation: Monthly report $prevMonth — Spent ₹$monthlySpent, Discretionary ₹$discretionary")

                // Monthly insight push
                if (discretionary > 2000) {
                    val sipAmount = (discretionary * 0.5).toLong()
                    val growth = SmsTransactionParser.projectGrowth(sipAmount.toDouble(), 10)
                    sendInsightNotification(
                        "Monthly Insight: ₹${discretionary.toLong()} on luxuries",
                        "You spent ₹${discretionary.toLong()} on non-essentials last month. " +
                                "A SIP of ₹$sipAmount/month could grow to $growth in 10 years. " +
                                "Your father's discipline, your legacy."
                    )
                }
            }

            // ── 4. Cleanup: delete raw transactions older than 90 days ──
            cal.time = Date()
            cal.add(Calendar.DAY_OF_MONTH, -90)
            val cutoff = dateFormat.format(cal.time)
            dao.deleteOlderThan(cutoff)

            println("MidnightAggregation: Done")
            return Result.success()

        } catch (e: Exception) {
            println("MidnightAggregation: Error: ${e.message}")
            return Result.retry()
        }
    }

    private fun sendInsightNotification(title: String, body: String) {
        val notification = NotificationCompat.Builder(applicationContext, VMFirebaseMessagingService.CHANNEL_GENERAL)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body.take(60))
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setColor(0xFF14B8A6.toInt())
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()

        val manager = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(6000 + (System.currentTimeMillis() % 100).toInt(), notification)
    }
}
