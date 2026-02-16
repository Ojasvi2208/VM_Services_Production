package com.vmfinancial.android.data.db

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface TransactionDao {

    // ── Insert ──
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(transaction: TransactionEntity): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertDailySummary(summary: DailySummaryEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertWeeklyReport(report: WeeklyReportEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertMonthlyReport(report: MonthlyReportEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertCategoryDaily(entry: CategoryDailyEntity)

    // ── Dedup check ──
    @Query("SELECT COUNT(*) FROM transactions WHERE sms_hash = :hash")
    suspend fun countByHash(hash: Int): Int

    // ── Today's live counter ──
    @Query("SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE date = :date AND transaction_type = 'DEBIT'")
    fun todaySpentFlow(date: String): Flow<Double>

    @Query("SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE date = :date AND transaction_type = 'DEBIT'")
    suspend fun todaySpent(date: String): Double

    @Query("SELECT COUNT(*) FROM transactions WHERE date = :date")
    suspend fun todayCount(date: String): Int

    // ── Transactions by date ──
    @Query("SELECT * FROM transactions WHERE date = :date ORDER BY timestamp DESC")
    fun transactionsByDateFlow(date: String): Flow<List<TransactionEntity>>

    @Query("SELECT * FROM transactions WHERE date = :date ORDER BY timestamp DESC")
    suspend fun transactionsByDate(date: String): List<TransactionEntity>

    @Query("SELECT * FROM transactions WHERE date BETWEEN :startDate AND :endDate ORDER BY timestamp DESC")
    suspend fun transactionsBetween(startDate: String, endDate: String): List<TransactionEntity>

    // ── Category breakdown for a date range ──
    @Query("""
        SELECT category, SUM(amount) as total, COUNT(*) as cnt
        FROM transactions
        WHERE date BETWEEN :startDate AND :endDate AND transaction_type = 'DEBIT'
        GROUP BY category
        ORDER BY total DESC
    """)
    suspend fun categoryBreakdown(startDate: String, endDate: String): List<CategorySum>

    // ── Daily summaries ──
    @Query("SELECT * FROM daily_summary WHERE date = :date LIMIT 1")
    suspend fun getDailySummary(date: String): DailySummaryEntity?

    @Query("SELECT * FROM daily_summary WHERE date BETWEEN :startDate AND :endDate ORDER BY date DESC")
    suspend fun dailySummariesBetween(startDate: String, endDate: String): List<DailySummaryEntity>

    @Query("SELECT * FROM daily_summary ORDER BY date DESC LIMIT :limit")
    fun recentDailySummariesFlow(limit: Int): Flow<List<DailySummaryEntity>>

    // ── Weekly reports ──
    @Query("SELECT * FROM weekly_report WHERE week_start = :weekStart LIMIT 1")
    suspend fun getWeeklyReport(weekStart: String): WeeklyReportEntity?

    @Query("SELECT * FROM weekly_report ORDER BY week_start DESC LIMIT :limit")
    fun recentWeeklyReportsFlow(limit: Int): Flow<List<WeeklyReportEntity>>

    // ── Monthly reports ──
    @Query("SELECT * FROM monthly_report WHERE month = :month LIMIT 1")
    suspend fun getMonthlyReport(month: String): MonthlyReportEntity?

    @Query("SELECT * FROM monthly_report ORDER BY month DESC LIMIT :limit")
    fun recentMonthlyReportsFlow(limit: Int): Flow<List<MonthlyReportEntity>>

    // ── Aggregation helpers (used by WorkManager) ──
    @Query("""
        SELECT COALESCE(SUM(amount), 0) FROM transactions
        WHERE date = :date AND transaction_type = 'DEBIT'
    """)
    suspend fun totalSpentOnDate(date: String): Double

    @Query("""
        SELECT COALESCE(SUM(amount), 0) FROM transactions
        WHERE date = :date AND transaction_type = 'CREDIT'
    """)
    suspend fun totalReceivedOnDate(date: String): Double

    @Query("""
        SELECT COALESCE(SUM(amount), 0) FROM transactions
        WHERE date BETWEEN :startDate AND :endDate
        AND transaction_type = 'DEBIT'
        AND category IN ('coffee', 'alcohol', 'dining', 'shopping', 'entertainment', 'ride', 'subscription')
    """)
    suspend fun discretionarySpendBetween(startDate: String, endDate: String): Double

    // ── Cleanup ──
    @Query("DELETE FROM transactions WHERE date < :beforeDate")
    suspend fun deleteOlderThan(beforeDate: String)
}

data class CategorySum(
    val category: String,
    val total: Double,
    val cnt: Int
)
