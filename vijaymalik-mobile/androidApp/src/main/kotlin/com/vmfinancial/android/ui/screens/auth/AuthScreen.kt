package com.vmfinancial.android.ui.screens.auth

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vmfinancial.android.services.AuthService
import com.vmfinancial.android.ui.theme.VMColors
import kotlinx.coroutines.launch

enum class AuthMode { SIGN_IN, SIGN_UP }
enum class AuthSignInMethod { PASSWORD, OTP }
enum class AuthStep { CREDENTIALS, OTP_VERIFY }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AuthScreen(
    authService: AuthService,
    initialMode: String = "signin",
    onBack: () -> Unit,
    onSuccess: () -> Unit
) {
    var authMode by remember { mutableStateOf(if (initialMode == "signup") AuthMode.SIGN_UP else AuthMode.SIGN_IN) }
    var signInMethod by remember { mutableStateOf(AuthSignInMethod.PASSWORD) }
    var step by remember { mutableStateOf(AuthStep.CREDENTIALS) }

    // Common fields
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }

    // Sign-up fields
    var firstName by remember { mutableStateOf("") }
    var lastName by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var confirmPasswordVisible by remember { mutableStateOf(false) }

    // OTP fields
    var otp by remember { mutableStateOf("") }
    var fullName by remember { mutableStateOf("") }
    var isNewUser by remember { mutableStateOf(false) }

    var isLoading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    val scope = rememberCoroutineScope()
    val otpFocusRequester = remember { FocusRequester() }

    val title = when {
        step == AuthStep.OTP_VERIFY -> "Verify OTP"
        authMode == AuthMode.SIGN_UP -> "Create Account"
        signInMethod == AuthSignInMethod.OTP -> "Sign In with OTP"
        else -> "Sign In"
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = {
                        when {
                            step == AuthStep.OTP_VERIFY -> { step = AuthStep.CREDENTIALS; otp = ""; error = null }
                            else -> onBack()
                        }
                    }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header
            Text(
                if (authMode == AuthMode.SIGN_UP) "Join Akshaya" else "Welcome to Akshaya",
                fontSize = 26.sp, fontWeight = FontWeight.Bold
            )
            Text(
                when {
                    step == AuthStep.OTP_VERIFY -> "We sent a 6-digit OTP to\n$email"
                    authMode == AuthMode.SIGN_UP -> "Create your account to unlock portfolio tracking, CAS import, and more."
                    signInMethod == AuthSignInMethod.PASSWORD -> "Sign in with your email and password."
                    else -> "Enter your email to receive a one-time code."
                },
                fontSize = 15.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, lineHeight = 22.sp
            )

            Spacer(Modifier.height(4.dp))

            // ════════════════════════════════════════════════════════════
            //  CREDENTIALS STEP
            // ════════════════════════════════════════════════════════════
            if (step == AuthStep.CREDENTIALS) {

                // ── Sign-Up: First Name + Last Name ──
                if (authMode == AuthMode.SIGN_UP) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        OutlinedTextField(
                            value = firstName,
                            onValueChange = { firstName = it; error = null },
                            label = { Text("First Name") },
                            placeholder = { Text("Vijay") },
                            modifier = Modifier.weight(1f),
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                            shape = RoundedCornerShape(12.dp)
                        )
                        OutlinedTextField(
                            value = lastName,
                            onValueChange = { lastName = it; error = null },
                            label = { Text("Last Name") },
                            placeholder = { Text("Malik") },
                            modifier = Modifier.weight(1f),
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                            shape = RoundedCornerShape(12.dp)
                        )
                    }
                }

                // Email
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it; error = null },
                    label = { Text("Email Address") },
                    placeholder = { Text("you@example.com") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Email,
                        imeAction = if (authMode == AuthMode.SIGN_UP || signInMethod == AuthSignInMethod.PASSWORD) ImeAction.Next else ImeAction.Done
                    ),
                    shape = RoundedCornerShape(12.dp),
                    isError = error != null
                )

                // Password (for sign-in with password or sign-up)
                if (authMode == AuthMode.SIGN_UP || signInMethod == AuthSignInMethod.PASSWORD) {
                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it; error = null },
                        label = { Text("Password") },
                        placeholder = { if (authMode == AuthMode.SIGN_UP) Text("Min 8 characters") else null },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Password,
                            imeAction = if (authMode == AuthMode.SIGN_UP) ImeAction.Next else ImeAction.Done
                        ),
                        keyboardActions = if (authMode == AuthMode.SIGN_IN) KeyboardActions(onDone = {
                            if (email.contains("@") && password.isNotBlank()) {
                                scope.launch {
                                    isLoading = true; error = null
                                    val result = authService.signInWithPassword(email, password)
                                    result.fold(
                                        onSuccess = { resp ->
                                            if (resp.success) onSuccess()
                                            else error = resp.error ?: "Sign in failed"
                                        },
                                        onFailure = { error = "Network error. Please try again." }
                                    )
                                    isLoading = false
                                }
                            }
                        }) else KeyboardActions.Default,
                        trailingIcon = {
                            IconButton(onClick = { passwordVisible = !passwordVisible }) {
                                Icon(
                                    if (passwordVisible) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                                    contentDescription = "Toggle password"
                                )
                            }
                        },
                        shape = RoundedCornerShape(12.dp),
                        isError = error != null
                    )
                }

                // Confirm Password (sign-up only)
                if (authMode == AuthMode.SIGN_UP) {
                    OutlinedTextField(
                        value = confirmPassword,
                        onValueChange = { confirmPassword = it; error = null },
                        label = { Text("Confirm Password") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        visualTransformation = if (confirmPasswordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
                        trailingIcon = {
                            IconButton(onClick = { confirmPasswordVisible = !confirmPasswordVisible }) {
                                Icon(
                                    if (confirmPasswordVisible) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                                    contentDescription = "Toggle password"
                                )
                            }
                        },
                        shape = RoundedCornerShape(12.dp),
                        isError = error != null && error!!.contains("match", ignoreCase = true)
                    )
                }

                // Primary action button
                Button(
                    onClick = {
                        scope.launch {
                            isLoading = true; error = null

                            when {
                                // ── Sign Up ──
                                authMode == AuthMode.SIGN_UP -> {
                                    // Validations
                                    if (firstName.isBlank() || lastName.isBlank()) {
                                        error = "First name and last name are required"
                                        isLoading = false
                                        return@launch
                                    }
                                    if (password.length < 8) {
                                        error = "Password must be at least 8 characters"
                                        isLoading = false
                                        return@launch
                                    }
                                    if (password != confirmPassword) {
                                        error = "Passwords do not match"
                                        isLoading = false
                                        return@launch
                                    }

                                    val full = "${firstName.trim()} ${lastName.trim()}"
                                    val result = authService.signUp(email, password, full)
                                    result.fold(
                                        onSuccess = { resp ->
                                            if (resp.success) onSuccess()
                                            else error = resp.error ?: "Sign up failed"
                                        },
                                        onFailure = { error = "Network error. Please try again." }
                                    )
                                }
                                // ── Sign In with Password ──
                                signInMethod == AuthSignInMethod.PASSWORD -> {
                                    val result = authService.signInWithPassword(email, password)
                                    result.fold(
                                        onSuccess = { resp ->
                                            if (resp.success) onSuccess()
                                            else error = resp.error ?: "Sign in failed"
                                        },
                                        onFailure = { error = "Network error. Please try again." }
                                    )
                                }
                                // ── Sign In with OTP ──
                                else -> {
                                    val result = authService.sendOTP(email)
                                    result.fold(
                                        onSuccess = { resp ->
                                            if (resp.success) {
                                                isNewUser = resp.isNewUser == true
                                                step = AuthStep.OTP_VERIFY
                                            } else {
                                                error = resp.error ?: "Failed to send OTP"
                                            }
                                        },
                                        onFailure = { error = "Network error. Please try again." }
                                    )
                                }
                            }
                            isLoading = false
                        }
                    },
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    enabled = when {
                        authMode == AuthMode.SIGN_UP ->
                            firstName.isNotBlank() && lastName.isNotBlank() &&
                            email.contains("@") && email.contains(".") &&
                            password.isNotBlank() && confirmPassword.isNotBlank() && !isLoading
                        signInMethod == AuthSignInMethod.PASSWORD ->
                            email.contains("@") && email.contains(".") && password.isNotBlank() && !isLoading
                        else ->
                            email.contains("@") && email.contains(".") && !isLoading
                    },
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = VMColors.Accent)
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(modifier = Modifier.size(20.dp), color = MaterialTheme.colorScheme.onPrimary, strokeWidth = 2.dp)
                    } else {
                        Text(
                            when {
                                authMode == AuthMode.SIGN_UP -> "Create Account"
                                signInMethod == AuthSignInMethod.PASSWORD -> "Sign In"
                                else -> "Send OTP"
                            },
                            fontWeight = FontWeight.SemiBold, fontSize = 16.sp
                        )
                    }
                }

                // Toggle sign-in method (only when in sign-in mode)
                if (authMode == AuthMode.SIGN_IN) {
                    TextButton(
                        onClick = {
                            signInMethod = if (signInMethod == AuthSignInMethod.PASSWORD) AuthSignInMethod.OTP else AuthSignInMethod.PASSWORD
                            error = null
                        }
                    ) {
                        Text(
                            if (signInMethod == AuthSignInMethod.PASSWORD) "Sign in with OTP instead" else "Sign in with password instead",
                            color = VMColors.Accent, fontSize = 14.sp
                        )
                    }
                }

                // Toggle between Sign In / Sign Up
                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        if (authMode == AuthMode.SIGN_IN) "Don't have an account?" else "Already have an account?",
                        fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    TextButton(onClick = {
                        authMode = if (authMode == AuthMode.SIGN_IN) AuthMode.SIGN_UP else AuthMode.SIGN_IN
                        error = null; password = ""; confirmPassword = ""
                    }) {
                        Text(
                            if (authMode == AuthMode.SIGN_IN) "Create Account" else "Sign In",
                            color = VMColors.Accent, fontSize = 14.sp, fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }

            // ════════════════════════════════════════════════════════════
            //  OTP VERIFY STEP
            // ════════════════════════════════════════════════════════════
            if (step == AuthStep.OTP_VERIFY) {
                AnimatedVisibility(visible = isNewUser) {
                    OutlinedTextField(
                        value = fullName,
                        onValueChange = { fullName = it; error = null },
                        label = { Text("Full Name") },
                        placeholder = { Text("Enter your name") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                        shape = RoundedCornerShape(12.dp)
                    )
                }

                OutlinedTextField(
                    value = otp,
                    onValueChange = { if (it.length <= 6) { otp = it.filter { c -> c.isDigit() }; error = null } },
                    label = { Text("6-Digit OTP") },
                    placeholder = { Text("Enter OTP from email") },
                    modifier = Modifier.fillMaxWidth().focusRequester(otpFocusRequester),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = {
                        if (otp.length == 6) {
                            scope.launch {
                                isLoading = true; error = null
                                val type = if (isNewUser) "signup" else "signin"
                                val result = authService.verifyOTP(email, otp, type, if (isNewUser) fullName else null)
                                result.fold(
                                    onSuccess = { resp ->
                                        if (resp.success) onSuccess()
                                        else error = resp.error ?: "Verification failed"
                                    },
                                    onFailure = { error = "Network error. Please try again." }
                                )
                                isLoading = false
                            }
                        }
                    }),
                    shape = RoundedCornerShape(12.dp),
                    isError = error != null
                )

                Button(
                    onClick = {
                        scope.launch {
                            isLoading = true; error = null
                            val type = if (isNewUser) "signup" else "signin"
                            val result = authService.verifyOTP(email, otp, type, if (isNewUser) fullName else null)
                            result.fold(
                                onSuccess = { resp ->
                                    if (resp.success) onSuccess()
                                    else error = resp.error ?: "Verification failed"
                                },
                                onFailure = { error = "Network error. Please try again." }
                            )
                            isLoading = false
                        }
                    },
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    enabled = otp.length == 6 && (!isNewUser || fullName.isNotBlank()) && !isLoading,
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = VMColors.Accent)
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(modifier = Modifier.size(20.dp), color = MaterialTheme.colorScheme.onPrimary, strokeWidth = 2.dp)
                    } else {
                        Text(if (isNewUser) "Create Account" else "Verify & Sign In", fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                    }
                }

                TextButton(onClick = {
                    scope.launch {
                        error = null
                        authService.sendOTP(email).fold(
                            onSuccess = { if (!it.success) error = it.error },
                            onFailure = { error = "Failed to resend OTP" }
                        )
                    }
                }) {
                    Text("Didn't receive it? Resend OTP", color = VMColors.Accent, fontSize = 14.sp)
                }
            }

            // Error
            AnimatedVisibility(visible = error != null) {
                Card(
                    shape = RoundedCornerShape(10.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)
                ) {
                    Text(
                        error ?: "",
                        modifier = Modifier.padding(14.dp),
                        color = MaterialTheme.colorScheme.onErrorContainer,
                        fontSize = 13.sp
                    )
                }
            }

            Spacer(Modifier.weight(1f))

            Text(
                "By continuing, you agree to our Terms of Service and Privacy Policy.",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
                lineHeight = 16.sp
            )
        }
    }

    LaunchedEffect(step) {
        if (step == AuthStep.OTP_VERIFY) {
            try { otpFocusRequester.requestFocus() } catch (_: Exception) {}
        }
    }
}
