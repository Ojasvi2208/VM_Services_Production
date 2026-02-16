package com.vmfinancial.android.ui.screens.profile

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.HelpOutline
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vmfinancial.android.MainActivity
import com.vmfinancial.android.services.AuthService
import com.vmfinancial.android.services.AuthUser
import com.vmfinancial.android.services.ThemeMode
import com.vmfinancial.android.ui.theme.VMColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(onNavigateToAuth: () -> Unit = {}, onNavigateToSignUp: () -> Unit = {}, onExternalNavigate: (String) -> Unit = {}) {
    val context = LocalContext.current
    val authService = (context as? MainActivity)?.authService
    val currentUser by authService?.currentUser?.collectAsState() ?: remember { mutableStateOf<AuthUser?>(null) }
    var currentPage by remember { mutableStateOf<String?>(null) }

    when (currentPage) {
        "notifications" -> NotificationSettingsPage { currentPage = null }
        "appearance" -> AppearancePage { currentPage = null }
        "language" -> LanguagePage { currentPage = null }
        "terms" -> TermsOfServicePage { currentPage = null }
        "privacy" -> PrivacyPolicyPage { currentPage = null }
        "about" -> AboutUsPage { currentPage = null }
        else -> ProfileMainScreen(
            isSignedIn = currentUser != null,
            currentUser = currentUser,
            onSignIn = onNavigateToAuth,
            onCreateAccount = onNavigateToSignUp,
            onSignOut = { authService?.signOut() },
            onNavigate = { route ->
                // External routes go through NavController; internal routes use currentPage
                when (route) {
                    "cas_import", "analytics", "calculators", "learn", "premium" -> onExternalNavigate(route)
                    else -> currentPage = route
                }
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ProfileMainScreen(
    isSignedIn: Boolean,
    currentUser: AuthUser? = null,
    onSignIn: () -> Unit,
    onCreateAccount: () -> Unit,
    onSignOut: () -> Unit,
    onNavigate: (String) -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Profile", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(MaterialTheme.colorScheme.background),
            contentPadding = PaddingValues(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            if (!isSignedIn) {
                item { GuestHeader(onSignIn = onSignIn, onCreateAccount = onCreateAccount) }
                item { FeaturesPreview() }
            } else {
                item { SignedInHeader(user = currentUser, onSignOut = onSignOut) }
                item { AccountInfoCard(user = currentUser) }
                item { QuickActionsCard(onNavigate) }
            }

            // Settings
            item { SettingsSection(onNavigate) }

            // About
            item { AboutSection(onNavigate) }

            // App version
            item {
                Text(
                    "Akshaya v1.0.0",
                    modifier = Modifier.fillMaxWidth(),
                    textAlign = TextAlign.Center,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                )
            }
        }
    }
}

@Composable
private fun GuestHeader(onSignIn: () -> Unit, onCreateAccount: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(top = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            Icons.Outlined.AccountCircle,
            contentDescription = null,
            modifier = Modifier.size(80.dp),
            tint = VMColors.Accent.copy(alpha = 0.3f)
        )
        Spacer(Modifier.height(12.dp))
        Text("Akshaya", fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Text("Eternal Wealth & Legacy", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(12.dp))
        Text(
            "Sign in to track your portfolio, set alerts, and get personalized recommendations.",
            fontSize = 14.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 40.dp)
        )
        Spacer(Modifier.height(20.dp))
        Button(
            onClick = onSignIn,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 32.dp).height(48.dp),
            colors = ButtonDefaults.buttonColors(containerColor = VMColors.Accent),
            shape = RoundedCornerShape(10.dp)
        ) {
            Text("Sign In", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        }
        Spacer(Modifier.height(6.dp))
        TextButton(onClick = onCreateAccount) {
            Text("Create Account", color = VMColors.Accent, fontSize = 14.sp)
        }
    }
}

@Composable
private fun SignedInHeader(user: AuthUser? = null, onSignOut: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(top = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Avatar with initials
        val initials = user?.fullName?.split(" ")?.take(2)?.mapNotNull { it.firstOrNull()?.uppercase() }?.joinToString("") ?: "U"
        Box(
            modifier = Modifier.size(70.dp).clip(CircleShape).background(VMColors.Accent.copy(alpha = 0.15f)),
            contentAlignment = Alignment.Center
        ) {
            Text(initials, fontSize = 26.sp, fontWeight = FontWeight.Bold, color = VMColors.Accent)
        }
        Spacer(Modifier.height(8.dp))
        Text(user?.fullName ?: "User", fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Text(user?.email ?: "", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)

        Spacer(Modifier.height(16.dp))
        TextButton(onClick = onSignOut) {
            Text("Sign Out", color = VMColors.Error, fontSize = 14.sp)
        }
    }
}

@Composable
private fun AccountInfoCard(user: AuthUser?) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Account", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.weight(1f))
                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = Color(0xFFF59E0B).copy(alpha = 0.15f)
                ) {
                    Text("Premium", fontSize = 11.sp, fontWeight = FontWeight.Bold,
                        color = Color(0xFFF59E0B), modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp))
                }
            }
            HorizontalDivider()
            AccountInfoRow("Email", user?.email ?: "")
            AccountInfoRow("Full Name", user?.fullName ?: "")
            AccountInfoRow("Account Type", "Premium")
            AccountInfoRow("Status", "Active")
        }
    }
}

@Composable
private fun AccountInfoRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, fontSize = 13.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun QuickActionsCard(onNavigate: (String) -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("Quick Actions", fontSize = 16.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 8.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                QuickActionItem(Icons.Outlined.DocumentScanner, "Import\nCAS") { onNavigate("cas_import") }
                QuickActionItem(Icons.Outlined.BarChart, "Analytics") { onNavigate("analytics") }
                QuickActionItem(Icons.Outlined.Receipt, "Expenses") { onNavigate("expenses") }
                QuickActionItem(Icons.Outlined.Calculate, "Calculators") { onNavigate("calculators") }
                QuickActionItem(Icons.Outlined.School, "Learn") { onNavigate("learn") }
            }
        }
    }
}

@Composable
private fun QuickActionItem(icon: ImageVector, label: String, onClick: () -> Unit) {
    Column(
        modifier = Modifier.clickable(onClick = onClick).padding(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier.size(44.dp).clip(RoundedCornerShape(12.dp))
                .background(VMColors.Accent.copy(alpha = 0.1f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, contentDescription = null, tint = VMColors.Accent, modifier = Modifier.size(22.dp))
        }
        Spacer(Modifier.height(4.dp))
        Text(label, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center, lineHeight = 14.sp)
    }
}

@Composable
private fun FeaturesPreview() {
    Column(modifier = Modifier.padding(horizontal = 16.dp)) {
        Text("What you'll get", fontSize = 16.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 12.dp))

        FeatureItem(Icons.Outlined.PieChart, "Portfolio Tracking", "Import your CAS and track all investments", false)
        FeatureItem(Icons.Outlined.Notifications, "Smart Alerts", "Get notified about NAV changes and market moves", false)
        FeatureItem(Icons.Outlined.TrackChanges, "Goal Planning with AI", "AI-powered financial goals and progress tracking", true)
        FeatureItem(Icons.Outlined.BarChart, "AI Advanced Analytics", "Portfolio overlap, risk metrics, and more", true)
    }
}

@Composable
private fun FeatureItem(icon: ImageVector, title: String, desc: String, isPremium: Boolean) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Icon(icon, contentDescription = null, tint = if (isPremium) Color(0xFFF59E0B) else VMColors.Accent, modifier = Modifier.size(24.dp))
        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                if (isPremium) {
                    Spacer(Modifier.width(6.dp))
                    Text("\uD83D\uDC51", fontSize = 12.sp)
                }
            }
            Text(desc, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun SettingsSection(onNavigate: (String) -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column {
            SettingsItem(Icons.Outlined.Notifications, "Notification Settings") { onNavigate("notifications") }
            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
            SettingsItem(Icons.Outlined.Palette, "Appearance") { onNavigate("appearance") }
            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
            SettingsItem(Icons.Outlined.Language, "Language") { onNavigate("language") }
        }
    }
}

@Composable
private fun AboutSection(onNavigate: (String) -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column {
            SettingsItem(Icons.Outlined.Description, "Terms of Service") { onNavigate("terms") }
            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
            SettingsItem(Icons.Outlined.Security, "Privacy Policy") { onNavigate("privacy") }
            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
            SettingsItem(Icons.Outlined.Info, "About Us") { onNavigate("about") }
        }
    }
}

@Composable
private fun SettingsItem(icon: ImageVector, title: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(12.dp))
        Text(title, fontSize = 15.sp)
        Spacer(Modifier.weight(1f))
        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(18.dp))
    }
}

// ═══════════════════════════════════════════════════
// MARK: - Appearance Page (Dark/Light Toggle)
// ═══════════════════════════════════════════════════
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AppearancePage(onBack: () -> Unit) {
    val context = LocalContext.current
    val themeManager = (context as? MainActivity)?.themeManager
    val currentTheme = themeManager?.themeMode?.collectAsState()?.value ?: ThemeMode.SYSTEM

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Appearance", fontWeight = FontWeight.Bold) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("Choose your preferred theme", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(4.dp))

            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column {
                    ThemeOption("System Default", "Follows your device settings", Icons.Outlined.PhoneAndroid, currentTheme == ThemeMode.SYSTEM) {
                        themeManager?.setTheme(ThemeMode.SYSTEM)
                    }
                    HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
                    ThemeOption("Light", "Always use light theme", Icons.Outlined.LightMode, currentTheme == ThemeMode.LIGHT) {
                        themeManager?.setTheme(ThemeMode.LIGHT)
                    }
                    HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
                    ThemeOption("Dark", "Always use dark theme", Icons.Outlined.DarkMode, currentTheme == ThemeMode.DARK) {
                        themeManager?.setTheme(ThemeMode.DARK)
                    }
                }
            }
        }
    }
}

@Composable
private fun ThemeOption(title: String, subtitle: String, icon: ImageVector, isSelected: Boolean, onClick: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, contentDescription = null, tint = if (isSelected) VMColors.Accent else MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(22.dp))
        Spacer(Modifier.width(14.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontSize = 15.sp, fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal)
            Text(subtitle, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        RadioButton(selected = isSelected, onClick = onClick, colors = RadioButtonDefaults.colors(selectedColor = VMColors.Accent))
    }
}

// ═══════════════════════════════════════════════════
// MARK: - Notification Settings Page
// ═══════════════════════════════════════════════════
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NotificationSettingsPage(onBack: () -> Unit) {
    val context = LocalContext.current
    var marketAlerts by remember { mutableStateOf(true) }
    var breakingNews by remember { mutableStateOf(true) }
    var nfoAlerts by remember { mutableStateOf(true) }
    var dailyBriefing by remember { mutableStateOf(true) }
    var portfolioAlerts by remember { mutableStateOf(false) }

    val prefs = remember { context.getSharedPreferences("akshaya_prefs", android.content.Context.MODE_PRIVATE) }
    var spendingNudges by remember { mutableStateOf(prefs.getBoolean("spending_nudges_enabled", true)) }

    // SMS permission launcher
    val smsPermissionLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val granted = permissions.values.all { it }
        if (granted) {
            spendingNudges = true
            prefs.edit().putBoolean("spending_nudges_enabled", true).apply()
        } else {
            spendingNudges = false
            prefs.edit().putBoolean("spending_nudges_enabled", false).apply()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Notification Settings", fontWeight = FontWeight.Bold) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding = PaddingValues(vertical = 8.dp)
        ) {
            item {
                Text("Choose which notifications you'd like to receive", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            item {
                Card(shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column {
                        NotificationToggle("Market Alerts", "Market open/close, significant index moves", marketAlerts) { marketAlerts = it }
                        HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
                        NotificationToggle("Breaking News", "Important financial news and updates", breakingNews) { breakingNews = it }
                        HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
                        NotificationToggle("NFO Alerts", "New fund offer open/close date reminders", nfoAlerts) { nfoAlerts = it }
                        HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
                        NotificationToggle("Daily Briefing", "Morning market summary at 9 AM", dailyBriefing) { dailyBriefing = it }
                        HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
                        NotificationToggle("Portfolio Alerts", "Portfolio value changes and dividends", portfolioAlerts) { portfolioAlerts = it }
                    }
                }
            }
            item {
                Card(shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column {
                        NotificationToggle(
                            "💡 Spending Nudges",
                            "Get investment nudges when you spend on coffee, dining, shopping etc. (Requires SMS permission)",
                            spendingNudges
                        ) { enabled ->
                            if (enabled) {
                                smsPermissionLauncher.launch(
                                    arrayOf(
                                        android.Manifest.permission.RECEIVE_SMS,
                                        android.Manifest.permission.READ_SMS
                                    )
                                )
                            } else {
                                spendingNudges = false
                                prefs.edit().putBoolean("spending_nudges_enabled", false).apply()
                            }
                        }
                    }
                }
                Spacer(Modifier.height(4.dp))
                Text(
                    "When enabled, the app reads bank SMS to detect spending and suggests how much that money could grow if invested via SIP.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 4.dp)
                )
            }
        }
    }
}

@Composable
private fun NotificationToggle(title: String, subtitle: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontSize = 15.sp, fontWeight = FontWeight.Medium)
            Text(subtitle, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(checkedTrackColor = VMColors.Accent, checkedThumbColor = Color.White)
        )
    }
}

// ═══════════════════════════════════════════════════
// MARK: - Language Page
// ═══════════════════════════════════════════════════
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LanguagePage(onBack: () -> Unit) {
    var selectedLang by remember { mutableStateOf("English") }
    val languages = listOf("English" to "Default", "Hindi" to "\u0939\u093F\u0902\u0926\u0940", "Punjabi" to "\u0A2A\u0A70\u0A1C\u0A3E\u0A2C\u0A40")

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Language", fontWeight = FontWeight.Bold) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
            Text("Select app language", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(12.dp))
            Card(shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column {
                    languages.forEachIndexed { index, (lang, native) ->
                        if (index > 0) HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth().clickable { selectedLang = lang }.padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(lang, fontSize = 15.sp, fontWeight = if (selectedLang == lang) FontWeight.SemiBold else FontWeight.Normal)
                                Text(native, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            RadioButton(selected = selectedLang == lang, onClick = { selectedLang = lang }, colors = RadioButtonDefaults.colors(selectedColor = VMColors.Accent))
                        }
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
            Text("Multi-language support coming soon", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
        }
    }
}

// ═══════════════════════════════════════════════════
// MARK: - Terms of Service Page
// ═══════════════════════════════════════════════════
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TermsOfServicePage(onBack: () -> Unit) {
    val context = LocalContext.current
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Terms of Service", fontWeight = FontWeight.Bold) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        LazyColumn(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            item {
                Text("Terms of Service", fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(4.dp))
                Text("Last updated: February 2026", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            item { TermsSection("1. Acceptance of Terms", "By downloading and using the Akshaya app, you agree to be bound by these Terms of Service. If you do not agree, please do not use the app.") }
            item { TermsSection("2. Services", "Akshaya provides market data, mutual fund information, news aggregation, and portfolio tracking tools. We are an AMFI Registered Mutual Fund Distributor (ARN-317605). All mutual fund investments are subject to market risks.") }
            item { TermsSection("3. Disclaimer", "The information provided in this app is for educational and informational purposes only. It should not be construed as investment advice. Please read all scheme related documents carefully before investing.") }
            item { TermsSection("4. Data Accuracy", "While we strive to provide accurate and timely information, we do not guarantee the accuracy, completeness, or timeliness of any data displayed in the app. Market data may be delayed.") }
            item { TermsSection("5. Privacy", "Your use of the app is also governed by our Privacy Policy. We collect minimal data necessary for app functionality.") }
            item { TermsSection("6. Intellectual Property", "All content, design, and code in the Akshaya app are owned by Akshaya — Eternal Wealth & Legacy. Unauthorized reproduction is prohibited.") }
            item {
                Spacer(Modifier.height(8.dp))
                OutlinedButton(
                    onClick = { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://www.vmfinancialservices.com/disclosures"))) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Text("View Full Disclosures on Website", color = VMColors.Accent)
                }
            }
        }
    }
}

@Composable
private fun TermsSection(title: String, body: String) {
    Column {
        Text(title, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(4.dp))
        Text(body, fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, lineHeight = 20.sp)
    }
}

// ═══════════════════════════════════════════════════
// MARK: - Privacy Policy Page
// ═══════════════════════════════════════════════════
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PrivacyPolicyPage(onBack: () -> Unit) {
    val context = LocalContext.current
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Privacy Policy", fontWeight = FontWeight.Bold) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        LazyColumn(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            item {
                Text("Privacy Policy", fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(4.dp))
                Text("Last updated: February 2026", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            item { TermsSection("Data We Collect", "We collect minimal data to provide our services:\n\n\u2022 Location (optional) \u2014 For local weather and fuel prices\n\u2022 Device token \u2014 For push notifications\n\u2022 Usage analytics \u2014 Anonymous app usage patterns\n\nWe do NOT collect your financial data, passwords, or personal identification without explicit consent.") }
            item { TermsSection("How We Use Your Data", "Your data is used solely to:\n\n\u2022 Show weather for your location\n\u2022 Display fuel prices for your state\n\u2022 Send relevant push notifications\n\u2022 Improve app performance") }
            item { TermsSection("Data Storage", "All data is processed on secure servers. We do not sell, share, or rent your personal information to third parties.") }
            item { TermsSection("Third-Party Services", "We use Firebase (Google) for push notifications and analytics. Their privacy policy applies to data they process.") }
            item { TermsSection("Your Rights", "You can:\n\n\u2022 Disable location access in device settings\n\u2022 Disable notifications in device settings\n\u2022 Request data deletion by contacting us") }
            item { TermsSection("Contact", "For privacy concerns, contact us at:\nEmail: info@vmfinancialservices.com\nPhone: +91-172-4012345") }
            item {
                Spacer(Modifier.height(8.dp))
                OutlinedButton(
                    onClick = { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://www.vmfinancialservices.com/disclosures"))) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Text("View Full Privacy Policy on Website", color = VMColors.Accent)
                }
            }
        }
    }
}

// ═══════════════════════════════════════════════════
// MARK: - About Us Page
// ═══════════════════════════════════════════════════
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AboutUsPage(onBack: () -> Unit) {
    val context = LocalContext.current
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("About Us", fontWeight = FontWeight.Bold) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(bottom = 32.dp)
        ) {
            // Mission
            item {
                Text("Our Mission", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = VMColors.Accent)
                Spacer(Modifier.height(8.dp))
                Text(
                    "To democratize access to quality investment products and guidance, empowering everyday Indians to build wealth through transparency, education, and disciplined investing.",
                    fontSize = 14.sp, lineHeight = 22.sp, color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Team
            item {
                Text("Our Team", fontSize = 18.sp, fontWeight = FontWeight.Bold)
            }

            // Vijay Malik
            item {
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier.size(56.dp).clip(CircleShape).background(VMColors.Accent.copy(alpha = 0.1f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("VM", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = VMColors.Accent)
                            }
                            Spacer(Modifier.width(14.dp))
                            Column {
                                Text("Vijay Malik", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                                Text("Founder & Chief Investment Officer", fontSize = 13.sp, color = VMColors.Accent, fontWeight = FontWeight.Medium)
                            }
                        }
                        Spacer(Modifier.height(12.dp))
                        Text(
                            "With over 30 years in the Banking Industry, Vijay leads our investment research and client advisory services with a focus on long-term wealth creation. He established the firm in Chandigarh with a vision to provide personalized mutual fund advice for families and young professionals.",
                            fontSize = 14.sp, lineHeight = 20.sp, color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            // Ojasvi Malik
            item {
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier.size(56.dp).clip(CircleShape).background(Color(0xFFF59E0B).copy(alpha = 0.1f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("OM", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF59E0B))
                            }
                            Spacer(Modifier.width(14.dp))
                            Column {
                                Text("Ojasvi Malik", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                                Text("AMFI Registered MF Distributor", fontSize = 13.sp, color = VMColors.Accent, fontWeight = FontWeight.Medium)
                            }
                        }
                        Spacer(Modifier.height(12.dp))
                        Text(
                            "Ojasvi ensures our clients receive personalized attention and clear communication about their investments, with expertise in goal-based financial planning. He holds a valid NISM Series V-A certification as required by SEBI and manages the firm's digital platform and technology.",
                            fontSize = 14.sp, lineHeight = 20.sp, color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            // Registration & Compliance
            item {
                Text("Registration & Compliance", fontSize = 18.sp, fontWeight = FontWeight.Bold)
            }
            item {
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        ComplianceRow("AMFI Registration", "ARN-317605")
                        HorizontalDivider()
                        ComplianceRow("EUIN", "E601818")
                        HorizontalDivider()
                        ComplianceRow("NISM Certification", "Series V-A (Ojasvi Malik)")
                        HorizontalDivider()
                        ComplianceRow("KYC Registration", "CVL KRA")
                        HorizontalDivider()
                        ComplianceRow("Entity Type", "Sole Proprietorship")
                        HorizontalDivider()
                        ComplianceRow("Location", "Chandigarh, India")
                    }
                }
            }

            // Our Values
            item {
                Text("Our Values", fontSize = 18.sp, fontWeight = FontWeight.Bold)
            }
            item {
                Card(shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        ValueItem("\uD83D\uDD0D", "Transparency", "Complete clarity in fees, processes, and recommendations")
                        ValueItem("\uD83D\uDCDA", "Education", "Empowering investors with knowledge to make informed decisions")
                        ValueItem("\uD83E\uDD1D", "Client Focus", "Your financial goals are our priority, not product pushing")
                        ValueItem("\uD83C\uDF31", "Long-term Perspective", "Building sustainable wealth through disciplined investing")
                    }
                }
            }

            // Disclaimer
            item {
                Text(
                    "Mutual fund investments are subject to market risks. Read all scheme related documents carefully before investing.",
                    fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center, lineHeight = 16.sp,
                    modifier = Modifier.fillMaxWidth()
                )
            }

            // Website button
            item {
                OutlinedButton(
                    onClick = { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://www.vmfinancialservices.com/about"))) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Text("Visit Our Website", color = VMColors.Accent)
                }
            }
        }
    }
}

@Composable
private fun ComplianceRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun ValueItem(emoji: String, title: String, desc: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(emoji, fontSize = 20.sp)
        Column {
            Text(title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            Text(desc, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, lineHeight = 16.sp)
        }
    }
}
