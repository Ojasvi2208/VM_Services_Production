package com.vmfinancial.android.services

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Generates branded shareable image cards for WhatsApp/social sharing.
 * Pure Android Canvas rendering — no external dependencies.
 */
class ShareCardService(private val context: Context) {

    companion object {
        private const val CARD_WIDTH = 1080
        private const val CARD_PADDING = 60
        private const val BRAND_NAME = "Akshaya"
        private const val BRAND_TAGLINE = "Eternal Wealth & Legacy"

        // Colors
        private const val BG_DARK = 0xFF18181B.toInt()
        private const val ACCENT = 0xFF14B8A6.toInt()
        private const val TEXT_WHITE = 0xFFFFFFFF.toInt()
        private const val TEXT_GRAY = 0xFFA1A1AA.toInt()
        private const val MARKET_UP = 0xFF22C55E.toInt()
        private const val MARKET_DOWN = 0xFFEF4444.toInt()
        private const val ORANGE = 0xFFF59E0B.toInt()
        private const val DIVIDER = 0xFF3F3F46.toInt()
    }

    // ── Fuel Tax Breakup Card ──

    data class FuelShareData(
        val fuelType: String,      // "Petrol" / "Diesel"
        val retailPrice: Double,
        val basePrice: Double,
        val exciseDuty: Double,
        val dealerCommission: Double,
        val vatPercent: Double,
        val vatAmount: Double,
        val additionalCess: Double,
        val totalTaxPercent: Double,
        val centralTaxPercent: Double,
        val stateTaxPercent: Double,
        val totalTax: Double,
        val cityName: String,
        val stateName: String
    )

    fun generateFuelCard(data: FuelShareData): Bitmap {
        val cardHeight = 920
        val bmp = Bitmap.createBitmap(CARD_WIDTH, cardHeight, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)

        // Background
        c.drawColor(BG_DARK)

        val p = Paint(Paint.ANTI_ALIAS_FLAG)
        var y = CARD_PADDING.toFloat()

        // Header: fuel icon + title
        p.color = ACCENT
        p.textSize = 48f
        p.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        c.drawText("⛽  ${data.fuelType} Tax Breakup", CARD_PADDING.toFloat(), y + 48f, p)
        y += 80f

        // Location + date
        p.color = TEXT_GRAY
        p.textSize = 32f
        p.typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
        val dateStr = SimpleDateFormat("dd MMM yyyy", Locale.getDefault()).format(Date())
        c.drawText("📍 ${data.cityName}, ${data.stateName}  •  $dateStr", CARD_PADDING.toFloat(), y + 32f, p)
        y += 70f

        // Retail price hero
        p.color = TEXT_WHITE
        p.textSize = 80f
        p.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        c.drawText("₹${String.format("%.2f", data.retailPrice)}/litre", CARD_PADDING.toFloat(), y + 80f, p)
        y += 110f

        // Divider
        p.color = DIVIDER
        c.drawRect(CARD_PADDING.toFloat(), y, (CARD_WIDTH - CARD_PADDING).toFloat(), y + 2f, p)
        y += 30f

        // Breakdown rows
        y = drawBreakdownRow(c, "Base Price", data.basePrice, y)
        y = drawBreakdownRow(c, "Excise Duty (Central)", data.exciseDuty, y)
        y = drawBreakdownRow(c, "Dealer Commission", data.dealerCommission, y)
        y = drawBreakdownRow(c, "VAT (${String.format("%.1f", data.vatPercent)}%)", data.vatAmount, y)
        if (data.additionalCess > 0) {
            y = drawBreakdownRow(c, "Additional Cess", data.additionalCess, y)
        }

        y += 10f
        // Divider
        p.color = DIVIDER
        c.drawRect(CARD_PADDING.toFloat(), y, (CARD_WIDTH - CARD_PADDING).toFloat(), y + 2f, p)
        y += 30f

        // Tax summary
        p.textSize = 30f
        p.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        p.color = MARKET_DOWN
        c.drawText("Central: ${String.format("%.1f", data.centralTaxPercent)}%", CARD_PADDING.toFloat(), y + 30f, p)
        p.color = ORANGE
        val centralWidth = p.measureText("Central: ${String.format("%.1f", data.centralTaxPercent)}%  ")
        c.drawText("State: ${String.format("%.1f", data.stateTaxPercent)}%", CARD_PADDING + centralWidth, y + 30f, p)
        p.color = TEXT_WHITE
        val stateWidth = p.measureText("State: ${String.format("%.1f", data.stateTaxPercent)}%  ")
        c.drawText("Total Tax: ${String.format("%.1f", data.totalTaxPercent)}%", CARD_PADDING + centralWidth + stateWidth, y + 30f, p)
        y += 60f

        // Footer branding
        drawBrandFooter(c, cardHeight.toFloat())

        return bmp
    }

    private fun drawBreakdownRow(c: Canvas, label: String, amount: Double, y: Float): Float {
        val p = Paint(Paint.ANTI_ALIAS_FLAG)
        p.textSize = 32f
        p.typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
        p.color = TEXT_GRAY
        c.drawText(label, CARD_PADDING.toFloat(), y + 32f, p)
        p.color = TEXT_WHITE
        p.textAlign = Paint.Align.RIGHT
        c.drawText("₹${String.format("%.2f", amount)}", (CARD_WIDTH - CARD_PADDING).toFloat(), y + 32f, p)
        p.textAlign = Paint.Align.LEFT
        return y + 50f
    }

    // ── Gift Nifty Card ──

    data class GiftNiftyShareData(
        val price: Double,
        val change: Double,
        val changePercent: Double,
        val previousClose: Double,
        val marketStatus: String
    )

    fun generateGiftNiftyCard(data: GiftNiftyShareData): Bitmap {
        val cardHeight = 580
        val bmp = Bitmap.createBitmap(CARD_WIDTH, cardHeight, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        c.drawColor(BG_DARK)

        val p = Paint(Paint.ANTI_ALIAS_FLAG)
        var y = CARD_PADDING.toFloat()

        // Header
        p.color = ACCENT
        p.textSize = 42f
        p.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        c.drawText("Gift Nifty", CARD_PADDING.toFloat(), y + 42f, p)

        // Market status badge
        val statusColor = when {
            data.marketStatus.contains("Open", true) -> MARKET_UP
            data.marketStatus.contains("Pre", true) -> ORANGE
            else -> TEXT_GRAY
        }
        p.color = statusColor
        p.textSize = 28f
        val statusX = CARD_WIDTH - CARD_PADDING - p.measureText(data.marketStatus)
        c.drawText(data.marketStatus, statusX, y + 42f, p)
        y += 80f

        // Price hero
        p.color = TEXT_WHITE
        p.textSize = 96f
        p.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        c.drawText(String.format("%.2f", data.price), CARD_PADDING.toFloat(), y + 96f, p)
        y += 120f

        // Change
        val isUp = data.change >= 0
        val arrow = if (isUp) "▲" else "▼"
        val changeColor = if (isUp) MARKET_UP else MARKET_DOWN
        p.color = changeColor
        p.textSize = 44f
        c.drawText("$arrow ${String.format("%.2f", kotlin.math.abs(data.change))} (${String.format("%.2f", kotlin.math.abs(data.changePercent))}%)", CARD_PADDING.toFloat(), y + 44f, p)
        y += 80f

        // Previous close
        p.color = TEXT_GRAY
        p.textSize = 30f
        p.typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
        c.drawText("Previous Close: ${String.format("%.2f", data.previousClose)}", CARD_PADDING.toFloat(), y + 30f, p)

        val dateStr = SimpleDateFormat("dd MMM yyyy, h:mm a", Locale.getDefault()).format(Date())
        p.textAlign = Paint.Align.RIGHT
        c.drawText(dateStr, (CARD_WIDTH - CARD_PADDING).toFloat(), y + 30f, p)
        p.textAlign = Paint.Align.LEFT

        // Footer
        drawBrandFooter(c, cardHeight.toFloat())

        return bmp
    }

    // ── Market Summary Card ──

    data class MarketShareItem(val symbol: String, val name: String, val value: Double, val changePercent: Double)

    fun generateMarketSummaryCard(indices: List<MarketShareItem>): Bitmap {
        val rowHeight = 60
        val headerHeight = 160
        val footerHeight = 100
        val cardHeight = headerHeight + (indices.size * rowHeight) + footerHeight + CARD_PADDING
        val bmp = Bitmap.createBitmap(CARD_WIDTH, cardHeight, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        c.drawColor(BG_DARK)

        val p = Paint(Paint.ANTI_ALIAS_FLAG)
        var y = CARD_PADDING.toFloat()

        // Header
        p.color = ACCENT
        p.textSize = 42f
        p.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        c.drawText("Markets Today", CARD_PADDING.toFloat(), y + 42f, p)
        y += 60f

        p.color = TEXT_GRAY
        p.textSize = 28f
        p.typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
        val dateStr = SimpleDateFormat("dd MMM yyyy, h:mm a", Locale.getDefault()).format(Date())
        c.drawText(dateStr, CARD_PADDING.toFloat(), y + 28f, p)
        y += 60f

        // Divider
        p.color = DIVIDER
        c.drawRect(CARD_PADDING.toFloat(), y, (CARD_WIDTH - CARD_PADDING).toFloat(), y + 2f, p)
        y += 20f

        // Index rows
        for (item in indices) {
            p.color = TEXT_WHITE
            p.textSize = 32f
            p.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            c.drawText(item.symbol, CARD_PADDING.toFloat(), y + 34f, p)

            p.textSize = 28f
            p.typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
            val valueStr = String.format("%.2f", item.value)
            val midX = CARD_WIDTH / 2f
            c.drawText(valueStr, midX, y + 34f, p)

            val pctStr = "${if (item.changePercent >= 0) "+" else ""}${String.format("%.2f", item.changePercent)}%"
            p.color = if (item.changePercent >= 0) MARKET_UP else MARKET_DOWN
            p.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            p.textAlign = Paint.Align.RIGHT
            c.drawText(pctStr, (CARD_WIDTH - CARD_PADDING).toFloat(), y + 34f, p)
            p.textAlign = Paint.Align.LEFT

            y += rowHeight
        }

        // Footer
        drawBrandFooter(c, cardHeight.toFloat())

        return bmp
    }

    // ── Brand Footer ──

    private fun drawBrandFooter(c: Canvas, cardHeight: Float) {
        val p = Paint(Paint.ANTI_ALIAS_FLAG)
        val footerY = cardHeight - 80f

        // Divider
        p.color = DIVIDER
        c.drawRect(CARD_PADDING.toFloat(), footerY, (CARD_WIDTH - CARD_PADDING).toFloat(), footerY + 1f, p)

        // Brand name
        p.color = ACCENT
        p.textSize = 28f
        p.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        c.drawText(BRAND_NAME, CARD_PADDING.toFloat(), footerY + 40f, p)

        // URL
        p.color = TEXT_GRAY
        p.textSize = 24f
        p.typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
        p.textAlign = Paint.Align.RIGHT
        c.drawText(BRAND_TAGLINE, (CARD_WIDTH - CARD_PADDING).toFloat(), footerY + 40f, p)
        p.textAlign = Paint.Align.LEFT
    }

    // ── Share via Intent ──

    fun shareBitmap(bitmap: Bitmap, title: String) {
        try {
            val cachePath = File(context.cacheDir, "share_cards")
            cachePath.mkdirs()
            val file = File(cachePath, "vm_${System.currentTimeMillis()}.png")
            FileOutputStream(file).use { out ->
                bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
            }

            val uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                file
            )

            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "image/png"
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_TEXT, "$title\n\nvia Akshaya — Eternal Wealth & Legacy\nhttps://vmfinancialservices.com")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            context.startActivity(Intent.createChooser(intent, "Share via").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (e: Exception) {
            println("ShareCardService: Error sharing: ${e.message}")
        }
    }
}
