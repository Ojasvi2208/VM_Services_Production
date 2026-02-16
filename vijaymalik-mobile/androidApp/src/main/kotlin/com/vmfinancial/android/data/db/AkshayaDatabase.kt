package com.vmfinancial.android.data.db

import android.content.Context
import androidx.room.*

@Database(
    entities = [
        TransactionEntity::class,
        DailySummaryEntity::class,
        WeeklyReportEntity::class,
        MonthlyReportEntity::class,
        CategoryDailyEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class AkshayaDatabase : RoomDatabase() {

    abstract fun transactionDao(): TransactionDao

    companion object {
        @Volatile
        private var INSTANCE: AkshayaDatabase? = null

        fun getInstance(context: Context): AkshayaDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    AkshayaDatabase::class.java,
                    "akshaya_transactions.db"
                )
                    .fallbackToDestructiveMigration()
                    .build()
                    .also { INSTANCE = it }
            }
        }
    }
}
