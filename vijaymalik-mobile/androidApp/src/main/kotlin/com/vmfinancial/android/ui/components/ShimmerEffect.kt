package com.vmfinancial.android.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Animated shimmer brush — synchronized across all skeleton widgets.
 * Psychology: skeleton screens make users focus on content's progress,
 * not on the wait (unlike spinners).
 */
@Composable
fun shimmerBrush(): Brush {
    val shimmerColors = listOf(
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)
    )

    val transition = rememberInfiniteTransition(label = "shimmer")
    val translateAnim = transition.animateFloat(
        initialValue = 0f,
        targetValue = 1200f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1200, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmerTranslate"
    )

    return Brush.linearGradient(
        colors = shimmerColors,
        start = Offset(translateAnim.value - 400f, 0f),
        end = Offset(translateAnim.value, 0f)
    )
}

@Composable
fun ShimmerBox(
    modifier: Modifier = Modifier,
    width: Dp = 80.dp,
    height: Dp = 14.dp,
    cornerRadius: Dp = 6.dp
) {
    val brush = shimmerBrush()
    Box(
        modifier = modifier
            .width(width)
            .height(height)
            .clip(RoundedCornerShape(cornerRadius))
            .background(brush)
    )
}

// ═══════════════════════════════════════════════════
// Skeleton: Gift Nifty Card
// ═══════════════════════════════════════════════════
@Composable
fun ShimmerGiftNiftyCard() {
    val brush = shimmerBrush()
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Box(Modifier.width(80.dp).height(14.dp).clip(RoundedCornerShape(4.dp)).background(brush))
                Spacer(Modifier.height(6.dp))
                Box(Modifier.width(120.dp).height(10.dp).clip(RoundedCornerShape(4.dp)).background(brush))
            }
            Column(horizontalAlignment = Alignment.End) {
                Box(Modifier.width(70.dp).height(18.dp).clip(RoundedCornerShape(4.dp)).background(brush))
                Spacer(Modifier.height(4.dp))
                Box(Modifier.width(90.dp).height(12.dp).clip(RoundedCornerShape(4.dp)).background(brush))
            }
        }
    }
}

// ═══════════════════════════════════════════════════
// Skeleton: Market Indices Row (4 cards)
// ═══════════════════════════════════════════════════
@Composable
fun ShimmerMarketIndicesRow() {
    val brush = shimmerBrush()
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        repeat(3) {
            Card(
                modifier = Modifier.width(155.dp),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Box(Modifier.width(60.dp).height(13.dp).clip(RoundedCornerShape(4.dp)).background(brush))
                    Spacer(Modifier.height(8.dp))
                    Box(Modifier.width(90.dp).height(18.dp).clip(RoundedCornerShape(4.dp)).background(brush))
                    Spacer(Modifier.height(6.dp))
                    Box(Modifier.width(70.dp).height(12.dp).clip(RoundedCornerShape(4.dp)).background(brush))
                }
            }
        }
    }
}

// ═══════════════════════════════════════════════════
// Skeleton: Headlines Card (4 items)
// ═══════════════════════════════════════════════════
@Composable
fun ShimmerHeadlinesCard() {
    val brush = shimmerBrush()
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            repeat(4) { index ->
                Column {
                    Box(Modifier.fillMaxWidth(0.9f).height(14.dp).clip(RoundedCornerShape(4.dp)).background(brush))
                    Spacer(Modifier.height(6.dp))
                    Box(Modifier.fillMaxWidth(0.6f).height(11.dp).clip(RoundedCornerShape(4.dp)).background(brush))
                    Spacer(Modifier.height(4.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Box(Modifier.width(50.dp).height(10.dp).clip(RoundedCornerShape(4.dp)).background(brush))
                        Box(Modifier.width(40.dp).height(10.dp).clip(RoundedCornerShape(4.dp)).background(brush))
                    }
                }
                if (index < 3) Spacer(Modifier.height(14.dp))
            }
        }
    }
}

// ═══════════════════════════════════════════════════
// Skeleton: Fuel Price Grid (2x2)
// ═══════════════════════════════════════════════════
@Composable
fun ShimmerFuelGrid() {
    val brush = shimmerBrush()
    Column(
        modifier = Modifier.padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Box(Modifier.width(140.dp).height(12.dp).clip(RoundedCornerShape(4.dp)).background(brush))
        Spacer(Modifier.height(2.dp))
        repeat(2) {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                repeat(2) {
                    Card(
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Box(Modifier.width(50.dp).height(13.dp).clip(RoundedCornerShape(4.dp)).background(brush))
                            Spacer(Modifier.height(10.dp))
                            Box(Modifier.width(80.dp).height(22.dp).clip(RoundedCornerShape(4.dp)).background(brush))
                            Spacer(Modifier.height(6.dp))
                            Box(Modifier.width(60.dp).height(11.dp).clip(RoundedCornerShape(4.dp)).background(brush))
                        }
                    }
                }
            }
        }
    }
}

// ═══════════════════════════════════════════════════
// Skeleton: Horizontal LazyRow placeholder (Events, Currency, Commodities)
// ═══════════════════════════════════════════════════
@Composable
fun ShimmerHorizontalRow(cardWidth: Dp = 155.dp, cardHeight: Dp = 90.dp) {
    val brush = shimmerBrush()
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        repeat(3) {
            Card(
                modifier = Modifier.width(cardWidth).height(cardHeight),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Box(Modifier.width(60.dp).height(12.dp).clip(RoundedCornerShape(4.dp)).background(brush))
                    Spacer(Modifier.height(8.dp))
                    Box(Modifier.width(80.dp).height(16.dp).clip(RoundedCornerShape(4.dp)).background(brush))
                    Spacer(Modifier.height(6.dp))
                    Box(Modifier.width(50.dp).height(11.dp).clip(RoundedCornerShape(4.dp)).background(brush))
                }
            }
        }
    }
}

// ═══════════════════════════════════════════════════
// Skeleton: Top Funds List
// ═══════════════════════════════════════════════════
@Composable
fun ShimmerTopFundsList() {
    val brush = shimmerBrush()
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            repeat(4) { index ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(Modifier.width(20.dp).height(14.dp).clip(RoundedCornerShape(4.dp)).background(brush))
                    Spacer(Modifier.width(8.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Box(Modifier.fillMaxWidth(0.7f).height(13.dp).clip(RoundedCornerShape(4.dp)).background(brush))
                        Spacer(Modifier.height(4.dp))
                        Box(Modifier.width(60.dp).height(11.dp).clip(RoundedCornerShape(4.dp)).background(brush))
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Box(Modifier.width(50.dp).height(13.dp).clip(RoundedCornerShape(4.dp)).background(brush))
                        Spacer(Modifier.height(4.dp))
                        Box(Modifier.width(40.dp).height(11.dp).clip(RoundedCornerShape(4.dp)).background(brush))
                    }
                }
                if (index < 3) {
                    Box(Modifier.fillMaxWidth().height(0.5.dp).padding(start = 28.dp).background(
                        MaterialTheme.colorScheme.outline.copy(alpha = 0.1f)
                    ))
                }
            }
        }
    }
}
