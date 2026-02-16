package com.vmfinancial.android.ui.screens.home

import android.content.Intent
import android.net.Uri
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.OpenInBrowser
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.vmfinancial.android.ui.theme.VMColors

/**
 * In-app article viewer with Reader Mode.
 *
 * Strategy:
 *  1. Load the URL in a WebView.
 *  2. After DOM loads, inject JS to detect paywall indicators
 *     (tp-modal, piano-modal, paywall-container, subscribe-wall, etc.).
 *  3. If paywall detected → redirect to external browser.
 *  4. If free → strip CSS/JS ads for reader-mode experience.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ArticleViewerScreen(
    url: String,
    title: String,
    source: String,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    var isLoading by remember { mutableStateOf(true) }
    var hasPaywall by remember { mutableStateOf(false) }
    var progress by remember { mutableIntStateOf(0) }

    // Reader-mode JS: strips ad containers, nav, footers, and forces readable font
    val readerModeJs = """
        (function() {
            // Paywall detection — check for known paywall class/ID patterns
            var paywallSelectors = [
                '.tp-modal', '.piano-modal', '#paywall', '.paywall',
                '.subscribe-wall', '.meter-wall', '.premium-wall',
                '.subscriber-only', '[data-paywall]', '.tp-backdrop',
                '.tp-container-inner', '#piano_offer', '.blocker-paywall',
                '.content-gate', '.reg-wall', '.login-wall'
            ];
            for (var i = 0; i < paywallSelectors.length; i++) {
                if (document.querySelector(paywallSelectors[i])) {
                    window.AndroidBridge.onPaywallDetected();
                    return;
                }
            }
            // Also check meta tags for robots noindex (common on paywalled pages)
            var metas = document.querySelectorAll('meta[name="robots"]');
            for (var j = 0; j < metas.length; j++) {
                if (metas[j].content && metas[j].content.indexOf('noindex') !== -1) {
                    window.AndroidBridge.onPaywallDetected();
                    return;
                }
            }

            // Reader mode: remove ads, nav, footer, sidebars
            var removeSelectors = [
                'header', 'footer', 'nav', '.navbar', '.sidebar',
                '.ad', '.ads', '.advertisement', '[class*="ad-"]', '[id*="ad-"]',
                '.social-share', '.comments', '.related-articles',
                '.cookie-banner', '.popup', '.modal', '.overlay',
                '#cookie-consent', '.newsletter-signup', '.sticky-ad',
                '[class*="promo"]', '.breadcrumb'
            ];
            removeSelectors.forEach(function(sel) {
                document.querySelectorAll(sel).forEach(function(el) { el.remove(); });
            });

            // Force readable styling
            var style = document.createElement('style');
            style.textContent = 'body { font-family: Georgia, serif !important; font-size: 18px !important; line-height: 1.7 !important; max-width: 720px !important; margin: 0 auto !important; padding: 16px !important; background: inherit !important; color: inherit !important; } img { max-width: 100% !important; height: auto !important; } * { float: none !important; }';
            document.head.appendChild(style);
        })();
    """.trimIndent()

    // If paywall detected, open in external browser and go back
    LaunchedEffect(hasPaywall) {
        if (hasPaywall) {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            context.startActivity(intent)
            onBack()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(title, fontSize = 13.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(source, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                        context.startActivity(intent)
                    }) {
                        Icon(Icons.Filled.OpenInBrowser, contentDescription = "Open in browser")
                    }
                    IconButton(onClick = {
                        val shareIntent = Intent(Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(Intent.EXTRA_TEXT, "$title\n$url")
                        }
                        context.startActivity(Intent.createChooser(shareIntent, "Share article"))
                    }) {
                        Icon(Icons.Filled.Share, contentDescription = "Share")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            AndroidView(
                factory = { ctx ->
                    WebView(ctx).apply {
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        settings.loadWithOverviewMode = true
                        settings.useWideViewPort = true
                        settings.builtInZoomControls = false

                        // JS bridge for paywall detection
                        addJavascriptInterface(object {
                            @android.webkit.JavascriptInterface
                            fun onPaywallDetected() {
                                hasPaywall = true
                            }
                        }, "AndroidBridge")

                        webViewClient = object : WebViewClient() {
                            override fun onPageFinished(view: WebView?, pageUrl: String?) {
                                super.onPageFinished(view, pageUrl)
                                isLoading = false
                                // Inject reader mode + paywall detection JS
                                view?.evaluateJavascript(readerModeJs, null)
                            }

                            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                                // Keep navigation inside WebView
                                return false
                            }
                        }

                        webChromeClient = object : WebChromeClient() {
                            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                                progress = newProgress
                            }
                        }

                        loadUrl(url)
                    }
                },
                modifier = Modifier.fillMaxSize()
            )

            // Loading progress
            if (isLoading) {
                LinearProgressIndicator(
                    progress = { progress / 100f },
                    modifier = Modifier.fillMaxWidth().align(Alignment.TopCenter),
                    color = VMColors.Accent
                )
            }
        }
    }
}
