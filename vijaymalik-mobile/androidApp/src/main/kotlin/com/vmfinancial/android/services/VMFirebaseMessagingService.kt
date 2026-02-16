package com.vmfinancial.android.services

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.vmfinancial.android.MainActivity
import com.vmfinancial.android.R

class VMFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "VMFirebaseMsgService"

        // Notification channels
        const val CHANNEL_MARKET = "market_alerts"
        const val CHANNEL_NEWS = "breaking_news"
        const val CHANNEL_NFO = "nfo_alerts"
        const val CHANNEL_PORTFOLIO = "portfolio_alerts"
        const val CHANNEL_GENERAL = "general"

        fun createNotificationChannels(context: Context) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val manager = context.getSystemService(NotificationManager::class.java)

                val channels = listOf(
                    NotificationChannel(
                        CHANNEL_MARKET, "Market Alerts",
                        NotificationManager.IMPORTANCE_HIGH
                    ).apply {
                        description = "Market open/close, significant moves, Gift Nifty alerts"
                        enableVibration(true)
                    },
                    NotificationChannel(
                        CHANNEL_NEWS, "Breaking News",
                        NotificationManager.IMPORTANCE_HIGH
                    ).apply {
                        description = "Breaking financial news and market updates"
                        enableVibration(true)
                    },
                    NotificationChannel(
                        CHANNEL_NFO, "NFO Alerts",
                        NotificationManager.IMPORTANCE_DEFAULT
                    ).apply {
                        description = "New fund offer open/close date reminders"
                    },
                    NotificationChannel(
                        CHANNEL_PORTFOLIO, "Portfolio Alerts",
                        NotificationManager.IMPORTANCE_DEFAULT
                    ).apply {
                        description = "Portfolio value changes and dividend credits"
                    },
                    NotificationChannel(
                        CHANNEL_GENERAL, "General",
                        NotificationManager.IMPORTANCE_DEFAULT
                    ).apply {
                        description = "App updates and announcements"
                    }
                )

                channels.forEach { manager.createNotificationChannel(it) }
            }
        }
    }

    override fun onNewToken(token: String) {
        Log.d(TAG, "FCM Token: $token")
        // TODO: Send token to backend for targeted notifications
        // BackendApi().registerDeviceToken(token)
        saveTokenLocally(token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        Log.d(TAG, "From: ${message.from}")

        // Data payload (sent from backend)
        val data = message.data
        val title = data["title"] ?: message.notification?.title ?: "Akshaya"
        val body = data["body"] ?: message.notification?.body ?: ""
        val type = data["type"] ?: "general"
        val action = data["action"] // e.g., "index_detail/NIFTY" or "fund_detail/119028"

        val channelId = when (type) {
            "market", "market_open", "market_close", "gift_nifty" -> CHANNEL_MARKET
            "news", "breaking" -> CHANNEL_NEWS
            "nfo", "nfo_open", "nfo_close" -> CHANNEL_NFO
            "portfolio", "dividend" -> CHANNEL_PORTFOLIO
            else -> CHANNEL_GENERAL
        }

        sendNotification(title, body, channelId, action)
    }

    private fun sendNotification(title: String, body: String, channelId: String, action: String?) {
        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            action?.let { putExtra("navigate_to", it) }
        }

        val pendingIntent = PendingIntent.getActivity(
            this, System.currentTimeMillis().toInt(), intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )

        val defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setSound(defaultSoundUri)
            .setContentIntent(pendingIntent)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setColor(0xFF14B8A6.toInt()) // Teal accent
            .build()

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(System.currentTimeMillis().toInt(), notification)
    }

    private fun saveTokenLocally(token: String) {
        getSharedPreferences("vm_prefs", Context.MODE_PRIVATE)
            .edit()
            .putString("fcm_token", token)
            .apply()
    }
}
