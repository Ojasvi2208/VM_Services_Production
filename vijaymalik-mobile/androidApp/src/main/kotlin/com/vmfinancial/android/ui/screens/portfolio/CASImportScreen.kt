package com.vmfinancial.android.ui.screens.portfolio

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vmfinancial.android.MainActivity
import com.vmfinancial.android.ui.theme.VMColors
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.client.request.forms.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

// ── Backend response: { success, data: { investorName, pan, folios[], summary }, error } ──
@Serializable
data class CASApiResponse(
    val success: Boolean = false,
    val data: CASParsedData? = null,
    val error: String? = null,
    val requiresPassword: Boolean = false,
    val message: String? = null
)

@Serializable
data class CASParsedData(
    val investorName: String? = null,
    val email: String? = null,
    val pan: String? = null,
    val folios: List<CASFolio> = emptyList(),
    val summary: CASSummary? = null
)

@Serializable
data class CASFolio(
    val folioNumber: String = "",
    val amc: String = "",
    val schemeName: String = "",
    val schemeCode: String? = null,
    val pan: String? = null,
    val registrar: String? = null,
    val closingBalance: Double = 0.0,
    val closingNav: Double? = null,
    val closingValue: Double? = null,
    val costValue: Double? = null,
    val transactions: List<CASTransaction> = emptyList(),
    // Enriched returns from NAV DB
    val latestNav: Double? = null,
    val currentValue: Double? = null,
    val absoluteReturn: Double? = null,
    val absoluteReturnPct: Double? = null,
    val xirr: Double? = null,
    val cagr: Double? = null
)

@Serializable
data class CASTransaction(
    val date: String = "",
    val description: String = "",
    val amount: Double = 0.0,
    val units: Double = 0.0,
    val nav: Double = 0.0,
    val balance: Double = 0.0,
    val type: String = "BUY"
)

@Serializable
data class CASSummary(
    val totalFolios: Int = 0,
    val totalSchemes: Int = 0,
    val totalInvested: Double = 0.0,
    val currentValue: Double = 0.0
)

@Serializable
data class CASSaveResponse(
    val success: Boolean = false,
    val message: String? = null,
    val imported: Int = 0,
    val skipped: Int = 0,
    val error: String? = null
)

@Serializable
data class CASSavePayload(
    val folios: List<CASFolio>,
    val investorInfo: CASInvestorInfo? = null
)
@Serializable
data class CASInvestorInfo(val pan: String? = null, val email: String? = null)

enum class CASImportStep { SELECT_FILE, PARSING, REVIEW, SAVING, DONE, ERROR }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CASImportScreen(onBack: () -> Unit, onNavigateToFund: ((String, String) -> Unit)? = null) {
    val context = LocalContext.current
    val authService = (context as? MainActivity)?.authService
    val token = authService?.authToken
    val scope = rememberCoroutineScope()

    var step by remember { mutableStateOf(CASImportStep.SELECT_FILE) }
    var selectedUri by remember { mutableStateOf<Uri?>(null) }
    var selectedFileName by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var parsedData by remember { mutableStateOf<CASParsedData?>(null) }
    var saveResult by remember { mutableStateOf<CASSaveResponse?>(null) }
    var errorMessage by remember { mutableStateOf("") }

    val baseUrl = "https://www.vmfinancialservices.com/api"
    val json = Json { ignoreUnknownKeys = true; isLenient = true; coerceInputValues = true }

    val pdfPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let {
            selectedUri = it
            selectedFileName = it.lastPathSegment?.substringAfterLast('/') ?: "CAS Statement.pdf"
        }
    }

    fun uploadAndParse() {
        if (selectedUri == null || token == null) return
        step = CASImportStep.PARSING
        scope.launch {
            try {
                val inputStream = context.contentResolver.openInputStream(selectedUri!!)
                val bytes = inputStream?.readBytes() ?: throw Exception("Could not read file")
                inputStream.close()

                val client = HttpClient {
                    install(ContentNegotiation) { json(json) }
                }

                val response: String = client.post("$baseUrl/portfolio/import-cas") {
                    header("Authorization", "Bearer $token")
                    setBody(MultiPartFormDataContent(
                        formData {
                            append("casFile", bytes, Headers.build {
                                append(HttpHeaders.ContentType, "application/pdf")
                                append(HttpHeaders.ContentDisposition, "filename=\"$selectedFileName\"")
                            })
                            if (password.isNotBlank()) {
                                append("password", password)
                            }
                        }
                    ))
                }.body()

                client.close()

                val apiResp = json.decodeFromString<CASApiResponse>(response)
                if (apiResp.success && apiResp.data != null) {
                    parsedData = apiResp.data
                    step = CASImportStep.REVIEW
                } else if (apiResp.requiresPassword || apiResp.error?.contains("password", ignoreCase = true) == true) {
                    errorMessage = "This PDF is password protected. Enter your PAN (e.g. ABCDE1234F) as the password."
                    step = CASImportStep.SELECT_FILE
                } else {
                    errorMessage = apiResp.error ?: "Failed to parse CAS statement"
                    step = CASImportStep.ERROR
                }
            } catch (e: Exception) {
                errorMessage = e.message ?: "Upload failed"
                step = CASImportStep.ERROR
            }
        }
    }

    fun saveHoldings() {
        if (parsedData == null || token == null) return
        step = CASImportStep.SAVING
        scope.launch {
            try {
                val client = HttpClient {
                    install(ContentNegotiation) { json(json) }
                }

                val payload = CASSavePayload(
                    folios = parsedData!!.folios,
                    investorInfo = CASInvestorInfo(pan = parsedData!!.pan, email = parsedData!!.email)
                )

                val response: String = client.put("$baseUrl/portfolio/import-cas") {
                    header("Authorization", "Bearer $token")
                    header("Content-Type", "application/json")
                    setBody(json.encodeToString(CASSavePayload.serializer(), payload))
                }.body()

                client.close()

                val result = json.decodeFromString<CASSaveResponse>(response)
                saveResult = result
                step = if (result.success) CASImportStep.DONE else CASImportStep.ERROR
                if (!result.success) errorMessage = result.error ?: "Save failed"
            } catch (e: Exception) {
                errorMessage = e.message ?: "Save failed"
                step = CASImportStep.ERROR
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Import CAS Statement", fontWeight = FontWeight.Bold) },
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
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(bottom = 32.dp)
        ) {
            when (step) {
                CASImportStep.SELECT_FILE -> {
                    item {
                        // Info card
                        Card(
                            shape = RoundedCornerShape(14.dp),
                            colors = CardDefaults.cardColors(containerColor = VMColors.Accent.copy(alpha = 0.1f))
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text("What is CAS?", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                Spacer(Modifier.height(8.dp))
                                Text(
                                    "Consolidated Account Statement (CAS) is a single document showing all your mutual fund holdings across all AMCs. Download it from CAMS, KFintech, or NSDL.",
                                    fontSize = 13.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    lineHeight = 20.sp
                                )
                            }
                        }
                    }

                    item {
                        // File picker area
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(160.dp)
                                .clip(RoundedCornerShape(14.dp))
                                .border(
                                    width = 2.dp,
                                    color = if (selectedUri != null) VMColors.Accent else MaterialTheme.colorScheme.outline.copy(alpha = 0.3f),
                                    shape = RoundedCornerShape(14.dp)
                                )
                                .background(MaterialTheme.colorScheme.surface)
                                .clickable { pdfPicker.launch("application/pdf") },
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(
                                    if (selectedUri != null) Icons.Filled.Description else Icons.Filled.CloudUpload,
                                    contentDescription = null,
                                    modifier = Modifier.size(48.dp),
                                    tint = VMColors.Accent
                                )
                                Spacer(Modifier.height(12.dp))
                                if (selectedUri != null) {
                                    Text(selectedFileName, fontWeight = FontWeight.Medium, fontSize = 14.sp)
                                    Text("Tap to change", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                } else {
                                    Text("Tap to select CAS PDF", fontWeight = FontWeight.Medium, fontSize = 14.sp)
                                    Text("Supports CAMS, KFintech & NSDL", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                        }
                    }

                    // Always show password field — NSDL CAS is always password-protected
                    item {
                        OutlinedTextField(
                            value = password,
                            onValueChange = { password = it },
                            label = { Text("PDF Password (if required)") },
                            placeholder = { Text("Your PAN e.g. ABCDE1234F") },
                            leadingIcon = { Icon(Icons.Filled.Lock, contentDescription = null) },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            singleLine = true
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            "NSDL CAS statements are password-protected with your PAN number.",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        if (errorMessage.isNotBlank() && step == CASImportStep.SELECT_FILE) {
                            Spacer(Modifier.height(8.dp))
                            Text(
                                errorMessage,
                                fontSize = 12.sp,
                                color = Color(0xFFEF4444),
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }

                    item {
                        Button(
                            onClick = { errorMessage = ""; uploadAndParse() },
                            enabled = selectedUri != null,
                            modifier = Modifier.fillMaxWidth().height(50.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = VMColors.Accent),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text("Upload & Parse", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }

                CASImportStep.PARSING -> {
                    item {
                        Box(
                            modifier = Modifier.fillMaxWidth().height(300.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                CircularProgressIndicator(color = VMColors.Accent)
                                Spacer(Modifier.height(16.dp))
                                Text("Parsing your CAS statement…", fontWeight = FontWeight.Medium)
                                Text("This may take a moment", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }

                CASImportStep.REVIEW -> {
                    val data = parsedData!!
                    val matched = data.folios.count { it.schemeCode != null }
                    val unmatched = data.folios.size - matched

                    // Investor info
                    item {
                        Card(
                            shape = RoundedCornerShape(14.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text("Investor Details", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                Spacer(Modifier.height(8.dp))
                                data.investorName?.let { ReviewRow("Name", it) }
                                data.pan?.let { ReviewRow("PAN", "${it.take(2)}****${it.takeLast(2)}") }
                                data.summary?.let { s ->
                                    ReviewRow("Folios", "${s.totalFolios}")
                                    ReviewRow("Schemes", "${s.totalSchemes}")
                                    if (s.currentValue > 0) ReviewRow("Total Value", "₹${String.format("%,.0f", s.currentValue)}")
                                    if (s.totalInvested > 0) ReviewRow("Total Invested", "₹${String.format("%,.0f", s.totalInvested)}")
                                }
                                ReviewRow("Matched to DB", "$matched of ${data.folios.size}")
                                if (unmatched > 0) {
                                    Text(
                                        "$unmatched holdings could not be linked to our fund database",
                                        fontSize = 11.sp, color = Color(0xFFF59E0B)
                                    )
                                }
                            }
                        }
                    }

                    // Holdings list — flat folios, each is one scheme
                    items(data.folios) { folio ->
                        val isLinked = folio.schemeCode != null
                        Card(
                            shape = RoundedCornerShape(14.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                            modifier = if (isLinked && onNavigateToFund != null) {
                                Modifier.clickable {
                                    onNavigateToFund(folio.schemeCode!!, folio.schemeName)
                                }
                            } else Modifier
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        if (folio.amc.isNotBlank()) {
                                            Text(folio.amc, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = VMColors.Accent)
                                        }
                                        Text(
                                            folio.schemeName,
                                            fontSize = 13.sp, fontWeight = FontWeight.Medium,
                                            lineHeight = 18.sp, maxLines = 2
                                        )
                                    }
                                    if (isLinked) {
                                        Icon(
                                            Icons.Filled.CheckCircle,
                                            contentDescription = "Linked",
                                            tint = VMColors.MarketUp,
                                            modifier = Modifier.size(18.dp)
                                        )
                                    }
                                }
                                Spacer(Modifier.height(6.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                                    Text("Folio: ${folio.folioNumber}", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    if (folio.closingBalance > 0) {
                                        Text("Units: ${String.format("%.3f", folio.closingBalance)}", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                }
                                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                                    val displayValue = folio.currentValue ?: folio.closingValue
                                    displayValue?.let {
                                        Text("₹${String.format("%,.0f", it)}", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                    }
                                    if (folio.absoluteReturn != null) {
                                        val isPos = folio.absoluteReturn >= 0
                                        Text(
                                            String.format("%+,.0f", folio.absoluteReturn),
                                            fontSize = 12.sp,
                                            color = if (isPos) VMColors.MarketUp else VMColors.MarketDown
                                        )
                                    } else if (folio.costValue != null && folio.closingValue != null) {
                                        val gain = folio.closingValue - folio.costValue
                                        Text(
                                            String.format("%+,.0f", gain),
                                            fontSize = 12.sp,
                                            color = if (gain >= 0) VMColors.MarketUp else VMColors.MarketDown
                                        )
                                    }
                                }
                                // XIRR / CAGR row
                                val hasReturns = folio.xirr != null || folio.cagr != null || folio.absoluteReturnPct != null
                                if (hasReturns) {
                                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                        folio.xirr?.let {
                                            val c = if (it >= 0) VMColors.MarketUp else VMColors.MarketDown
                                            Text("XIRR: ${String.format("%+.1f", it)}%", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = c)
                                        }
                                        folio.cagr?.let {
                                            val c = if (it >= 0) VMColors.MarketUp else VMColors.MarketDown
                                            Text("CAGR: ${String.format("%+.1f", it)}%", fontSize = 11.sp, color = c)
                                        }
                                        if (folio.xirr == null && folio.cagr == null) {
                                            folio.absoluteReturnPct?.let {
                                                val c = if (it >= 0) VMColors.MarketUp else VMColors.MarketDown
                                                Text("Return: ${String.format("%+.1f", it)}%", fontSize = 11.sp, color = c)
                                            }
                                        }
                                    }
                                }
                                if (!isLinked) {
                                    Text("Not linked to fund database", fontSize = 10.sp, color = Color(0xFFF59E0B))
                                }
                            }
                        }
                    }

                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            OutlinedButton(
                                onClick = {
                                    step = CASImportStep.SELECT_FILE
                                    parsedData = null
                                },
                                modifier = Modifier.weight(1f).height(50.dp),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Text("Cancel")
                            }
                            Button(
                                onClick = { saveHoldings() },
                                modifier = Modifier.weight(1f).height(50.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = VMColors.Accent),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Text("Import All", fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                }

                CASImportStep.SAVING -> {
                    item {
                        Box(
                            modifier = Modifier.fillMaxWidth().height(300.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                CircularProgressIndicator(color = VMColors.Accent)
                                Spacer(Modifier.height(16.dp))
                                Text("Importing your holdings…", fontWeight = FontWeight.Medium)
                            }
                        }
                    }
                }

                CASImportStep.DONE -> {
                    item {
                        Box(
                            modifier = Modifier.fillMaxWidth().height(350.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(
                                    Icons.Filled.CheckCircle,
                                    contentDescription = null,
                                    modifier = Modifier.size(72.dp),
                                    tint = VMColors.MarketUp
                                )
                                Spacer(Modifier.height(16.dp))
                                Text("Import Successful!", fontSize = 20.sp, fontWeight = FontWeight.Bold)
                                Spacer(Modifier.height(8.dp))
                                saveResult?.let {
                                    Text(
                                        "${it.imported} holdings imported",
                                        fontSize = 14.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                                Spacer(Modifier.height(24.dp))
                                Button(
                                    onClick = onBack,
                                    colors = ButtonDefaults.buttonColors(containerColor = VMColors.Accent),
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    Text("Go to Portfolio")
                                }
                            }
                        }
                    }
                }

                CASImportStep.ERROR -> {
                    item {
                        Box(
                            modifier = Modifier.fillMaxWidth().height(300.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("❌", fontSize = 48.sp)
                                Spacer(Modifier.height(16.dp))
                                Text("Import Failed", fontSize = 20.sp, fontWeight = FontWeight.Bold)
                                Spacer(Modifier.height(8.dp))
                                Text(
                                    errorMessage,
                                    fontSize = 13.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Spacer(Modifier.height(24.dp))
                                Button(
                                    onClick = { step = CASImportStep.SELECT_FILE },
                                    colors = ButtonDefaults.buttonColors(containerColor = VMColors.Accent),
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    Text("Try Again")
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ReviewRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.weight(1f))
        Text(value, fontSize = 13.sp, fontWeight = FontWeight.Medium)
    }
}
