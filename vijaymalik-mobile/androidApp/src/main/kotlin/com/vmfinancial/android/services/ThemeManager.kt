package com.vmfinancial.android.services

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class ThemeMode { SYSTEM, LIGHT, DARK }

class ThemeManager(context: Context) {

    private val prefs = context.getSharedPreferences("vm_prefs", Context.MODE_PRIVATE)

    private val _themeMode = MutableStateFlow(loadTheme())
    val themeMode: StateFlow<ThemeMode> = _themeMode.asStateFlow()

    private fun loadTheme(): ThemeMode {
        return when (prefs.getString("theme_mode", "system")) {
            "light" -> ThemeMode.LIGHT
            "dark" -> ThemeMode.DARK
            else -> ThemeMode.SYSTEM
        }
    }

    fun setTheme(mode: ThemeMode) {
        val key = when (mode) {
            ThemeMode.LIGHT -> "light"
            ThemeMode.DARK -> "dark"
            ThemeMode.SYSTEM -> "system"
        }
        prefs.edit().putString("theme_mode", key).apply()
        _themeMode.value = mode
    }
}
