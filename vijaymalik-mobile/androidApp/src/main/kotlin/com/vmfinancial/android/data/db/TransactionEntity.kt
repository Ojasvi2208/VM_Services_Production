package com.vmfinancial.android.data.db

import androidx.room.*

// ════════════════════════════════════════════════════════════════════
//  TRANSACTION — every SMS-detected spend/credit stored locally
// ════════════════════════════════════════════════════════════════════

@Entity(
    tableName = "transactions",
    indices = [
        Index("date"),
        Index("category"),
        Index("transaction_type")
    ]
)
data class TransactionEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "amount") val amount: Double,
    @ColumnInfo(name = "transaction_type") val transactionType: String, // DEBIT or CREDIT
    @ColumnInfo(name = "merchant") val merchant: String,
    @ColumnInfo(name = "category") val category: String, // coffee, dining, shopping, etc. or "uncategorized"
    @ColumnInfo(name = "bank_sender") val bankSender: String,
    @ColumnInfo(name = "date") val date: String, // yyyy-MM-dd
    @ColumnInfo(name = "timestamp") val timestamp: Long = System.currentTimeMillis(),
    @ColumnInfo(name = "sms_hash") val smsHash: Int = 0, // dedup: hash of SMS body
    @ColumnInfo(name = "account_tail") val accountTail: String = "" // last 4 digits XX1234
)

// ════════════════════════════════════════════════════════════════════
//  DAILY SUMMARY — finalized by WorkManager at 2:00 AM
// ════════════════════════════════════════════════════════════════════

@Entity(
    tableName = "daily_summary",
    indices = [Index(value = ["date"], unique = true)]
)
data class DailySummaryEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "date") val date: String, // yyyy-MM-dd
    @ColumnInfo(name = "total_spent") val totalSpent: Double = 0.0,
    @ColumnInfo(name = "total_received") val totalReceived: Double = 0.0,
    @ColumnInfo(name = "transaction_count") val transactionCount: Int = 0,
    @ColumnInfo(name = "top_category") val topCategory: String = "",
    @ColumnInfo(name = "top_category_amount") val topCategoryAmount: Double = 0.0,
    @ColumnInfo(name = "is_finalized") val isFinalized: Boolean = false,
    @ColumnInfo(name = "finalized_at") val finalizedAt: Long = 0
)

// ════════════════════════════════════════════════════════════════════
//  WEEKLY REPORT — aggregated from daily summaries
// ════════════════════════════════════════════════════════════════════

@Entity(
    tableName = "weekly_report",
    indices = [Index(value = ["week_start"], unique = true)]
)
data class WeeklyReportEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "week_start") val weekStart: String, // yyyy-MM-dd (Monday)
    @ColumnInfo(name = "week_end") val weekEnd: String,     // yyyy-MM-dd (Sunday)
    @ColumnInfo(name = "total_spent") val totalSpent: Double = 0.0,
    @ColumnInfo(name = "total_received") val totalReceived: Double = 0.0,
    @ColumnInfo(name = "avg_daily_spend") val avgDailySpend: Double = 0.0,
    @ColumnInfo(name = "transaction_count") val transactionCount: Int = 0,
    @ColumnInfo(name = "top_category") val topCategory: String = "",
    @ColumnInfo(name = "top_category_amount") val topCategoryAmount: Double = 0.0,
    @ColumnInfo(name = "discretionary_spend") val discretionarySpend: Double = 0.0
)

// ════════════════════════════════════════════════════════════════════
//  MONTHLY REPORT — aggregated from daily summaries
// ════════════════════════════════════════════════════════════════════

@Entity(
    tableName = "monthly_report",
    indices = [Index(value = ["month"], unique = true)]
)
data class MonthlyReportEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "month") val month: String, // yyyy-MM
    @ColumnInfo(name = "total_spent") val totalSpent: Double = 0.0,
    @ColumnInfo(name = "total_received") val totalReceived: Double = 0.0,
    @ColumnInfo(name = "avg_daily_spend") val avgDailySpend: Double = 0.0,
    @ColumnInfo(name = "transaction_count") val transactionCount: Int = 0,
    @ColumnInfo(name = "top_category") val topCategory: String = "",
    @ColumnInfo(name = "top_category_amount") val topCategoryAmount: Double = 0.0,
    @ColumnInfo(name = "discretionary_spend") val discretionarySpend: Double = 0.0,
    @ColumnInfo(name = "potential_sip") val potentialSip: Double = 0.0 // how much could be invested
)

// ════════════════════════════════════════════════════════════════════
//  CATEGORY BREAKDOWN — per-category spend per day
// ════════════════════════════════════════════════════════════════════

@Entity(
    tableName = "category_daily",
    indices = [Index(value = ["date", "category"], unique = true)]
)
data class CategoryDailyEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "date") val date: String,
    @ColumnInfo(name = "category") val category: String,
    @ColumnInfo(name = "amount") val amount: Double = 0.0,
    @ColumnInfo(name = "count") val count: Int = 0
)
