package com.vmfinancial.android.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

// VM Financial Colors - Charcoal + Teal Theme
object VMColors {
    // Background
    val BackgroundLight = Color(0xFFFAFAFA)
    val BackgroundDark = Color(0xFF09090B)
    
    // Surface
    val SurfaceLight = Color(0xFFFFFFFF)
    val SurfaceDark = Color(0xFF18181B)
    
    // Primary (Charcoal)
    val Primary = Color(0xFF18181B)
    val PrimaryLight = Color(0xFF27272A)
    
    // Accent (Teal)
    val Accent = Color(0xFF14B8A6)
    val AccentLight = Color(0xFF2DD4BF)
    val AccentDark = Color(0xFF0D9488)
    
    // Semantic Colors
    val Success = Color(0xFF22C55E)
    val Warning = Color(0xFFF59E0B)
    val Error = Color(0xFFEF4444)
    
    // Text
    val TextPrimary = Color(0xFF27272A)
    val TextSecondary = Color(0xFF71717A)
    val TextTertiary = Color(0xFFA1A1AA)
    val TextOnDark = Color(0xFFFAFAFA)
    
    // Market Colors
    val MarketUp = Color(0xFF22C55E)
    val MarketDown = Color(0xFFEF4444)
    
    // Borders
    val BorderLight = Color(0xFFE4E4E7)
    val BorderDark = Color(0xFF27272A)
}

private val LightColorScheme = lightColorScheme(
    primary = VMColors.Accent,
    onPrimary = Color.White,
    primaryContainer = VMColors.AccentLight,
    onPrimaryContainer = VMColors.Primary,
    secondary = VMColors.Primary,
    onSecondary = Color.White,
    secondaryContainer = VMColors.PrimaryLight,
    onSecondaryContainer = Color.White,
    tertiary = VMColors.AccentDark,
    onTertiary = Color.White,
    background = VMColors.BackgroundLight,
    onBackground = VMColors.TextPrimary,
    surface = VMColors.SurfaceLight,
    onSurface = VMColors.TextPrimary,
    surfaceVariant = VMColors.BackgroundLight,
    onSurfaceVariant = VMColors.TextSecondary,
    error = VMColors.Error,
    onError = Color.White,
    outline = VMColors.BorderLight
)

private val DarkColorScheme = darkColorScheme(
    primary = VMColors.Accent,
    onPrimary = Color.White,
    primaryContainer = VMColors.AccentDark,
    onPrimaryContainer = Color.White,
    secondary = VMColors.PrimaryLight,
    onSecondary = Color.White,
    secondaryContainer = VMColors.Primary,
    onSecondaryContainer = Color.White,
    tertiary = VMColors.AccentLight,
    onTertiary = VMColors.Primary,
    background = VMColors.BackgroundDark,
    onBackground = VMColors.TextOnDark,
    surface = VMColors.SurfaceDark,
    onSurface = VMColors.TextOnDark,
    surfaceVariant = VMColors.SurfaceDark,
    onSurfaceVariant = VMColors.TextTertiary,
    error = VMColors.Error,
    onError = Color.White,
    outline = VMColors.BorderDark
)

@Composable
fun VMFinancialTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    forceDark: Boolean? = null,
    content: @Composable () -> Unit
) {
    val isDark = forceDark ?: darkTheme
    val colorScheme = if (isDark) DarkColorScheme else LightColorScheme
    
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.background.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !isDark
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = VMTypography,
        content = content
    )
}
