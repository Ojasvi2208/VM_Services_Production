package com.vmfinancial.android.services

/**
 * Privacy-first SMS Transaction Parser for Indian bank messages.
 * All parsing happens locally — no SMS content ever leaves the device.
 *
 * Supports: HDFC, ICICI, Axis, SBI, Kotak, PNB, BOI, BOB, Canara, Yes, RBL,
 *           Federal, IDBI, IndusInd, AMEX, HSBC, Citi, PayTM, Jupiter, Jio, Niyo
 */
object SmsTransactionParser {

    // ── Bank sender ID patterns ──
    val BANK_SENDER_PATTERNS = listOf(
        "HDFCBK", "SBIBNK", "SBMSMS", "SBISMS", "ICICIB", "AXISBK", "KOTAKB",
        "PNBSMS", "BOIIND", "CENTBK", "CANBNK", "IABORB", "YESBNK", "RBLBNK",
        "IDBIBNK", "FEDSMS", "SCBSMS", "CITIBK", "AMEXIN", "HSBCIN", "INDBNK",
        "FABORB", "UNIONB", "BOBSMS", "PAYTMB", "JUPITB", "JIOBNK", "NIYOBNK",
        "UCOBNK", "MAHABK", "ABORIG", "KARBSM", "SYNBNK", "IOBALR", "TMBALR",
        // UPI apps
        "JUSPAY", "PHONPE", "GPAY", "BHIMUPI", "PAYTM", "WHATSAP"
    )

    // ── Spending categories ──
    val SPENDING_CATEGORIES = mapOf(
        "coffee" to listOf("starbucks", "ccd", "cafe coffee day", "blue tokai", "third wave", "barista", "chaayos"),
        "alcohol" to listOf("beer", "wine", "bar ", "pub ", "brewery", "liquor", "spirits", "cocktail", "theek hai"),
        "dining" to listOf("swiggy", "zomato", "restaurant", "pizza", "dominos", "mcdonald", "kfc", "burger king", "subway", "biryani", "cafe", "dhaba", "haldiram", "barbeque nation"),
        "shopping" to listOf("amazon", "flipkart", "myntra", "ajio", "nykaa", "meesho", "mall ", "fashion", "reliance retail", "dmart", "big bazaar", "croma", "vijay sales"),
        "entertainment" to listOf("netflix", "spotify", "hotstar", "prime video", "bookmyshow", "pvr", "inox", "cinema", "movie", "disney", "youtube premium", "jiocinema"),
        "ride" to listOf("uber", "ola", "rapido", "cab ", "taxi"),
        "subscription" to listOf("subscription", "recurring", "autopay", "membership", "renewal"),
        "grocery" to listOf("bigbasket", "blinkit", "zepto", "instamart", "jiomart", "grofers", "dunzo", "grocery", "supermarket", "kirana"),
        "fuel" to listOf("petrol", "diesel", "fuel", "iocl", "hpcl", "bpcl", "indian oil", "hp pump", "shell"),
        "medical" to listOf("pharmacy", "medical", "hospital", "clinic", "apollo", "medplus", "1mg", "pharmeasy", "netmeds", "practo"),
        "utility" to listOf("electricity", "water bill", "gas bill", "broadband", "jio fiber", "airtel", "vi ", "bsnl", "municipal"),
        "emi" to listOf("emi ", "loan ", "instalment", "installment"),
        "transfer" to listOf("neft", "rtgs", "imps", "upi", "transfer to", "sent to")
    )

    // Discretionary = categories where money could be invested instead
    val DISCRETIONARY_CATEGORIES = setOf(
        "coffee", "alcohol", "dining", "shopping", "entertainment", "ride", "subscription"
    )

    val CATEGORY_EMOJI = mapOf(
        "coffee" to "☕", "alcohol" to "🍺", "dining" to "🍕",
        "shopping" to "🛒", "entertainment" to "🎬", "ride" to "🚕",
        "subscription" to "📱", "grocery" to "🥬", "fuel" to "⛽",
        "medical" to "💊", "utility" to "💡", "emi" to "🏦",
        "transfer" to "💸", "uncategorized" to "📄"
    )

    data class ParsedTransaction(
        val amount: Double,
        val transactionType: String, // "DEBIT" or "CREDIT"
        val merchant: String,
        val category: String,
        val accountTail: String,
        val isDiscretionary: Boolean
    )

    fun isBankSms(sender: String): Boolean {
        return BANK_SENDER_PATTERNS.any { sender.contains(it, ignoreCase = true) }
    }

    fun parse(smsBody: String): ParsedTransaction? {
        val body = smsBody.trim()
        val lower = body.lowercase()

        // ── Determine transaction type ──
        val isCredit = lower.contains("credited") || lower.contains("received") ||
                lower.contains("refund") || lower.contains("cashback") ||
                lower.contains("reversed")
        val isDebit = lower.contains("debit") || lower.contains("debited") ||
                lower.contains("spent") || lower.contains("paid") ||
                lower.contains("purchase") || lower.contains("withdrawn") ||
                lower.contains("charged") || lower.contains("sent to") ||
                lower.contains("txn of") || lower.contains("transaction of")

        // Must be one or the other
        if (!isCredit && !isDebit) return null
        val type = if (isCredit && !isDebit) "CREDIT" else "DEBIT"

        // ── Extract amount ──
        val amount = extractAmount(body) ?: return null
        if (amount <= 0 || amount > 10_00_000) return null // sanity check

        // ── Extract merchant ──
        val merchant = extractMerchant(body)

        // ── Extract account tail (last 4 digits) ──
        val accountTail = extractAccountTail(body)

        // ── Categorize ──
        val category = categorize(merchant, lower)
        val isDiscretionary = category in DISCRETIONARY_CATEGORIES

        return ParsedTransaction(
            amount = amount,
            transactionType = type,
            merchant = merchant,
            category = category,
            accountTail = accountTail,
            isDiscretionary = isDiscretionary
        )
    }

    private fun extractAmount(body: String): Double? {
        // Order matters — more specific patterns first
        val patterns = listOf(
            // "INR 1,234.56" or "Rs. 1234.00" or "₹350"
            Regex("""(?:INR|Rs\.?|₹)\s*([0-9,]+\.?\d{0,2})""", RegexOption.IGNORE_CASE),
            // "1,234.56 INR" (reversed)
            Regex("""([0-9,]+\.?\d{0,2})\s*(?:INR|Rs\.?)""", RegexOption.IGNORE_CASE),
            // "debited for Rs 1234" or "paid Rs.1234"
            Regex("""(?:debited|spent|paid|charged|of|for)\s+(?:INR|Rs\.?|₹)?\s*([0-9,]+\.?\d{0,2})""", RegexOption.IGNORE_CASE),
            // "Txn of Rs.1234" (SBI style)
            Regex("""(?:txn|transaction)\s+(?:of|for)\s+(?:INR|Rs\.?|₹)?\s*([0-9,]+\.?\d{0,2})""", RegexOption.IGNORE_CASE),
            // "credited with INR 5000"
            Regex("""(?:credited|received|refund)\s+(?:with\s+)?(?:INR|Rs\.?|₹)?\s*([0-9,]+\.?\d{0,2})""", RegexOption.IGNORE_CASE)
        )

        for (pattern in patterns) {
            val match = pattern.find(body) ?: continue
            val amountStr = match.groupValues[1].replace(",", "")
            val amount = amountStr.toDoubleOrNull()
            if (amount != null && amount > 0) return amount
        }
        return null
    }

    private fun extractMerchant(body: String): String {
        val patterns = listOf(
            // "at STARBUCKS on 13-02"
            Regex("""(?:at|to|@)\s+([A-Za-z0-9\s&'.\-/]+?)(?:\s+on\s|\s+dated|\s+ref|\s+Avl|\.\s|$)""", RegexOption.IGNORE_CASE),
            // "Info: SWIGGY" or "Info-AMAZON"
            Regex("""(?:Info[:\-])\s*([A-Za-z0-9\s&'.\-/]+?)(?:\.\s|\s+Avl|$)""", RegexOption.IGNORE_CASE),
            // "VPA merchant@upi" → extract merchant name
            Regex("""VPA\s+([a-zA-Z0-9]+)@""", RegexOption.IGNORE_CASE),
            // "to VPA success@upi" → extract before @
            Regex("""to\s+VPA\s+([a-zA-Z0-9.\-]+)@""", RegexOption.IGNORE_CASE)
        )

        for (pattern in patterns) {
            val match = pattern.find(body) ?: continue
            val raw = match.groupValues[1].trim().take(50)
            if (raw.isNotBlank() && raw.length > 1) return cleanMerchant(raw)
        }
        return "Unknown"
    }

    private fun cleanMerchant(raw: String): String {
        return raw
            .replace(Regex("""\s+"""), " ")
            .replace(Regex("""[*#]+"""), "")
            .trim()
            .split(" ")
            .take(4)
            .joinToString(" ")
            .replaceFirstChar { it.uppercase() }
    }

    private fun extractAccountTail(body: String): String {
        // "A/c XX1234" or "a/c ending 1234" or "A/C *1234" or "acct 1234"
        val patterns = listOf(
            Regex("""(?:A/?c|a/?c|Acct|acct|account)\s*(?:no\.?|number)?\s*(?:XX|xx|\*{1,4})?\s*(\d{4})""", RegexOption.IGNORE_CASE),
            Regex("""(?:ending|ends)\s+(\d{4})""", RegexOption.IGNORE_CASE),
            Regex("""(?:card)\s*(?:XX|xx|\*{1,4})\s*(\d{4})""", RegexOption.IGNORE_CASE)
        )
        for (pattern in patterns) {
            val match = pattern.find(body) ?: continue
            return match.groupValues[1]
        }
        return ""
    }

    private fun categorize(merchant: String, lowerBody: String): String {
        val searchText = "$merchant $lowerBody".lowercase()
        for ((category, keywords) in SPENDING_CATEGORIES) {
            for (keyword in keywords) {
                if (searchText.contains(keyword)) return category
            }
        }
        return "uncategorized"
    }

    // ── SIP growth projection (12% CAGR) ──
    fun projectGrowth(monthlyAmount: Double, years: Int): String {
        val rate = 0.12 / 12
        val months = years * 12
        val fv = monthlyAmount * ((Math.pow(1 + rate, months.toDouble()) - 1) / rate) * (1 + rate)
        return when {
            fv >= 1_00_00_000 -> String.format("₹%.1f Cr", fv / 1_00_00_000)
            fv >= 1_00_000 -> String.format("₹%.1fL", fv / 1_00_000)
            fv >= 1_000 -> String.format("₹%.0fK", fv / 1_000)
            else -> String.format("₹%.0f", fv)
        }
    }
}
