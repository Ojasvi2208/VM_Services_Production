package com.vmfinancial.android.ui.screens.premium

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vmfinancial.android.ui.theme.VMColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PremiumScreen(onBack: () -> Unit) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Premium", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(Modifier.height(20.dp))

            // Crown icon
            Icon(
                Icons.Filled.Star,
                contentDescription = null,
                tint = Color(0xFFF59E0B),
                modifier = Modifier.size(60.dp)
            )

            Spacer(Modifier.height(12.dp))

            Text("VM Premium", fontSize = 26.sp, fontWeight = FontWeight.Bold)
            Text(
                "Unlock advanced portfolio analytics",
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(Modifier.height(28.dp))

            // Features list
            Column(
                modifier = Modifier.padding(horizontal = 24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                PremiumFeatureRow(
                    icon = Icons.Filled.DocumentScanner,
                    title = "CAS Import",
                    description = "Auto-import all your mutual fund holdings from CAMS/KFintech"
                )
                PremiumFeatureRow(
                    icon = Icons.Filled.BarChart,
                    title = "Advanced Analytics",
                    description = "Portfolio overlap, drawdowns, rolling returns"
                )
                PremiumFeatureRow(
                    icon = Icons.Filled.Description,
                    title = "Tax Reports",
                    description = "Capital gains, dividend income reports"
                )
                PremiumFeatureRow(
                    icon = Icons.Filled.TrackChanges,
                    title = "Goal Tracking",
                    description = "Visual progress towards financial goals"
                )
                PremiumFeatureRow(
                    icon = Icons.Filled.SupportAgent,
                    title = "Priority Support",
                    description = "Direct access to financial advisors"
                )
                PremiumFeatureRow(
                    icon = Icons.Filled.NotificationsActive,
                    title = "Smart Alerts",
                    description = "Personalized investment recommendations"
                )
            }

            Spacer(Modifier.height(32.dp))

            // Pricing section
            Text(
                "\u20B930/year",
                fontSize = 44.sp,
                fontWeight = FontWeight.Bold,
                color = VMColors.Accent
            )

            Text(
                "Less than \u20B93/month",
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(Modifier.height(4.dp))

            Text(
                "One-time yearly payment \u2022 Cancel anytime",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
            )

            Spacer(Modifier.height(20.dp))

            // Upgrade button with gradient
            Button(
                onClick = { /* TODO: Implement payment */ },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 32.dp)
                    .height(52.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                contentPadding = PaddingValues()
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.horizontalGradient(
                                colors = listOf(Color(0xFFF59E0B), VMColors.Accent)
                            ),
                            RoundedCornerShape(12.dp)
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Filled.Star, contentDescription = null, tint = Color.White)
                        Text(
                            "Upgrade Now - \u20B930/year",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }
                }
            }

            Spacer(Modifier.height(16.dp))

            Text(
                "Introductory offer",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color(0xFFF59E0B)
            )

            Spacer(Modifier.height(40.dp))
        }
    }
}

@Composable
private fun PremiumFeatureRow(icon: ImageVector, title: String, description: String) {
    Row(
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Icon(
            icon,
            contentDescription = null,
            tint = VMColors.Accent,
            modifier = Modifier.size(28.dp)
        )
        Column {
            Text(title, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            Text(
                description,
                fontSize = 13.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                lineHeight = 18.sp
            )
        }
    }
}
