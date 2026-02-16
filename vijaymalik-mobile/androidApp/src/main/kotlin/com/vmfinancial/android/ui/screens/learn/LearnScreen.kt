package com.vmfinancial.android.ui.screens.learn

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vmfinancial.android.ui.theme.VMColors

// ── Data Model ──

data class LearnArticle(
    val id: String,
    val title: String,
    val summary: String,
    val category: LearnCategory,
    val readTime: Int, // minutes
    val content: String,
    val difficulty: String = "Beginner"
)

enum class LearnCategory(val label: String, val icon: ImageVector, val color: Color) {
    MF_BASICS("MF Basics", Icons.Outlined.School, Color(0xFF14B8A6)),
    CHART_READING("Chart Reading", Icons.Outlined.BarChart, Color(0xFFF59E0B)),
    PMS_AIF_SIF("PMS / AIF / SIF", Icons.Outlined.Diamond, Color(0xFF8B5CF6)),
    TAX_PLANNING("Tax Planning", Icons.Outlined.Receipt, Color(0xFF22C55E)),
    DISTRIBUTOR("Distributor Prep", Icons.Outlined.WorkOutline, Color(0xFFEF4444))
}

// ── Article Content ──

private val allArticles = listOf(
    // MF Basics
    LearnArticle("mf1", "What is a Mutual Fund?",
        "Understand the basics of mutual funds — how they pool money from investors and are managed by professionals.",
        LearnCategory.MF_BASICS, 3,
        """A mutual fund is a professionally managed investment vehicle that pools money from many investors to buy a diversified portfolio of stocks, bonds, or other securities.

**How it works:**
• You invest money → Fund manager buys securities → Returns are shared proportionally

**Key advantages:**
• **Diversification** — Your ₹500 SIP buys pieces of 50-100 companies
• **Professional management** — Expert fund managers make buy/sell decisions
• **Liquidity** — You can redeem (sell) most funds within 1-3 business days
• **Low entry** — Start with as little as ₹100/month via SIP
• **Regulated** — SEBI oversees all mutual funds in India

**Types by structure:**
• **Open-ended** — Buy/sell anytime (most common)
• **Close-ended** — Fixed maturity, listed on exchange
• **Interval** — Open for redemption at specific intervals

**NAV (Net Asset Value):**
NAV = (Total Assets - Liabilities) / Number of Units
This is the "price" of one unit of the fund, updated daily after market close."""),

    LearnArticle("mf2", "SIP vs Lumpsum — Which is Better?",
        "Compare systematic investment plans with one-time investments. Learn when each approach works best.",
        LearnCategory.MF_BASICS, 4,
        """**SIP (Systematic Investment Plan):**
Invest a fixed amount (e.g., ₹5,000) every month automatically.

**Lumpsum:**
Invest a large amount at once (e.g., ₹5,00,000).

**SIP Advantages:**
• **Rupee cost averaging** — Buy more units when market is down, fewer when up
• **Discipline** — Automates investing, removes emotion
• **No timing needed** — Works across market cycles
• **Flexibility** — Start with ₹100, increase anytime

**Lumpsum Advantages:**
• **Higher returns in rising markets** — Full amount compounds from day one
• **Simpler** — One-time decision

**When to use SIP:**
• Regular salary income
• Don't want to time the market
• Building wealth over 5+ years

**When to use Lumpsum:**
• Received bonus, inheritance, or windfall
• Market has fallen significantly (buying opportunity)
• Short-term debt fund investments

**The verdict:** For most people, SIP is the better approach. It removes the "when to invest" anxiety and builds wealth consistently."""),

    LearnArticle("mf3", "Types of Mutual Funds Explained",
        "Equity, debt, hybrid, index — understand every category and which suits your goals.",
        LearnCategory.MF_BASICS, 5,
        """**1. Equity Funds (High Risk, High Return)**
Invest primarily in stocks. Best for 5+ year goals.

• **Large Cap** — Top 100 companies (HDFC, Reliance, TCS). Stable.
• **Mid Cap** — Companies ranked 101-250. Higher growth potential.
• **Small Cap** — Companies ranked 251+. Highest risk & reward.
• **Flexi Cap** — Manager picks across all sizes.
• **Sectoral/Thematic** — Focus on one sector (IT, Pharma, Banking).

**2. Debt Funds (Low Risk, Stable Return)**
Invest in bonds, government securities, money market. Best for 1-3 year goals.

• **Liquid Fund** — Ultra-short term, park emergency fund here.
• **Short Duration** — 1-3 year bonds. Better than FD usually.
• **Gilt Fund** — Government bonds only. Zero credit risk.
• **Corporate Bond** — High-quality company bonds.

**3. Hybrid Funds (Balanced)**
Mix of equity + debt. Best for moderate risk appetite.

• **Aggressive Hybrid** — 65-80% equity + rest debt
• **Conservative Hybrid** — 75-90% debt + rest equity
• **Balanced Advantage** — Dynamically shifts between equity & debt

**4. Index Funds & ETFs (Passive)**
Track an index (Nifty 50, Sensex). Lowest expense ratio.

• **Nifty 50 Index Fund** — Mirrors the Nifty 50
• **S&P 500 Index Fund** — US market exposure
• Best for: "I don't want to pick funds, just give me market returns"

**5. ELSS (Tax Saving)**
Equity fund with 3-year lock-in. ₹1.5L deduction under Section 80C."""),

    LearnArticle("mf4", "Understanding NAV, Expense Ratio & Exit Load",
        "Decode the key metrics that affect your mutual fund returns.",
        LearnCategory.MF_BASICS, 3,
        """**NAV (Net Asset Value):**
The price of one unit of a mutual fund. Calculated daily after market close.

NAV = (Total Assets - Expenses - Liabilities) / Total Units Outstanding

💡 A high NAV doesn't mean "expensive" — a ₹500 NAV fund isn't worse than a ₹50 NAV fund. What matters is the % return.

**Expense Ratio:**
The annual fee charged by the fund house (deducted from NAV daily).

• **Direct Plan** — Lower expense (0.5-1.0%). Buy directly from AMC.
• **Regular Plan** — Higher expense (1.0-2.5%). Includes distributor commission.

Example: If a fund earns 15% and expense ratio is 1%, your net return = 14%.
Over 20 years, even 0.5% extra expense can cost you lakhs.

✅ Always prefer Direct plans for lower costs.

**Exit Load:**
Fee charged if you sell before a specified period.

• Most equity funds: 1% if redeemed within 1 year
• Liquid funds: Graded exit load for 7 days
• Index funds: Usually 0% exit load

**Direct vs Regular:**
| Feature | Direct | Regular |
|---------|--------|---------|
| Expense Ratio | Lower | Higher |
| Returns | Higher | Lower |
| Advisor | None | Distributor helps |
| Best for | DIY investors | Need guidance |"""),

    LearnArticle("mf5", "Direct vs Regular Plans — Save Lakhs",
        "Why choosing Direct plans over Regular can save you significant money over time.",
        LearnCategory.MF_BASICS, 3,
        """**The Difference:**
Every mutual fund has two versions:
• **Direct Plan** — You buy directly from the AMC (fund house)
• **Regular Plan** — You buy through a distributor/advisor who earns a commission

The commission (0.5-1.5% annually) is deducted from your returns via a higher expense ratio.

**Real Impact Example:**
Invest ₹10,000/month for 20 years at 12% return:
• Direct (expense 0.5%): ₹99.9 lakhs
• Regular (expense 1.5%): ₹86.4 lakhs
• **Difference: ₹13.5 lakhs!**

That's money lost to commissions over time.

**When Regular makes sense:**
• You genuinely need hand-holding and advice
• You value a distributor's portfolio review service
• You're a complete beginner who won't invest otherwise

**When Direct is better:**
• You can research and select funds yourself
• You use apps like this one to track & analyze
• You want maximum returns

**How to switch:**
You can switch from Regular to Direct without selling. Just submit a switch request through the AMC's website or app. No tax implications — it's treated as a switch within the same fund."""),

    // Chart Reading
    LearnArticle("chart1", "Candlestick Charts — Reading the Basics",
        "Learn to read candlestick patterns that professional traders use every day.",
        LearnCategory.CHART_READING, 4,
        """**What is a candlestick?**
Each candle shows 4 prices for a time period (day/hour/minute):
• **Open** — Price at start
• **Close** — Price at end
• **High** — Highest price
• **Low** — Lowest price

**Green/White candle:** Close > Open (bullish — price went up)
**Red/Black candle:** Close < Open (bearish — price went down)

**The body** = difference between open and close
**The wicks/shadows** = high and low extremes

**Key Single-Candle Patterns:**

🔨 **Hammer** — Small body at top, long lower wick. Appears after downtrend. Bullish reversal signal.

⭐ **Doji** — Open ≈ Close (cross-shaped). Market indecision. Potential reversal.

📍 **Marubozu** — Full body, no wicks. Strong conviction in the direction.

**Key Multi-Candle Patterns:**

🔄 **Engulfing** — Second candle completely "engulfs" the first. Bullish engulfing after downtrend = buy signal.

⭐ **Morning Star** — 3 candles: big red → small body (star) → big green. Strong bullish reversal.

⭐ **Evening Star** — Opposite of morning star. Bearish reversal.

**Remember:** No single pattern is 100% reliable. Always confirm with volume and other indicators."""),

    LearnArticle("chart2", "Moving Averages — The Trend is Your Friend",
        "Understand SMA, EMA, and how moving averages signal buy/sell decisions.",
        LearnCategory.CHART_READING, 4,
        """**What are Moving Averages?**
A moving average smooths out price data to show the trend direction.

**SMA (Simple Moving Average):**
Average of last N closing prices.
50-day SMA = sum of last 50 closes ÷ 50

**EMA (Exponential Moving Average):**
Gives more weight to recent prices. Reacts faster to changes.

**Common Moving Averages:**
• **20-day** — Short-term trend
• **50-day** — Medium-term trend (most watched)
• **200-day** — Long-term trend (institutional benchmark)

**Key Signals:**

📈 **Golden Cross** — 50-day crosses ABOVE 200-day → Bullish signal
📉 **Death Cross** — 50-day crosses BELOW 200-day → Bearish signal

**How to use:**
1. Price above 200 DMA = long-term uptrend (safe to buy)
2. Price below 200 DMA = long-term downtrend (be cautious)
3. 50 DMA above 200 DMA = bull market confirmation

**Support & Resistance:**
Moving averages act as dynamic support (floor) and resistance (ceiling) levels. Price often bounces off the 50 or 200 DMA.

**In this app:** Check the Index Detail screen — we show 50 and 200 DMA overlays on every chart!"""),

    LearnArticle("chart3", "RSI & MACD — Momentum Indicators",
        "Two essential indicators that help you identify overbought and oversold conditions.",
        LearnCategory.CHART_READING, 4,
        """**RSI (Relative Strength Index):**
Measures speed and magnitude of price changes. Range: 0-100.

• **RSI > 70** → Overbought (may fall soon)
• **RSI < 30** → Oversold (may rise soon)
• **RSI 40-60** → Neutral zone

**How to use RSI:**
1. Buy when RSI drops below 30 and turns up
2. Sell when RSI goes above 70 and turns down
3. RSI divergence: Price makes new high but RSI doesn't → weakness

**MACD (Moving Average Convergence Divergence):**
Shows relationship between two EMAs (usually 12 and 26 period).

• **MACD Line** = 12 EMA - 26 EMA
• **Signal Line** = 9 EMA of MACD Line
• **Histogram** = MACD - Signal

**MACD Signals:**
📈 **Bullish crossover** — MACD crosses above Signal → Buy
📉 **Bearish crossover** — MACD crosses below Signal → Sell
📊 **Histogram growing** — Momentum increasing
📊 **Histogram shrinking** — Momentum fading

**Combining RSI + MACD:**
The strongest signals come when both agree:
• RSI oversold + MACD bullish crossover = Strong buy
• RSI overbought + MACD bearish crossover = Strong sell

**In this app:** Check any index → Index Detail → both RSI and MACD are calculated for you!"""),

    // PMS / AIF / SIF
    LearnArticle("pms1", "PMS vs AIF vs SIF — What's the Difference?",
        "Compare Portfolio Management Services, Alternative Investment Funds, and Specialized Investment Funds.",
        LearnCategory.PMS_AIF_SIF, 5,
        """**PMS (Portfolio Management Service):**
• Min investment: ₹50 lakhs
• Direct stock ownership (shares in YOUR demat)
• Customized portfolio (unlike MF which is pooled)
• Manager actively picks 15-25 stocks
• Fees: 1-2% fixed + 10-20% profit share above hurdle
• Regulated by SEBI
• Best for: HNIs who want concentrated, active equity

**AIF (Alternative Investment Fund):**
• Min investment: ₹1 crore
• 3 categories:
  - **Cat I** — Venture capital, angel funds, infrastructure
  - **Cat II** — Private equity, debt funds, real estate
  - **Cat III** — Hedge funds, long-short strategies
• Pooled vehicle (like MF but for sophisticated investors)
• Lock-in: Usually 3-5 years
• Best for: Ultra-HNIs wanting non-traditional assets

**SIF (Specialized Investment Fund) — NEW!**
• SEBI's latest category (2024-25)
• Min investment: ₹10 lakhs
• Sits between MF and PMS
• Can take concentrated bets (fewer stocks)
• Lower expense than PMS, more flexible than MF
• Can do long-short, derivatives within limits
• Best for: Investors between ₹10L-50L who want active management

**Quick Comparison:**
| Feature | Mutual Fund | SIF | PMS | AIF |
|---------|------------|-----|-----|-----|
| Min Investment | ₹100 | ₹10L | ₹50L | ₹1Cr |
| Ownership | Units | Units | Direct | Units |
| Customization | None | Low | High | Medium |
| Lock-in | 0-3y | Varies | None | 3-5y |
| Best for | Everyone | Affluent | HNI | Ultra-HNI |"""),

    // Tax Planning
    LearnArticle("tax1", "Mutual Fund Taxation — Complete Guide",
        "LTCG, STCG, indexation — everything you need to know about MF taxes in India.",
        LearnCategory.TAX_PLANNING, 5,
        """**Equity Funds (>65% in stocks):**

• **Short-term (< 1 year):** 20% tax on gains
• **Long-term (≥ 1 year):** 12.5% tax on gains above ₹1.25 lakh/year
• Holding period for LTCG: 1 year

**Debt Funds:**

• **All gains taxed as per your income tax slab** (no special rate)
• No indexation benefit (removed in 2023 Budget)
• Tax applied when you sell/redeem

**Hybrid Funds:**
• Equity-oriented (≥65% equity): Treated as equity fund
• Debt-oriented (<65% equity): Treated as debt fund

**ELSS (Tax Saving):**
• Invest up to ₹1.5 lakh → Deduction under Section 80C
• 3-year lock-in (shortest among 80C options)
• Returns taxed as equity fund

**SIP Taxation:**
Each SIP installment has its own holding period!
• ₹5,000 SIP started Jan 2024 → Jan 2024 installment becomes LTCG in Jan 2025
• Feb 2024 installment becomes LTCG in Feb 2025
• And so on...

**Tax-Saving Tips:**
1. ₹1.25 lakh LTCG is tax-free every year — book profits strategically
2. Harvest losses to offset gains (tax-loss harvesting)
3. Switch within the same fund house (still counts as sale for tax)
4. Use ELSS for 80C instead of PPF for potentially higher returns"""),

    // Distributor Prep
    LearnArticle("dist1", "AMFI ARN Registration — Complete Guide",
        "Step-by-step guide to becoming a registered mutual fund distributor in India.",
        LearnCategory.DISTRIBUTOR, 5,
        """**What is ARN?**
AMFI Registration Number — required to distribute mutual funds in India.

**Step 1: Pass NISM Series V-A Exam**
• Exam: NISM Series V-A: Mutual Fund Distributors
• Fee: ₹1,500
• Duration: 2 hours, 100 questions
• Passing: 50% (50 marks out of 100)
• Validity: 3 years (then CPE required)
• Mode: Online at NISM test centers

**Study Material:**
• NISM official workbook (free PDF on nism.ac.in)
• Focus areas: MF basics, regulations, taxation, investor services

**Step 2: Register with AMFI**
• Visit amfiindia.com
• Submit NISM certificate
• KYC documents (Aadhaar, PAN, photo)
• Fee: ₹3,000 (individual) for 3 years

**Step 3: Empanelment with AMCs**
• Register with each AMC (fund house) individually
• Most have online empanelment
• Start with top 10: HDFC, ICICI, SBI, Nippon, Kotak, Axis, DSP, UTI, Tata, Aditya Birla

**Earning Potential:**
• Trail commission: 0.3% - 1.5% annually on AUM
• ₹1 Cr AUM × 1% trail = ₹1 lakh/year recurring
• Build to ₹10 Cr AUM = ₹10 lakh/year passive income

**Tips for success:**
• Focus on SIPs (recurring income)
• Educate clients, don't just sell
• Use technology (apps like this one) for client servicing
• Build trust through transparency""")
)

// ── Screen ──

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LearnScreen(
    onBack: (() -> Unit)? = null,
    onArticleClick: (String) -> Unit = {}
) {
    var selectedCategory by remember { mutableStateOf<LearnCategory?>(null) }
    var searchQuery by remember { mutableStateOf("") }

    val filteredArticles = remember(selectedCategory, searchQuery) {
        allArticles.filter { article ->
            (selectedCategory == null || article.category == selectedCategory) &&
            (searchQuery.isBlank() || article.title.contains(searchQuery, ignoreCase = true) ||
                article.summary.contains(searchQuery, ignoreCase = true))
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Learn", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    if (onBack != null) {
                        IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Search
            item {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("Search articles...", fontSize = 14.sp) },
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp)
                )
            }

            // Category Chips
            item {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    item {
                        FilterChip(
                            selected = selectedCategory == null,
                            onClick = { selectedCategory = null },
                            label = { Text("All", fontSize = 13.sp) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = VMColors.Accent.copy(alpha = 0.15f),
                                selectedLabelColor = VMColors.Accent
                            )
                        )
                    }
                    items(LearnCategory.entries.toList()) { cat ->
                        FilterChip(
                            selected = selectedCategory == cat,
                            onClick = { selectedCategory = if (selectedCategory == cat) null else cat },
                            label = { Text(cat.label, fontSize = 13.sp) },
                            leadingIcon = { Icon(cat.icon, null, modifier = Modifier.size(16.dp)) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = cat.color.copy(alpha = 0.15f),
                                selectedLabelColor = cat.color
                            )
                        )
                    }
                }
            }

            // Articles
            items(filteredArticles) { article ->
                ArticleCard(article = article, onClick = { onArticleClick(article.id) })
            }

            if (filteredArticles.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier.fillMaxWidth().padding(48.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("No articles found", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
}

@Composable
private fun ArticleCard(article: LearnArticle, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).clickable { onClick() },
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier.size(36.dp).clip(RoundedCornerShape(10.dp))
                        .background(article.category.color.copy(alpha = 0.1f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(article.category.icon, null, tint = article.category.color, modifier = Modifier.size(20.dp))
                }
                Spacer(Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(article.title, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
            }
            Spacer(Modifier.height(8.dp))
            Text(article.summary, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2, overflow = TextOverflow.Ellipsis, lineHeight = 18.sp)
            Spacer(Modifier.height(10.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(article.category.label, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = article.category.color)
                Spacer(Modifier.width(12.dp))
                Text("${article.readTime} min read", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.width(12.dp))
                Text(article.difficulty, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

// ── Article Detail Screen ──

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LearnArticleScreen(articleId: String, onBack: () -> Unit) {
    val article = allArticles.find { it.id == articleId }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(article?.category?.label ?: "Article", fontWeight = FontWeight.Bold) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        if (article == null) {
            Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Text("Article not found")
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp),
                contentPadding = PaddingValues(bottom = 48.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                item {
                    Spacer(Modifier.height(8.dp))
                    Text(article.title, fontSize = 24.sp, fontWeight = FontWeight.Bold, lineHeight = 30.sp)
                }
                item {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(article.category.label, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = article.category.color)
                        Spacer(Modifier.width(12.dp))
                        Text("${article.readTime} min read", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Spacer(Modifier.width(12.dp))
                        Text(article.difficulty, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                item { HorizontalDivider() }

                // Render content as paragraphs
                val paragraphs = article.content.trim().split("\n\n")
                items(paragraphs) { paragraph ->
                    val trimmed = paragraph.trim()
                    if (trimmed.startsWith("**") && trimmed.endsWith("**") && !trimmed.contains("\n")) {
                        // Section header
                        Text(
                            trimmed.removeSurrounding("**"),
                            fontSize = 18.sp, fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(top = 8.dp)
                        )
                    } else {
                        Text(trimmed, fontSize = 15.sp, lineHeight = 24.sp, color = MaterialTheme.colorScheme.onSurface)
                    }
                }
            }
        }
    }
}
