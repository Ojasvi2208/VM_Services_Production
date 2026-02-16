package com.vmfinancial.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ShowChart
import androidx.compose.material.icons.automirrored.outlined.Chat
import androidx.compose.material.icons.automirrored.outlined.HelpOutline
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vmfinancial.android.services.AuthUser
import com.vmfinancial.android.ui.theme.VMColors

@Composable
fun SideDrawerContent(
    selectedTab: Int,
    onTabSelect: (Int) -> Unit,
    onClose: () -> Unit,
    onNavigate: (String) -> Unit = {},
    currentUser: AuthUser? = null,
    onSignIn: () -> Unit = {},
    onSignOut: () -> Unit = {}
) {
    val initials = currentUser?.fullName?.split(" ")?.take(2)
        ?.mapNotNull { it.firstOrNull()?.uppercase() }?.joinToString("") ?: ""

    Column(
        modifier = Modifier
            .fillMaxHeight()
            .width(300.dp)
            .background(MaterialTheme.colorScheme.background)
    ) {
        // Header
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(VMColors.Primary)
                .padding(20.dp)
                .padding(top = 28.dp)
        ) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                IconButton(onClick = onClose) {
                    Icon(Icons.Default.Close, contentDescription = "Close", tint = Color.White.copy(alpha = 0.6f))
                }
            }

            if (currentUser != null) {
                // Logged-in header with initials
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier.size(52.dp).clip(CircleShape)
                            .background(VMColors.Accent.copy(alpha = 0.2f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(initials, fontSize = 22.sp, fontWeight = FontWeight.Bold, color = VMColors.Accent)
                    }
                    Spacer(Modifier.width(14.dp))
                    Column {
                        Text(currentUser.fullName, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Color.White)
                        Text(currentUser.email, fontSize = 12.sp, color = Color.White.copy(alpha = 0.7f))
                        Text("Premium Member", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = VMColors.Accent)
                    }
                }
            } else {
                // Guest header
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("Akshaya", fontSize = 32.sp, fontWeight = FontWeight.Bold, color = VMColors.Accent)
                    Text("Eternal Wealth & Legacy", fontSize = 14.sp, color = Color.White.copy(alpha = 0.7f))
                }
            }

            Spacer(Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon(Icons.Default.Verified, contentDescription = null, tint = VMColors.Accent, modifier = Modifier.size(14.dp))
                    Text("ARN-317605", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = Color.White.copy(alpha = 0.7f))
                }
                Spacer(Modifier.weight(1f))
                Text("AMFI Registered", fontSize = 12.sp, color = VMColors.Accent.copy(alpha = 0.9f))
            }
        }

        // Menu items
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(vertical = 8.dp)
        ) {
            // Quick Access
            MenuSectionHeader("QUICK ACCESS")
            DrawerMenuItem(Icons.Filled.Home, "Home", selected = selectedTab == 0) { onTabSelect(0); onClose() }
            DrawerMenuItem(Icons.Filled.PieChart, "Portfolio", selected = selectedTab == 2) { onTabSelect(2); onClose() }
            DrawerMenuItem(Icons.Filled.AccountBalance, "Funds", selected = selectedTab == 1) { onTabSelect(1); onClose() }
            DrawerMenuItem(Icons.AutoMirrored.Filled.ShowChart, "Markets", selected = selectedTab == 3) { onTabSelect(3); onClose() }

            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp))

            // Tools
            MenuSectionHeader("TOOLS")
            DrawerMenuItem(Icons.Outlined.Flag, "Goal Planning") { onClose(); onNavigate("goals") }
            DrawerMenuItem(Icons.Outlined.Calculate, "Calculators") { onClose(); onNavigate("calculators") }
            DrawerMenuItem(Icons.Outlined.School, "Learn") { onClose(); onNavigate("learn") }
            DrawerMenuItem(Icons.Outlined.Notifications, "Notifications") { onTabSelect(4); onClose() }

            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp))

            // Premium features (unlocked for logged-in users)
            if (currentUser != null) {
                MenuSectionHeader("PREMIUM")
                DrawerMenuItem(Icons.Outlined.DocumentScanner, "Import CAS Statement") { onClose(); onNavigate("cas_import") }
                DrawerMenuItem(Icons.Outlined.BarChart, "Advanced Analytics") { onClose(); onNavigate("analytics") }
            } else {
                MenuSectionHeader("PREMIUM")
                DrawerMenuItem(Icons.Filled.Star, "Upgrade to Premium", iconTint = Color(0xFFF59E0B)) { onClose(); onNavigate("premium") }
                DrawerMenuItem(Icons.Outlined.DocumentScanner, "Import CAS Statement", locked = true) { onClose(); onNavigate("premium") }
                DrawerMenuItem(Icons.Outlined.BarChart, "Advanced Analytics", locked = true) { onClose(); onNavigate("premium") }
            }

            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp))

            // Support
            MenuSectionHeader("SUPPORT")
            DrawerMenuItem(Icons.AutoMirrored.Outlined.HelpOutline, "Help & FAQ") { onClose() }
            DrawerMenuItem(Icons.AutoMirrored.Outlined.Chat, "Contact Us") { onClose() }
            DrawerMenuItem(Icons.Outlined.Info, "About") { onClose() }

            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp))

            // Account
            if (currentUser != null) {
                DrawerMenuItem(Icons.Outlined.ExitToApp, "Sign Out", iconTint = Color(0xFFEF4444)) { onSignOut(); onClose() }
            } else {
                DrawerMenuItem(Icons.Outlined.Person, "Sign In / Sign Up", iconTint = VMColors.Accent) { onSignIn(); onClose() }
            }

            Spacer(Modifier.height(16.dp))

            Text(
                "v1.0.0",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                modifier = Modifier.padding(horizontal = 20.dp)
            )
        }
    }
}

@Composable
private fun MenuSectionHeader(title: String) {
    Text(
        title,
        fontSize = 11.sp,
        fontWeight = FontWeight.ExtraBold,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        letterSpacing = 1.sp,
        modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)
    )
}

@Composable
private fun DrawerMenuItem(
    icon: ImageVector,
    title: String,
    selected: Boolean = false,
    locked: Boolean = false,
    iconTint: Color? = null,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .then(
                if (selected) Modifier
                    .padding(horizontal = 12.dp, vertical = 2.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(VMColors.Accent.copy(alpha = 0.1f))
                    .padding(horizontal = 8.dp, vertical = 10.dp)
                else Modifier.padding(horizontal = 20.dp, vertical = 12.dp)
            ),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            icon,
            contentDescription = null,
            tint = iconTint ?: if (selected) VMColors.Accent else MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(20.dp)
        )
        Spacer(Modifier.width(14.dp))
        Text(
            title,
            fontSize = 15.sp,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
            color = if (selected) VMColors.Accent else MaterialTheme.colorScheme.onSurface
        )
        if (locked) {
            Spacer(Modifier.weight(1f))
            Text("🔒", fontSize = 12.sp)
        }
    }
}
