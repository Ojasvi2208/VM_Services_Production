package com.vmfinancial.android.services

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*

// ── Models ──

@Serializable
data class AuthUser(
    val id: String,
    val email: String,
    val fullName: String
)

@Serializable
data class SendOTPResponse(
    val success: Boolean,
    val message: String? = null,
    val error: String? = null,
    val expiresIn: Int? = null,
    val isNewUser: Boolean? = null
)

@Serializable
data class VerifyOTPResponse(
    val success: Boolean,
    val message: String? = null,
    val error: String? = null,
    val token: String? = null,
    val user: AuthUserResponse? = null
)

@Serializable
data class AuthUserResponse(
    val id: Int? = null,
    val email: String? = null,
    val fullName: String? = null
)

@Serializable
data class SigninResponse(
    val success: Boolean,
    val message: String? = null,
    val error: String? = null,
    val token: String? = null,
    val user: SigninUser? = null
)

@Serializable
data class SigninUser(
    val id: String? = null,
    val email: String? = null,
    val fullName: String? = null,
    val phone: String? = null
)

@Serializable
data class SessionResponse(
    val authenticated: Boolean,
    val user: SessionUser? = null
)

@Serializable
data class SessionUser(
    val id: String? = null,
    val email: String? = null,
    val fullName: String? = null,
    val phone: String? = null,
    val emailVerified: Boolean? = null
)

// ── Service ──

class AuthService(private val context: Context) {

    private val json = Json { ignoreUnknownKeys = true; isLenient = true }
    private val baseUrl = "https://www.vmfinancialservices.com/api"

    private val client = HttpClient {
        install(ContentNegotiation) {
            json(Json { ignoreUnknownKeys = true; isLenient = true })
        }
        followRedirects = false
    }

    private val prefs: SharedPreferences by lazy {
        try {
            val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
            EncryptedSharedPreferences.create(
                "auth_prefs",
                masterKeyAlias,
                context,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Exception) {
            // Fallback to regular prefs if encryption fails (emulator etc.)
            context.getSharedPreferences("auth_prefs_fallback", Context.MODE_PRIVATE)
        }
    }

    private val _currentUser = MutableStateFlow<AuthUser?>(null)
    val currentUser: StateFlow<AuthUser?> = _currentUser.asStateFlow()

    val isLoggedIn: Boolean get() = _currentUser.value != null
    val authToken: String? get() = prefs.getString("jwt_token", null)

    init {
        // Restore session from stored token
        restoreSession()
    }

    private fun restoreSession() {
        val token = prefs.getString("jwt_token", null)
        val email = prefs.getString("user_email", null)
        val fullName = prefs.getString("user_fullname", null)
        val id = prefs.getString("user_id", null)

        if (token != null && email != null && fullName != null && id != null) {
            _currentUser.value = AuthUser(id = id, email = email, fullName = fullName)
        }
    }

    // ── Password-based signin (primary for existing users) ──
    private fun obfuscateForTransport(data: String): String {
        val encoded = java.util.Base64.getEncoder().encodeToString(data.toByteArray(Charsets.UTF_8))
        val reversed = encoded.reversed()
        return "SEC:$reversed"
    }

    suspend fun signInWithPassword(email: String, password: String): Result<SigninResponse> {
        return try {
            val obfuscated = obfuscateForTransport(password)
            val bodyJson = """{"email":"${email.lowercase().trim()}","password":"$obfuscated"}"""

            val responseBody: String = client.post("$baseUrl/auth/mobile-login") {
                contentType(ContentType.Application.Json)
                setBody(bodyJson)
            }.body()

            val parsed = json.decodeFromString<SigninResponse>(responseBody)

            if (parsed.success && parsed.user != null && parsed.token != null) {
                val user = AuthUser(
                    id = parsed.user.id ?: "",
                    email = parsed.user.email ?: email,
                    fullName = parsed.user.fullName ?: ""
                )
                saveCredentials(parsed.token, user)
                _currentUser.value = user
            }

            Result.success(parsed)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ── Sign up with email + password (calls /api/auth/signup) ──
    suspend fun signUp(email: String, password: String, fullName: String): Result<SigninResponse> {
        return try {
            val obfuscated = obfuscateForTransport(password)
            val bodyJson = """{"email":"${email.lowercase().trim()}","password":"$obfuscated","fullName":"${fullName.trim()}"}"""

            val responseBody: String = client.post("$baseUrl/auth/signup") {
                contentType(ContentType.Application.Json)
                setBody(bodyJson)
            }.body()

            val parsed = json.decodeFromString<SigninResponse>(responseBody)

            if (parsed.success && parsed.token != null && parsed.user != null) {
                val user = AuthUser(
                    id = parsed.user.id ?: "",
                    email = parsed.user.email ?: email,
                    fullName = parsed.user.fullName ?: fullName
                )
                saveCredentials(parsed.token, user)
                _currentUser.value = user
            }

            Result.success(parsed)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ── OTP-based signin (fallback / new users) ──

    // Step 1: Send OTP to email
    suspend fun sendOTP(email: String, type: String = "signin"): Result<SendOTPResponse> {
        return try {
            val response: String = client.post("$baseUrl/auth/send-otp") {
                contentType(ContentType.Application.Json)
                setBody("""{"email":"${email.lowercase().trim()}","type":"$type"}""")
            }.body()
            val parsed = json.decodeFromString<SendOTPResponse>(response)
            Result.success(parsed)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // Step 2: Verify OTP and get JWT token
    suspend fun verifyOTP(
        email: String,
        otp: String,
        type: String = "signin",
        fullName: String? = null
    ): Result<VerifyOTPResponse> {
        return try {
            val bodyMap = mutableMapOf(
                "email" to email.lowercase().trim(),
                "otp" to otp.trim(),
                "type" to type
            )
            if (fullName != null) bodyMap["fullName"] = fullName.trim()

            val bodyJson = bodyMap.entries.joinToString(",", "{", "}") { "\"${it.key}\":\"${it.value}\"" }

            val response: String = client.post("$baseUrl/auth/verify-otp") {
                contentType(ContentType.Application.Json)
                setBody(bodyJson)
            }.body()
            val parsed = json.decodeFromString<VerifyOTPResponse>(response)

            if (parsed.success && parsed.token != null && parsed.user != null) {
                // Save credentials
                val user = AuthUser(
                    id = parsed.user.id?.toString() ?: "",
                    email = parsed.user.email ?: email,
                    fullName = parsed.user.fullName ?: fullName ?: ""
                )
                saveCredentials(parsed.token, user)
                _currentUser.value = user
            }

            Result.success(parsed)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // Sign out
    fun signOut() {
        prefs.edit()
            .remove("jwt_token")
            .remove("user_email")
            .remove("user_fullname")
            .remove("user_id")
            .apply()
        _currentUser.value = null
    }

    // Validate session is still active (call on app open)
    suspend fun validateSession(): Boolean {
        val token = authToken ?: return false
        return try {
            val response: String = client.get("$baseUrl/auth/session") {
                header("Authorization", "Bearer $token")
            }.body()
            val parsed = json.decodeFromString<SessionResponse>(response)
            if (!parsed.authenticated) {
                signOut()
                false
            } else {
                // Update user info if needed
                parsed.user?.let { u ->
                    val updated = AuthUser(
                        id = u.id ?: _currentUser.value?.id ?: "",
                        email = u.email ?: _currentUser.value?.email ?: "",
                        fullName = u.fullName ?: _currentUser.value?.fullName ?: ""
                    )
                    _currentUser.value = updated
                    saveCredentials(token, updated)
                }
                true
            }
        } catch (e: Exception) {
            // Network error — keep existing session (offline tolerance)
            true
        }
    }

    private fun saveCredentials(token: String, user: AuthUser) {
        prefs.edit()
            .putString("jwt_token", token)
            .putString("user_email", user.email)
            .putString("user_fullname", user.fullName)
            .putString("user_id", user.id)
            .apply()
    }
}
