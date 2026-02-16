package com.vmfinancial.android.ui.screens.calculators

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vmfinancial.android.ui.theme.VMColors

data class CalculatorItem(
    val id: String,
    val title: String,
    val subtitle: String,
    val icon: ImageVector,
    val route: String
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CalculatorsScreen(
    onBack: (() -> Unit)? = null,
    onNavigate: (String) -> Unit = {}
) {
    val calculators = listOf(
        CalculatorItem("sip", "SIP Calculator", "Plan your monthly investments", Icons.Outlined.TrendingUp, "calc/sip"),
        CalculatorItem("lumpsum", "Lumpsum Calculator", "One-time investment growth", Icons.Outlined.AccountBalance, "calc/lumpsum"),
        CalculatorItem("goal", "Goal Planner", "How much to invest for your goal", Icons.Outlined.Flag, "calc/goal"),
        CalculatorItem("swp", "SWP Calculator", "Plan systematic withdrawals", Icons.Outlined.Payments, "calc/swp"),
        CalculatorItem("stepup", "Step-up SIP", "SIP with annual increase", Icons.Outlined.Stairs, "calc/stepup"),
    )

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Calculators", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    if (onBack != null) {
                        IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 12.dp),
            contentPadding = PaddingValues(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(calculators) { calc ->
                CalculatorCard(calc) { onNavigate(calc.route) }
            }
        }
    }
}

@Composable
private fun CalculatorCard(item: CalculatorItem, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(1f)
            .clickable { onClick() },
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(
            modifier = Modifier.fillMaxSize().padding(16.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(VMColors.Accent.copy(alpha = 0.1f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(item.icon, contentDescription = null, tint = VMColors.Accent, modifier = Modifier.size(24.dp))
            }

            Column {
                Text(item.title, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, lineHeight = 18.sp)
                Spacer(Modifier.height(4.dp))
                Text(
                    item.subtitle,
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    lineHeight = 16.sp,
                    maxLines = 2
                )
            }
        }
    }
}
