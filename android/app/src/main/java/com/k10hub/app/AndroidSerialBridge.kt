package com.k10hub.app

import android.content.Context
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbManager
import android.util.Base64
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.hoho.android.usbserial.driver.CdcAcmSerialDriver
import com.hoho.android.usbserial.driver.Ch34xSerialDriver
import com.hoho.android.usbserial.driver.Cp21xxSerialDriver
import com.hoho.android.usbserial.driver.FtdiSerialDriver
import com.hoho.android.usbserial.driver.ProbeTable
import com.hoho.android.usbserial.driver.UsbSerialDriver
import com.hoho.android.usbserial.driver.UsbSerialPort
import com.hoho.android.usbserial.driver.UsbSerialProber
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.atomic.AtomicBoolean

/**
 * AndroidSerialBridge
 * Exposes native Android USB Host serial communication to JavaScript via WebView.
 */
@Suppress("unused")
class AndroidSerialBridge(
    private val activity: MainActivity,
    private val webView: WebView,
) {
    private val usbManager = activity.getSystemService(Context.USB_SERVICE) as UsbManager

    private var usbConnection: UsbDeviceConnection? = null
    private var usbSerialPort: UsbSerialPort? = null
    private var readThread: Thread? = null
    private val isRunning = AtomicBoolean(false)

    private var currentDevice: UsbDevice? = null

    @JavascriptInterface
    fun isNativeApp(): Boolean {
        return true
    }

    @JavascriptInterface
    fun getDeviceInfo(): String {
        val result = JSONObject()
        val device = currentDevice ?: findSupportedDevice()
        if (device != null) {
            result.put("name", device.deviceName)
            result.put("vendorId", device.vendorId)
            result.put("productId", device.productId)
            result.put("manufacturer", device.manufacturerName ?: "Unknown")
            result.put("productName", device.productName ?: "UNIHIKER K10")
        }
        return result.toString()
    }

    /**
     * Probes and requests permission for the UNIHIKER K10 / USB-UART chip.
     */
    @JavascriptInterface
    fun requestDevice(): String {
        val response = JSONObject()
        val device = findSupportedDevice()

        if (device == null) {
            response.put("success", false)
            response.put("error", "No UNIHIKER K10 or USB Serial device detected. Please connect via USB-OTG cable and ensure OTG is enabled.")
            return response.toString()
        }

        currentDevice = device

        if (!usbManager.hasPermission(device)) {
            Log.d(TAG, "Requesting USB permission for device: ${device.deviceName} (VID: ${device.vendorId}, PID: ${device.productId})")
            activity.requestUsbPermission(device)
            response.put("success", false)
            response.put("error", "USB permission requested. Please tap Allow on the Android system prompt.")
            return response.toString()
        }

        response.put("success", true)
        response.put("deviceName", device.productName ?: device.deviceName)
        return response.toString()
    }

    /**
     * Opens the USB serial port at the given baud rate.
     */
    @JavascriptInterface
    fun openPort(baudRate: Int): Boolean {
        val device = currentDevice ?: findSupportedDevice()
        if (device == null) {
            Log.e(TAG, "No device available to open.")
            return false
        }

        if (!usbManager.hasPermission(device)) {
            Log.e(TAG, "Missing USB permission to open port for device: ${device.deviceName}")
            return false
        }

        try {
            closePort() // Close any existing port

            val driver = getDriverForDevice(device)
            if (driver == null || driver.ports.isEmpty()) {
                Log.e(TAG, "No compatible USB Serial driver found for device VID ${device.vendorId} PID ${device.productId}")
                return false
            }

            val port = driver.ports[0]
            val connection = usbManager.openDevice(device)
            if (connection == null) {
                Log.e(TAG, "Failed to open USB device connection for device: ${device.deviceName}")
                return false
            }

            port.open(connection)
            port.setParameters(baudRate, 8, UsbSerialPort.STOPBITS_1, UsbSerialPort.PARITY_NONE)

            // CDC ACM spec: DTR = true signals to ESP32-S3 CDC that terminal is connected and ready to receive data
            try {
                port.dtr = true
                port.rts = false
            } catch (e: Exception) {
                Log.w(TAG, "DTR/RTS initial line state setup notice: ${e.message}")
            }

            usbSerialPort = port
            usbConnection = connection
            currentDevice = device

            startReadThread()
            Log.i(TAG, "Successfully opened port for ${device.productName ?: device.deviceName} (VID: ${device.vendorId}, PID: ${device.productId}) at $baudRate baud.")
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Error opening serial port: ${e.message}", e)
            closePort()
            return false
        }
    }

    /**
     * Changes baud rate on an active port (e.g. from 115200 ROM sync to 460800/921600 flashing).
     */
    @JavascriptInterface
    fun setBaudRate(baudRate: Int): Boolean {
        val port = usbSerialPort ?: return false
        return try {
            port.setParameters(baudRate, 8, UsbSerialPort.STOPBITS_1, UsbSerialPort.PARITY_NONE)
            Log.i(TAG, "Baud rate updated to $baudRate")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to update baud rate: ${e.message}")
            false
        }
    }

    /**
     * Toggles DTR and RTS signals for ESP32 hardware bootloader entry / reset.
     * Note: RTS controls EN (Active Low), DTR controls IO0 (Active Low).
     */
    @JavascriptInterface
    fun setSignals(dtr: Boolean, rts: Boolean): Boolean {
        val port = usbSerialPort ?: return false
        return try {
            port.dtr = dtr
            Thread.sleep(10)
            port.rts = rts
            true
        } catch (e: Exception) {
            Log.w(TAG, "Failed to set control signals (DTR=$dtr, RTS=$rts): ${e.message}")
            false
        }
    }

    /**
     * Writes raw binary data (passed as Base64 encoded string from JS).
     */
    @JavascriptInterface
    fun writeData(base64Data: String): Boolean {
        val port = usbSerialPort ?: return false
        return try {
            val bytes = Base64.decode(base64Data, Base64.NO_WRAP)
            port.write(bytes, 2000)
            true
        } catch (e: Exception) {
            Log.e(TAG, "Write error: ${e.message}")
            false
        }
    }

    /**
     * Closes the active USB serial port.
     */
    @JavascriptInterface
    fun closePort(): Boolean {
        isRunning.set(false)
        try {
            readThread?.interrupt()
            readThread = null
        } catch (_: Exception) {}

        try {
            usbSerialPort?.close()
        } catch (_: Exception) {}

        try {
            usbConnection?.close()
        } catch (_: Exception) {}

        usbSerialPort = null
        usbConnection = null
        Log.i(TAG, "Serial port closed.")
        return true
    }

    /**
     * Continuously reads incoming bytes from the USB port and dispatches them to JavaScript.
     */
    private fun startReadThread() {
        isRunning.set(true)
        readThread = Thread {
            val buffer = ByteArray(4096)
            while (isRunning.get()) {
                val port = usbSerialPort ?: break
                try {
                    val bytesRead = port.read(buffer, 50)
                    if (bytesRead > 0) {
                        val chunk = ByteArray(bytesRead)
                        System.arraycopy(buffer, 0, chunk, 0, bytesRead)
                        val base64Chunk = Base64.encodeToString(chunk, Base64.NO_WRAP)

                        activity.runOnUiThread {
                            webView.evaluateJavascript(
                                "if (window.__onAndroidSerialData) { window.__onAndroidSerialData('$base64Chunk'); }",
                                null,
                            )
                        }
                    }
                } catch (e: IOException) {
                    if (isRunning.get()) {
                        Log.w(TAG, "Read thread I/O exception: ${e.message}")
                    }
                    break
                } catch (e: Exception) {
                    Log.e(TAG, "Unexpected read thread error: ${e.message}")
                    break
                }
            }
        }.apply {
            name = "K10-SerialReadThread"
            priority = Thread.MAX_PRIORITY
            start()
        }
    }

    /**
     * Probes for connected USB device matching UNIHIKER K10 (CH340, CP210x, ESP32 CDC, FTDI, CDC-ACM).
     */
    private fun findSupportedDevice(): UsbDevice? {
        val deviceList = usbManager.deviceList
        for (device in deviceList.values) {
            val vid = device.vendorId
            // 6790 (CH340), 4292 (CP210x), 12346 (ESP32), 1027 (FTDI), 9025 (Arduino), 11914 (RP2040), 1155 (STM32)
            if (vid == 6790 || vid == 4292 || vid == 12346 || vid == 1027 || vid == 9025 || vid == 11914 || vid == 1155) {
                return device
            }
        }
        // Fallback: return first available USB device if any
        return deviceList.values.firstOrNull()
    }

    /**
     * Resolves a compatible driver for the USB device with comprehensive fallback mapping.
     */
    private fun getDriverForDevice(device: UsbDevice): UsbSerialDriver? {
        // 1. Try default prober
        val defaultProber = UsbSerialProber.getDefaultProber()
        var driver = defaultProber.probeDevice(device)
        if (driver != null) return driver

        // 2. Try custom probe table for all common Espressif / WCH / Silicon Labs PIDs
        val customTable = ProbeTable()
        val pid = device.productId
        val vid = device.vendorId

        when (vid) {
            12346 -> {
                // Espressif USB CDC ACM (ESP32-S3, ESP32-C3, ESP32-S2, ESP32-P4)
                customTable.addProduct(vid, pid, CdcAcmSerialDriver::class.java)
            }
            6790 -> {
                // WCH CH340 / CH341
                customTable.addProduct(vid, pid, Ch34xSerialDriver::class.java)
            }
            4292 -> {
                // Silicon Labs CP210x
                customTable.addProduct(vid, pid, Cp21xxSerialDriver::class.java)
            }
            1027 -> {
                // FTDI
                customTable.addProduct(vid, pid, FtdiSerialDriver::class.java)
            }
            else -> {
                // Fallback CDC-ACM
                customTable.addProduct(vid, pid, CdcAcmSerialDriver::class.java)
            }
        }

        val customProber = UsbSerialProber(customTable)
        driver = customProber.probeDevice(device)
        if (driver != null) return driver

        // 3. Direct driver initialization fallback if probe table failed
        return try {
            when (vid) {
                6790 -> Ch34xSerialDriver(device)
                4292 -> Cp21xxSerialDriver(device)
                1027 -> FtdiSerialDriver(device)
                else -> CdcAcmSerialDriver(device)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Fallback driver initialization failed for VID $vid PID $pid: ${e.message}")
            null
        }
    }

    fun onDeviceDetached() {
        closePort()
        activity.runOnUiThread {
            webView.evaluateJavascript(
                "if (window.__onAndroidSerialDisconnect) { window.__onAndroidSerialDisconnect(); }",
                null,
            )
        }
    }

    companion object {
        private const val TAG = "K10SerialBridge"
    }
}
