package com.vmfinancial.android.services

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import androidx.core.app.NotificationCompat
import com.vmfinancial.android.R
import com.vmfinancial.android.data.db.AkshayaDatabase
import com.vmfinancial.android.data.db.TransactionEntity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Listens for incoming SMS messages and detects bank transaction alerts.
 * Privacy-first: All parsing happens locally. Raw SMS never leaves the device.
 *
 * Flow: SMS → Parse → Store in Room DB → Send nudge notification (if discretionary)
 */
class SmsBroadcastReceiver : BroadcastReceiver() {

    companion object {
        private const val NOTIFICATION_ID_BASE = 5000
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val prefs = context.getSharedPreferences("akshaya_prefs", Context.MODE_PRIVATE)
        if (!prefs.getBoolean("spending_nudges_enabled", true)) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
        val db = AkshayaDatabase.getInstance(context)
        val dao = db.transactionDao()
        val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        val today = dateFormat.format(Date())

        for (smsMessage in messages) {
            val sender = smsMessage.originatingAddress ?: continue
            val body = smsMessage.messageBody ?: continue

            if (!SmsTransactionParser.isBankSms(sender)) continue

            val parsed = SmsTransactionParser.parse(body) ?: continue

            // Dedup by SMS body hash
            val hash = body.hashCode()

            scope.launch {
                try {
                    if (dao.countByHash(hash) > 0) {
                        println("SmsBroadcastReceiver: Duplicate SMS skipped (hash=$hash)")
                        return@launch
                    }

                    // Store transaction in Room DB — privacy first, never leaves device
                    val entity = TransactionEntity(
                        amount = parsed.amount,
                        transactionType = parsed.transactionType,
                        merchant = parsed.merchant,
                        category = parsed.category,
                        bankSender = sender,
                        date = today,
                        smsHash = hash,
                        accountTail = parsed.accountTail
                    )
                    dao.insert(entity)
                    println("SmsBroadcastReceiver: Stored ${parsed.transactionType} ₹${parsed.amount} at ${parsed.merchant} [${parsed.category}]")

                    // Send nudge only for discretionary debits
                    if (parsed.transactionType == "DEBIT" && parsed.isDiscretionary) {
                        sendSpendingNudge(context, parsed)
                    }
                } catch (e: Exception) {
                    println("SmsBroadcastReceiver: DB error: ${e.message}")
                }
            }
        }
    }

    private fun sendSpendingNudge(context: Context, txn: SmsTransactionParser.ParsedTransaction) {
        val emoji = SmsTransactionParser.CATEGORY_EMOJI[txn.category] ?: "💡"
        val amountStr = if (txn.amount == txn.amount.toLong().toDouble()) {
            String.format("₹%.0f", txn.amount)
        } else {
            String.format("₹%.2f", txn.amount)
        }

        val merchantDisplay = txn.merchant.split(" ").take(3).joinToString(" ")

        val growth10Y = SmsTransactionParser.projectGrowth(txn.amount, 10)
        val growth5Y = SmsTransactionParser.projectGrowth(txn.amount, 5)

        val title = "$emoji Spent $amountStr at $merchantDisplay"
        val bigText = buildString {
            append("You spent $amountStr at $merchantDisplay.\n\n")
            append("💡 If you invested $amountStr/month via SIP:\n")
            append("  • 5 years → $growth5Y\n")
            append("  • 10 years → $growth10Y\n\n")
            append("Start a small SIP today and grow your Akshaya Legacy! 🌱")
        }

        val notification = NotificationCompat.Builder(context, VMFirebaseMessagingService.CHANNEL_GENERAL)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText("A SIP of $amountStr/month could grow to $growth10Y in 10 years!")
            .setStyle(NotificationCompat.BigTextStyle().bigText(bigText))
            .setAutoCancel(true)
            .setColor(0xFF14B8A6.toInt())
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val notifId = NOTIFICATION_ID_BASE + (System.currentTimeMillis() % 1000).toInt()
        manager.notify(notifId, notification)
    }
}
