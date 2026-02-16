package com.vmfinancial.android

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import androidx.compose.runtime.collectAsState
import com.google.firebase.messaging.FirebaseMessaging
import com.vmfinancial.android.services.AuthService
import com.vmfinancial.android.services.MidnightAggregationWorker
import com.vmfinancial.android.services.ThemeManager
import com.vmfinancial.android.services.ThemeMode
import com.vmfinancial.android.services.VMFirebaseMessagingService
import com.vmfinancial.android.ui.navigation.VMNavigation
import com.vmfinancial.android.ui.theme.VMFinancialTheme

class MainActivity : ComponentActivity() {

    lateinit var themeManager: ThemeManager
        private set
    lateinit var authService: AuthService
        private set

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        Log.d("MainActivity", "Notification permission granted: $granted")
        if (granted) subscribeToTopics()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        themeManager = ThemeManager(this)
        authService = AuthService(this)

        // Create notification channels
        VMFirebaseMessagingService.createNotificationChannels(this)

        // Request notification permission (Android 13+)
        requestNotificationPermission()

        // Subscribe to default FCM topics
        subscribeToTopics()

        // Schedule midnight expense aggregation (2:00 AM daily)
        MidnightAggregationWorker.schedule(this)

        enableEdgeToEdge()
        setContent {
            val themeMode = themeManager.themeMode.collectAsState()
            val forceDark: Boolean? = when (themeMode.value) {
                ThemeMode.LIGHT -> false
                ThemeMode.DARK -> true
                ThemeMode.SYSTEM -> null
            }
            VMFinancialTheme(forceDark = forceDark) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    VMNavigation(authService = authService)
                }
            }
        }
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    private fun subscribeToTopics() {
        val topics = listOf(
            "market_alerts",    // Market open/close, big moves
            "breaking_news",    // Breaking financial news
            "nfo_alerts",       // NFO open/close reminders
            "daily_briefing"    // Morning market briefing
        )
        topics.forEach { topic ->
            FirebaseMessaging.getInstance().subscribeToTopic(topic)
                .addOnCompleteListener { task ->
                    Log.d("MainActivity", "Subscribe to $topic: ${task.isSuccessful}")
                }
        }
    }
}
