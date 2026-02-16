package com.vmfinancial.android.ui.screens.markets

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vmfinancial.android.ui.theme.VMColors
import com.vmfinancial.shared.data.api.BackendApi
import com.vmfinancial.shared.data.models.CandleData
import com.vmfinancial.shared.data.models.ChartDataResponse
import com.vmfinancial.shared.data.models.DMAOverlayPoint
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun IndexDetailScreen(
    symbol: String,
    name: String,
    onBack: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val api = remember { BackendApi() }

    var chartData by remember { mutableStateOf<ChartDataResponse?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var selectedRange by remember { mutableStateOf("1Y") }
    val ranges = listOf("1D", "1W", "1M", "3M", "6M", "1Y")

    fun loadChart(range: String) {
        scope.launch {
            isLoading = true
            try {
                chartData = api.getChartData(symbol, range)
            } catch (e: Exception) {
                println("Chart error: ${e.message}")
            }
            isLoading = false
        }
    }

    LaunchedEffect(Unit) { loadChart(selectedRange) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(name, fontWeight = FontWeight.Bold, fontSize = 16.sp) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).background(MaterialTheme.colorScheme.background),
            contentPadding = PaddingValues(bottom = 32.dp)
        ) {
            // Price header
            item { PriceHeader(chartData, symbol) }

            // Chart
            item {
                if (isLoading) {
                    Box(
                        Modifier.fillMaxWidth().height(260.dp).padding(16.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(MaterialTheme.colorScheme.surface),
                        contentAlignment = Alignment.Center
                    ) { CircularProgressIndicator(color = VMColors.Accent) }
                } else if (chartData != null && chartData!!.candles.isNotEmpty()) {
                    CandlestickChart(
                        candles = chartData!!.candles,
                        dmaOverlay = chartData!!.technicals.dmaOverlay,
                        modifier = Modifier.fillMaxWidth().height(260.dp).padding(horizontal = 16.dp, vertical = 8.dp)
                    )
                }
            }

            // Range selector
            item { RangeSelector(ranges, selectedRange) { range -> selectedRange = range; loadChart(range) } }

            // 52-week range
            chartData?.let { data ->
                if (data.fiftyTwoWeekHigh > 0 && data.fiftyTwoWeekLow > 0) {
                    item { FiftyTwoWeekRange(data) }
                }

                // Key technicals
                if (data.technicals.dma.dma50 != null || data.technicals.rsi != null) {
                    item { TechnicalsCard(data) }
                }

                // Outlook
                if (data.signals.isNotEmpty()) {
                    item { OutlookCard(data) }
                    item { SignalsSection(data) }
                }
            }
        }
    }
}

@Composable
private fun PriceHeader(data: ChartDataResponse?, symbol: String) {
    val price = data?.currentPrice ?: 0.0
    val change = data?.dayChange ?: 0.0
    val changePct = data?.dayChangePercent ?: 0.0
    val isPos = change >= 0

    Column(modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)) {
        Row(verticalAlignment = Alignment.Bottom) {
            Text(
                formatPrice(price),
                fontSize = 34.sp, fontWeight = FontWeight.Bold
            )
            Spacer(Modifier.weight(1f))
            Column(horizontalAlignment = Alignment.End) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(if (isPos) "▲" else "▼", fontSize = 12.sp, color = if (isPos) VMColors.MarketUp else VMColors.MarketDown)
                    Spacer(Modifier.width(4.dp))
                    Text(String.format("%+.2f", change), fontSize = 15.sp, fontWeight = FontWeight.SemiBold,
                        color = if (isPos) VMColors.MarketUp else VMColors.MarketDown)
                }
                Text(String.format("(%+.2f%%)", changePct), fontSize = 13.sp,
                    color = if (isPos) VMColors.MarketUp else VMColors.MarketDown)
            }
        }

        Spacer(Modifier.height(6.dp))

        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(symbol, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = Color.White,
                modifier = Modifier.clip(RoundedCornerShape(3.dp)).background(VMColors.Accent).padding(horizontal = 6.dp, vertical = 2.dp))
            Spacer(Modifier.width(8.dp))
            if (data != null) {
                Box(Modifier.size(6.dp).clip(CircleShape).background(if (data.isMarketOpen) VMColors.MarketUp else MaterialTheme.colorScheme.onSurfaceVariant))
                Spacer(Modifier.width(4.dp))
                Text(if (data.isMarketOpen) "Market Open" else "Market Closed", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Spacer(Modifier.weight(1f))
            data?.previousClose?.let {
                Text("Prev Close: ${formatPrice(it)}", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun CandlestickChart(
    candles: List<CandleData>,
    dmaOverlay: List<DMAOverlayPoint>,
    modifier: Modifier
) {
    val greenColor = VMColors.MarketUp
    val redColor = VMColors.MarketDown
    val dma50Color = Color(0xFFF97316) // orange
    val dma200Color = Color(0xFF8B5CF6) // purple

    Canvas(modifier = modifier.clip(RoundedCornerShape(12.dp)).background(MaterialTheme.colorScheme.surface)) {
        if (candles.isEmpty()) return@Canvas

        val allHighs = candles.map { it.high }
        val allLows = candles.map { it.low }
        val maxPrice = allHighs.max()
        val minPrice = allLows.min()
        val priceRange = maxPrice - minPrice
        if (priceRange <= 0) return@Canvas

        val candleWidth = size.width / candles.size
        val padding = 8f

        fun priceToY(price: Double): Float {
            return (padding + (1 - (price - minPrice) / priceRange) * (size.height - 2 * padding)).toFloat()
        }

        // Draw candles
        candles.forEachIndexed { i, candle ->
            val x = i * candleWidth + candleWidth / 2
            val isGreen = candle.close >= candle.open
            val color = if (isGreen) greenColor else redColor

            // Wick
            drawLine(
                color = color,
                start = Offset(x, priceToY(candle.high)),
                end = Offset(x, priceToY(candle.low)),
                strokeWidth = 1f
            )

            // Body
            val bodyTop = priceToY(maxOf(candle.open, candle.close))
            val bodyBottom = priceToY(minOf(candle.open, candle.close))
            val bodyHeight = maxOf(bodyBottom - bodyTop, 1f)

            drawRect(
                color = color,
                topLeft = Offset(x - candleWidth * 0.35f, bodyTop),
                size = Size(candleWidth * 0.7f, bodyHeight)
            )
        }

        // Draw DMA overlay lines
        if (dmaOverlay.isNotEmpty() && dmaOverlay.size > 1) {
            val timestampToIndex = candles.mapIndexed { i, c -> c.timestamp to i }.toMap()

            // DMA 50
            val dma50Points = dmaOverlay.filter { it.dma50 != null }.mapNotNull { point ->
                val idx = timestampToIndex[point.timestamp] ?: return@mapNotNull null
                Offset(idx * candleWidth + candleWidth / 2, priceToY(point.dma50!!))
            }
            if (dma50Points.size > 1) {
                val path = Path().apply {
                    moveTo(dma50Points.first().x, dma50Points.first().y)
                    dma50Points.drop(1).forEach { lineTo(it.x, it.y) }
                }
                drawPath(path, dma50Color, style = Stroke(width = 1.5f))
            }

            // DMA 200
            val dma200Points = dmaOverlay.filter { it.dma200 != null }.mapNotNull { point ->
                val idx = timestampToIndex[point.timestamp] ?: return@mapNotNull null
                Offset(idx * candleWidth + candleWidth / 2, priceToY(point.dma200!!))
            }
            if (dma200Points.size > 1) {
                val path = Path().apply {
                    moveTo(dma200Points.first().x, dma200Points.first().y)
                    dma200Points.drop(1).forEach { lineTo(it.x, it.y) }
                }
                drawPath(path, dma200Color, style = Stroke(width = 1.5f))
            }
        }
    }
}

@Composable
private fun RangeSelector(ranges: List<String>, selected: String, onSelect: (String) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(MaterialTheme.colorScheme.surface)
            .padding(3.dp)
    ) {
        ranges.forEach { range ->
            val isSelected = range == selected
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(8.dp))
                    .background(if (isSelected) VMColors.Accent else Color.Transparent)
                    .padding(vertical = 8.dp),
                contentAlignment = Alignment.Center
            ) {
                TextButton(onClick = { onSelect(range) }, modifier = Modifier.height(24.dp)) {
                    Text(range, fontSize = 13.sp,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                        color = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

@Composable
private fun FiftyTwoWeekRange(data: ChartDataResponse) {
    val position = ((data.fiftyTwoWeekRangePosition ?: 50.0) / 100.0).coerceIn(0.0, 1.0).toFloat()

    Column(modifier = Modifier.padding(horizontal = 20.dp, vertical = 16.dp)) {
        Text("52-WEEK RANGE", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.onSurfaceVariant, letterSpacing = 1.sp)
        Spacer(Modifier.height(12.dp))

        // Range bar
        Box(modifier = Modifier.fillMaxWidth().height(14.dp)) {
            // Track
            Box(
                Modifier.fillMaxWidth().height(6.dp).align(Alignment.Center)
                    .clip(RoundedCornerShape(3.dp))
                    .background(MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.12f))
            )
            // Filled
            Box(
                Modifier.fillMaxWidth(position).height(6.dp).align(Alignment.CenterStart)
                    .clip(RoundedCornerShape(3.dp))
                    .background(Brush.horizontalGradient(listOf(VMColors.MarketDown.copy(alpha = 0.8f), VMColors.Accent, VMColors.MarketUp.copy(alpha = 0.8f))))
            )
            // Dot
            Box(
                Modifier.offset(x = (position * 300).dp - 7.dp) // approximate
                    .size(14.dp).clip(CircleShape).background(Color.White)
                    .padding(3.dp)
            ) {
                Box(Modifier.fillMaxSize().clip(CircleShape).background(VMColors.Accent))
            }
        }

        Spacer(Modifier.height(8.dp))

        Row {
            Column {
                Text("Low", fontSize = 9.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(formatPrice(data.fiftyTwoWeekLow), fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = VMColors.MarketDown)
            }
            Spacer(Modifier.weight(1f))
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Current", fontSize = 9.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(String.format("%.1f%%", data.fiftyTwoWeekRangePosition ?: 0.0), fontSize = 13.sp, fontWeight = FontWeight.Bold, color = VMColors.Accent)
            }
            Spacer(Modifier.weight(1f))
            Column(horizontalAlignment = Alignment.End) {
                Text("High", fontSize = 9.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(formatPrice(data.fiftyTwoWeekHigh), fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = VMColors.MarketUp)
            }
        }
    }
}

@Composable
private fun TechnicalsCard(data: ChartDataResponse) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("Key Technicals", fontSize = 15.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(12.dp))

            data.technicals.dma.dma50?.let {
                TechnicalRow("50 DMA", formatPrice(it), if (data.currentPrice > it) "Above" else "Below", data.currentPrice > it)
            }
            data.technicals.dma.dma200?.let {
                TechnicalRow("200 DMA", formatPrice(it), if (data.currentPrice > it) "Above" else "Below", data.currentPrice > it)
            }
            data.technicals.rsi?.let {
                val signal = when { it > 70 -> "Overbought"; it < 30 -> "Oversold"; else -> "Neutral" }
                TechnicalRow("RSI (14)", String.format("%.1f", it), signal, it in 30.0..70.0)
            }
            data.technicals.macd.macd?.let { macd ->
                val signal = data.technicals.macd.signal
                val label = if (signal != null && macd > signal) "Bullish" else "Bearish"
                TechnicalRow("MACD", String.format("%.2f", macd), label, signal != null && macd > signal)
            }
        }
    }
}

@Composable
private fun TechnicalRow(label: String, value: String, signal: String, isPositive: Boolean) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.weight(1f))
        Text(value, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.width(8.dp))
        Text(
            signal, fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
            color = if (isPositive) VMColors.MarketUp else VMColors.MarketDown,
            modifier = Modifier
                .clip(RoundedCornerShape(4.dp))
                .background((if (isPositive) VMColors.MarketUp else VMColors.MarketDown).copy(alpha = 0.1f))
                .padding(horizontal = 6.dp, vertical = 2.dp)
        )
    }
}

@Composable
private fun OutlookCard(data: ChartDataResponse) {
    val outlook = data.outlook
    val color = when (outlook.overall.lowercase()) {
        "bullish" -> VMColors.MarketUp
        "bearish" -> VMColors.MarketDown
        else -> VMColors.Accent
    }

    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Overall Outlook", fontSize = 15.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.weight(1f))
                Text(outlook.overall, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = color)
            }

            Spacer(Modifier.height(12.dp))

            // Strength bar
            Box(Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)).background(MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.1f))) {
                Box(
                    Modifier.fillMaxWidth((outlook.strength / 100f).toFloat()).fillMaxHeight()
                        .clip(RoundedCornerShape(4.dp)).background(color)
                )
            }
            Spacer(Modifier.height(4.dp))
            Text("Strength: ${outlook.strength.toInt()}%", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)

            if (outlook.summary.isNotEmpty()) {
                Spacer(Modifier.height(8.dp))
                Text(outlook.summary, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, lineHeight = 16.sp)
            }
        }
    }
}

@Composable
private fun SignalsSection(data: ChartDataResponse) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("Technical Signals", fontSize = 15.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(12.dp))

            data.signals.forEach { signal ->
                val isPositive = signal.signal.lowercase().contains("bullish")
                val isNeutral = signal.signal.lowercase().contains("neutral")
                val color = when { isPositive -> VMColors.MarketUp; isNeutral -> VMColors.Accent; else -> VMColors.MarketDown }

                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(signal.indicator, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                        Text(signal.description, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Text(
                        signal.signal, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = color,
                        modifier = Modifier.clip(RoundedCornerShape(4.dp)).background(color.copy(alpha = 0.1f))
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                    )
                }
                if (signal != data.signals.last()) {
                    HorizontalDivider(modifier = Modifier.padding(vertical = 2.dp))
                }
            }
        }
    }
}

private fun formatPrice(price: Double): String {
    return if (price >= 10000) {
        String.format("%,.0f", price)
    } else if (price >= 100) {
        String.format("%,.2f", price)
    } else {
        String.format("%.2f", price)
    }
}
