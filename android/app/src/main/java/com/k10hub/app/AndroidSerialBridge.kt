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
            Log.d(TAG, "Requesting USB permission for device: ${device.deviceName}")
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
            Log.e(TAG, "Missing USB permission to open port.")
            return false
        }

        try {
            closePort() // Close any existing port

            val driver = getDriverForDevice(device)
            if (driver == null || driver.ports.isEmpty()) {
                Log.e(TAG, "No compatible USB Serial driver found for device.")
                return false
            }

            val port = driver.ports[0]
            val connection = usbManager.openDevice(device)
            if (connection == null) {
                Log.e(TAG, "Failed to open USB device connection.")
                return false
            }

            port.open(connection)
            port.setParameters(baudRate, 8, UsbSerialPort.STOPBITS_1, UsbSerialPort.PARITY_NONE)

            usbSerialPort = port
            usbConnection = connection
            currentDevice = device

            startReadThread()
            Log.i(TAG, "Successfully opened port at $baudRate baud.")
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
            port.rts = rts
            true
        } catch (e: Exception) {
            Log.w(TAG, "Failed to set control signals: ${e.message}")
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
                    val bytesRead = port.read(buffer, 200)
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
     * Probes for connected USB device matching UNIHIKER K10 (CH340, CP210x, ESP32 CDC, FTDI).
     */
    private fun findSupportedDevice(): UsbDevice? {
        val deviceList = usbManager.deviceList
        for (device in deviceList.values) {
            val vid = device.vendorId
            // 6790 (0x1A86 CH340), 4292 (0x10C4 CP210x), 12346 (0x303A ESP32), 1027 (0x0403 FTDI)
            if (vid == 6790 || vid == 4292 || vid == 12346 || vid == 1027) {
                return device
            }
        }
        // Fallback: return first available USB device if any
        return deviceList.values.firstOrNull()
    }

    /**
     * Resolves a compatible driver for the USB device.
     */
    private fun getDriverForDevice(device: UsbDevice): UsbSerialDriver? {
        // Standard probe
        val defaultProber = UsbSerialProber.getDefaultProber()
        val driver = defaultProber.probeDevice(device)
        if (driver != null) return driver

        // Custom probe table for ESP32-S3 / P4 native CDC-ACM
        val customTable = ProbeTable()
        customTable.addProduct(12346, 0x1001, CdcAcmSerialDriver::class.java) // ESP32-S3 CDC
        customTable.addProduct(12346, 0x1002, CdcAcmSerialDriver::class.java) // ESP32-P4 CDC
        val customProber = UsbSerialProber(customTable)
        return customProber.probeDevice(device)
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
