package com.vmfinancial.android.data.db

import android.content.Context
import androidx.room.*

/**
 * Stale-While-Revalidate cache for the Akshaya Home Screen.
 * Stores serialized JSON blobs keyed by data type.
 * Separate DB from transactions — no migration coupling.
 */

@Entity(tableName = "home_cache")
data class HomeCacheEntity(
    @PrimaryKey val key: String,          // e.g. "markets", "headlines", "fuel", "weather"
    val json: String,                      // Serialized JSON payload
    val updatedAt: Long = System.currentTimeMillis()  // Epoch millis
)

@Dao
interface HomeCacheDao {

    @Query("SELECT * FROM home_cache WHERE `key` = :key LIMIT 1")
    suspend fun get(key: String): HomeCacheEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun put(entity: HomeCacheEntity)

    @Query("DELETE FROM home_cache WHERE `key` = :key")
    suspend fun delete(key: String)

    @Query("DELETE FROM home_cache")
    suspend fun clear()

    @Query("SELECT updatedAt FROM home_cache WHERE `key` = :key LIMIT 1")
    suspend fun getTimestamp(key: String): Long?
}

@Database(
    entities = [HomeCacheEntity::class],
    version = 1,
    exportSchema = false
)
abstract class HomeCacheDatabase : RoomDatabase() {

    abstract fun homeCacheDao(): HomeCacheDao

    companion object {
        @Volatile
        private var INSTANCE: HomeCacheDatabase? = null

        fun getInstance(context: Context): HomeCacheDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    HomeCacheDatabase::class.java,
                    "akshaya_home_cache.db"
                )
                    .fallbackToDestructiveMigration()
                    .build()
                    .also { INSTANCE = it }
            }
        }
    }
}
