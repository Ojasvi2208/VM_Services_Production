package com.vmfinancial.android.ui.screens.goals

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vmfinancial.android.MainActivity
import com.vmfinancial.android.ui.theme.VMColors
import com.vmfinancial.shared.data.api.BackendApi
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

private val indianFormat = NumberFormat.getNumberInstance(Locale("en", "IN"))

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateGoalScreen(onBack: () -> Unit, onCreated: () -> Unit = {}) {
    val context = LocalContext.current
    val authService = (context as? MainActivity)?.authService
    val token = authService?.authToken ?: ""
    val api = remember { BackendApi() }
    val scope = rememberCoroutineScope()

    var name by remember { mutableStateOf("") }
    var targetAmount by remember { mutableStateOf("") }
    var targetDate by remember { mutableStateOf("") }
    var selectedIcon by remember { mutableStateOf("target") }
    var selectedColor by remember { mutableStateOf("#6366F1") }
    var criticality by remember { mutableStateOf("important") }
    var monthlySip by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var isCreating by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf<String?>(null) }
    var showDatePicker by remember { mutableStateOf(false) }

    val icons = listOf(
        "target" to Icons.Outlined.Flag,
        "graduation" to Icons.Outlined.School,
        "house" to Icons.Outlined.Home,
        "plane" to Icons.Outlined.Flight,
        "car" to Icons.Outlined.DirectionsCar,
        "ring" to Icons.Outlined.Favorite,
        "baby" to Icons.Outlined.ChildCare,
        "shield" to Icons.Outlined.Shield,
        "piggy" to Icons.Outlined.Savings,
        "star" to Icons.Outlined.Star
    )

    val colors = listOf("#6366F1", "#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#14B8A6")

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Create Goal", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // ── Goal Name ──
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Goal Name") },
                placeholder = { Text("e.g., Aarya's College Fund") },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = VMColors.Accent)
            )

            // ── Icon Picker ──
            Text("Choose an Icon", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                icons.forEach { (key, icon) ->
                    val isSelected = selectedIcon == key
                    val iconColor = try { Color(android.graphics.Color.parseColor(selectedColor)) } catch (_: Exception) { VMColors.Accent }
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(if (isSelected) iconColor.copy(alpha = 0.15f) else Color.Transparent)
                            .border(if (isSelected) 2.dp else 0.dp, if (isSelected) iconColor else Color.Transparent, CircleShape)
                            .clickable { selectedIcon = key },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(icon, contentDescription = key, tint = if (isSelected) iconColor else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f), modifier = Modifier.size(20.dp))
                    }
                }
            }

            // ── Color Picker ──
            Text("Theme Color", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                colors.forEach { hex ->
                    val c = try { Color(android.graphics.Color.parseColor(hex)) } catch (_: Exception) { VMColors.Accent }
                    val isSelected = selectedColor == hex
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .clip(CircleShape)
                            .background(c)
                            .border(if (isSelected) 3.dp else 0.dp, if (isSelected) MaterialTheme.colorScheme.onSurface else Color.Transparent, CircleShape)
                            .clickable { selectedColor = hex }
                    )
                }
            }

            // ── Target Amount ──
            OutlinedTextField(
                value = targetAmount,
                onValueChange = { targetAmount = it.filter { c -> c.isDigit() || c == '.' } },
                label = { Text("Target Amount (\u20b9)") },
                placeholder = { Text("e.g., 2500000") },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = VMColors.Accent),
                supportingText = {
                    val amt = targetAmount.toDoubleOrNull()
                    if (amt != null && amt > 0) Text("= ${indianFormat.format(amt.toLong())}")
                }
            )

            // ── Target Date ──
            OutlinedTextField(
                value = targetDate,
                onValueChange = {},
                label = { Text("Target Date") },
                placeholder = { Text("YYYY-MM-DD") },
                modifier = Modifier.fillMaxWidth().clickable { showDatePicker = true },
                shape = RoundedCornerShape(12.dp),
                enabled = false,
                colors = OutlinedTextFieldDefaults.colors(
                    disabledTextColor = MaterialTheme.colorScheme.onSurface,
                    disabledBorderColor = MaterialTheme.colorScheme.outline,
                    disabledLabelColor = MaterialTheme.colorScheme.onSurfaceVariant
                )
            )

            // ── Criticality ──
            Text("Criticality", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CriticalityChip("Critical", "critical", Color(0xFFEF4444), criticality) { criticality = it }
                CriticalityChip("Important", "important", VMColors.Accent, criticality) { criticality = it }
                CriticalityChip("Discretionary", "discretionary", VMColors.MarketUp, criticality) { criticality = it }
            }
            Text(
                when (criticality) {
                    "critical" -> "Protected first during market downturns. Target: 95%+ success."
                    "important" -> "Balanced priority. Target: 80%+ success."
                    else -> "Can be paused if critical goals need more. Target: 60%+ success."
                },
                fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            // ── Monthly SIP ──
            OutlinedTextField(
                value = monthlySip,
                onValueChange = { monthlySip = it.filter { c -> c.isDigit() || c == '.' } },
                label = { Text("Monthly SIP (\u20b9)") },
                placeholder = { Text("e.g., 5000") },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = VMColors.Accent),
                supportingText = { Text("AI will recommend optimal SIP after creation") }
            )

            // ── Notes ──
            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                label = { Text("Notes (optional)") },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                minLines = 2,
                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = VMColors.Accent)
            )

            // ── Error ──
            if (errorMsg != null) {
                Text(errorMsg!!, color = Color(0xFFEF4444), fontSize = 13.sp)
            }

            // ── Create Button ──
            Button(
                onClick = {
                    val amt = targetAmount.toDoubleOrNull()
                    if (name.isBlank()) { errorMsg = "Enter a goal name"; return@Button }
                    if (amt == null || amt <= 0) { errorMsg = "Enter a valid target amount"; return@Button }
                    if (targetDate.isBlank()) { errorMsg = "Select a target date"; return@Button }
                    errorMsg = null
                    isCreating = true
                    scope.launch {
                        try {
                            val resp = api.createGoal(
                                token = token, name = name, targetAmount = amt,
                                targetDate = targetDate, criticality = criticality,
                                monthlySip = monthlySip.toDoubleOrNull() ?: 0.0,
                                icon = selectedIcon, color = selectedColor,
                                notes = notes.ifBlank { null }
                            )
                            if (resp.success) {
                                onCreated()
                                onBack()
                            } else {
                                errorMsg = resp.error ?: "Failed to create goal"
                            }
                        } catch (e: Exception) {
                            errorMsg = e.message ?: "Network error"
                        }
                        isCreating = false
                    }
                },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                colors = ButtonDefaults.buttonColors(containerColor = VMColors.Accent),
                shape = RoundedCornerShape(14.dp),
                enabled = !isCreating
            ) {
                if (isCreating) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
                } else {
                    Text("Create Goal with AI Projection", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                }
            }

            Spacer(Modifier.height(32.dp))
        }
    }

    // Date picker dialog
    if (showDatePicker) {
        val datePickerState = rememberDatePickerState(
            initialSelectedDateMillis = System.currentTimeMillis() + 365L * 24 * 60 * 60 * 1000
        )
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    datePickerState.selectedDateMillis?.let { millis ->
                        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
                        targetDate = sdf.format(Date(millis))
                    }
                    showDatePicker = false
                }) { Text("OK") }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) { Text("Cancel") }
            }
        ) {
            DatePicker(state = datePickerState)
        }
    }
}

@Composable
private fun CriticalityChip(label: String, value: String, color: Color, selected: String, onSelect: (String) -> Unit) {
    val isSelected = selected == value
    Surface(
        shape = RoundedCornerShape(10.dp),
        color = if (isSelected) color else Color.Transparent,
        modifier = Modifier.clickable { onSelect(value) },
        border = if (!isSelected) ButtonDefaults.outlinedButtonBorder else null
    ) {
        Text(
            label, fontSize = 13.sp,
            fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
            color = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp)
        )
    }
}
