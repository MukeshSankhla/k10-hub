package com.k10hub.app

import android.animation.ObjectAnimator
import android.animation.PropertyValuesHolder
import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Bitmap
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.animation.AccelerateDecelerateInterpolator
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.IntentCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.WindowCompat
import com.k10hub.app.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var serialBridge: AndroidSerialBridge

    // Configurable Hub URL: defaults to K10 Hub live Vercel app
    // Can be overridden via intent extra HUB_URL or strings.xml
    private var hubUrl = "https://k10hub.vercel.app/"

    private var pulseAnimator: ObjectAnimator? = null
    private var isPageLoadedSuccessfully = false
    private var isSplashDismissed = false

    private val usbReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                ACTION_USB_PERMISSION -> {
                    synchronized(this) {
                        val device: UsbDevice? = intent.let {
                            IntentCompat.getParcelableExtra(it, UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
                        }

                        if (intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)) {
                            device?.let {
                                Log.i(TAG, "USB Permission granted for: ${it.deviceName}")
                                Toast.makeText(this@MainActivity, getString(R.string.usb_permission_granted), Toast.LENGTH_SHORT).show()
                                binding.webView.evaluateJavascript(
                                    "console.log('[Android Native] USB permission granted for " + it.deviceName + "');",
                                    null,
                                )
                            }
                        } else {
                            Log.w(TAG, "USB Permission denied for device: ${device?.deviceName}")
                            Toast.makeText(this@MainActivity, getString(R.string.usb_permission_denied), Toast.LENGTH_SHORT).show()
                        }
                    }
                }
                UsbManager.ACTION_USB_DEVICE_ATTACHED -> {
                    Log.i(TAG, "USB Device Attached")
                    Toast.makeText(this@MainActivity, getString(R.string.usb_connected), Toast.LENGTH_SHORT).show()
                }
                UsbManager.ACTION_USB_DEVICE_DETACHED -> {
                    Log.i(TAG, "USB Device Detached")
                    serialBridge.onDeviceDetached()
                    Toast.makeText(this@MainActivity, getString(R.string.usb_disconnected), Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        // Install Android 12+ SplashScreen before super.onCreate()
        val splashScreen = installSplashScreen()
        super.onCreate(savedInstanceState)

        // Enable Edge-to-Edge full screen layout and dark system status/nav bar icons over light paper background
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val windowInsetsController = WindowCompat.getInsetsController(window, window.decorView)
        windowInsetsController.isAppearanceLightStatusBars = true
        windowInsetsController.isAppearanceLightNavigationBars = true

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Keep OS splash screen visible momentarily while layout prepares
        splashScreen.setKeepOnScreenCondition { false }

        // Start in-app breathing animation on the logo card
        startLogoPulseAnimation()

        // Read URL from Intent if passed, or fall back to default string resource
        val intentUrl = intent?.getStringExtra("HUB_URL")
        hubUrl = if (!intentUrl.isNullOrBlank()) intentUrl else getString(R.string.default_hub_url)

        setupWebView()
        setupSwipeRefresh()
        setupErrorRetry()
        registerUsbReceivers()
        setupBackNavigation()

        Log.i(TAG, "Loading K10 Hub URL: $hubUrl")
        loadHub()
    }

    private fun startLogoPulseAnimation() {
        val scaleX = PropertyValuesHolder.ofFloat(View.SCALE_X, 0.94f, 1.05f)
        val scaleY = PropertyValuesHolder.ofFloat(View.SCALE_Y, 0.94f, 1.05f)
        pulseAnimator = ObjectAnimator.ofPropertyValuesHolder(binding.logoCard, scaleX, scaleY).apply {
            duration = 1200
            repeatMode = ValueAnimator.REVERSE
            repeatCount = ValueAnimator.INFINITE
            interpolator = AccelerateDecelerateInterpolator()
            start()
        }
    }

    private fun stopLogoPulseAnimation() {
        pulseAnimator?.cancel()
        pulseAnimator = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        serialBridge = AndroidSerialBridge(this, binding.webView)

        binding.webView.apply {
            // Hardware acceleration layer
            setLayerType(View.LAYER_TYPE_HARDWARE, null)
            scrollBarStyle = View.SCROLLBARS_INSIDE_OVERLAY
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false

            // Scroll listener: prevent SwipeRefreshLayout from triggering while scrolling down page
            setOnScrollChangeListener { _, _, scrollY, _, _ ->
                binding.swipeRefreshLayout.isEnabled = (scrollY == 0 && !isSplashActive())
            }
        }

        if (BuildConfig.DEBUG) {
            WebView.setWebContentsDebuggingEnabled(true)
        }

        val settings: WebSettings = binding.webView.settings
        settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            useWideViewPort = true
            loadWithOverviewMode = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            mediaPlaybackRequiresUserGesture = false

            // Append K10HubApp marker to User Agent
            val defaultUa = userAgentString
            userAgentString = "$defaultUa K10HubApp/1.0.0"
        }

        // Expose JavaScript Bridge
        binding.webView.addJavascriptInterface(serialBridge, "AndroidSerialBridge")

        binding.webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress < 100) {
                    binding.loadingIndicator.visibility = View.VISIBLE
                    binding.loadingIndicator.progress = newProgress
                } else {
                    binding.loadingIndicator.visibility = View.GONE
                    binding.swipeRefreshLayout.isRefreshing = false
                    if (!isSplashDismissed && isPageLoadedSuccessfully) {
                        dismissSplashSmoothly()
                    }
                }
            }

            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                consoleMessage?.let {
                    Log.d("K10WebViewConsole", "[${it.messageLevel()}] ${it.message()} (${it.sourceId()}:${it.lineNumber()})")
                }
                return super.onConsoleMessage(consoleMessage)
            }
        }

        binding.webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                binding.loadingIndicator.visibility = View.VISIBLE
                isPageLoadedSuccessfully = true
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                binding.loadingIndicator.visibility = View.GONE
                binding.swipeRefreshLayout.isRefreshing = false

                if (isPageLoadedSuccessfully && !isSplashDismissed) {
                    dismissSplashSmoothly()
                }
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?,
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    isPageLoadedSuccessfully = false
                    binding.loadingIndicator.visibility = View.GONE
                    binding.swipeRefreshLayout.isRefreshing = false
                    Log.e(TAG, "Failed to load page: ${error?.description}")
                    showErrorState()
                }
            }
        }
    }

    private fun isSplashActive(): Boolean {
        return binding.splashOverlay.visibility == View.VISIBLE
    }

    private fun dismissSplashSmoothly() {
        if (isSplashDismissed) return
        isSplashDismissed = true

        binding.splashOverlay.animate()
            .alpha(0f)
            .scaleX(1.04f)
            .scaleY(1.04f)
            .setDuration(360)
            .setInterpolator(AccelerateDecelerateInterpolator())
            .withEndAction {
                binding.splashOverlay.visibility = View.GONE
                binding.swipeRefreshLayout.isEnabled = (binding.webView.scrollY == 0)
                stopLogoPulseAnimation()
            }
            .start()
    }

    private fun showErrorState() {
        binding.splashOverlay.visibility = View.VISIBLE
        binding.splashOverlay.alpha = 1f
        binding.splashOverlay.scaleX = 1f
        binding.splashOverlay.scaleY = 1f
        binding.splashProgress.visibility = View.GONE
        binding.tvSplashStatus.text = getString(R.string.connection_error_title)
        binding.errorContainer.visibility = View.VISIBLE
        binding.swipeRefreshLayout.isEnabled = false
    }

    private fun setupErrorRetry() {
        binding.btnRetry.setOnClickListener {
            binding.errorContainer.visibility = View.GONE
            binding.splashProgress.visibility = View.VISIBLE
            binding.tvSplashStatus.text = getString(R.string.loading_message)
            isPageLoadedSuccessfully = false
            loadHub()
        }
    }

    private fun loadHub() {
        if (!isNetworkAvailable()) {
            showErrorState()
            return
        }
        binding.webView.loadUrl(hubUrl)
    }

    private fun isNetworkAvailable(): Boolean {
        val connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun setupSwipeRefresh() {
        binding.swipeRefreshLayout.setColorSchemeResources(R.color.brand_accent)
        binding.swipeRefreshLayout.setProgressBackgroundColorSchemeResource(R.color.brand_primary)
        binding.swipeRefreshLayout.setOnRefreshListener {
            binding.webView.reload()
        }
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(enabled = true) {
                override fun handleOnBackPressed() {
                    if (binding.webView.canGoBack()) {
                        binding.webView.goBack()
                    } else {
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                    }
                }
            },
        )
    }

    fun requestUsbPermission(device: UsbDevice) {
        val usbManager = getSystemService(USB_SERVICE) as UsbManager
        val permissionIntent = PendingIntent.getBroadcast(
            this,
            0,
            Intent(ACTION_USB_PERMISSION),
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0,
        )
        usbManager.requestPermission(device, permissionIntent)
    }

    private fun registerUsbReceivers() {
        val filter = IntentFilter().apply {
            addAction(ACTION_USB_PERMISSION)
            addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED)
            addAction(UsbManager.ACTION_USB_DEVICE_DETACHED)
        }

        ContextCompat.registerReceiver(
            this,
            usbReceiver,
            filter,
            ContextCompat.RECEIVER_EXPORTED,
        )
    }

    override fun onResume() {
        super.onResume()
        binding.webView.onResume()
    }

    override fun onPause() {
        super.onPause()
        binding.webView.onPause()
    }

    override fun onDestroy() {
        stopLogoPulseAnimation()
        try {
            unregisterReceiver(usbReceiver)
        } catch (_: Exception) {}

        serialBridge.closePort()

        // Clean up WebView completely to avoid memory leaks
        binding.webView.apply {
            stopLoading()
            webChromeClient = null
            webViewClient = object : WebViewClient() {}
            removeJavascriptInterface("AndroidSerialBridge")
            loadUrl("about:blank")
            clearHistory()
            removeAllViews()
            destroy()
        }

        super.onDestroy()
    }

    companion object {
        private const val TAG = "K10MainActivity"
        private const val ACTION_USB_PERMISSION = "com.k10hub.app.USB_PERMISSION"
    }
}
