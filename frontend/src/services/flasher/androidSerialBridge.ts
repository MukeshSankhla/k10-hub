// androidSerialBridge.ts
// Bridges the native Android USB Host (usb-serial-for-android) to the Web Serial API
// so that esptool-js and serialService can run seamlessly inside an Android WebView.

declare global {
  interface Window {
    AndroidSerialBridge?: {
      isNativeApp: () => boolean;
      getDeviceInfo: () => string;
      requestDevice: () => string; // Returns JSON string with status & device info
      openPort: (baudRate: number) => boolean;
      closePort: () => boolean;
      writeData: (base64Data: string) => boolean;
      setSignals: (dtr: boolean, rts: boolean) => boolean;
      setBaudRate: (baudRate: number) => boolean;
    };
    __onAndroidSerialData?: (base64Chunk: string) => void;
    __onAndroidSerialDisconnect?: () => void;
  }
}

/**
 * Checks if the current environment is running inside the K10-Hub Android Native Shell.
 */
export function isAndroidApp(): boolean {
  return typeof window !== 'undefined' && Boolean(window.AndroidSerialBridge?.isNativeApp?.());
}

/**
 * Helper to convert Uint8Array to Base64 string for efficient WebView bridge IPC.
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Helper to convert Base64 string back to Uint8Array.
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * AndroidSerialPort
 * Implements the standard W3C Web Serial SerialPort interface backed by Android Native USB Host.
 */
export class AndroidSerialPort {
  private _isOpen = false;
  private _readableStream: ReadableStream<Uint8Array> | null = null;
  private _writableStream: WritableStream<Uint8Array> | null = null;
  private _streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
  private _currentBaudRate = 115200;
  private _lastDtr = false;
  private _lastRts = false;

  constructor() {
    this._setupGlobalCallbacks();
  }

  private _setupGlobalCallbacks() {
    window.__onAndroidSerialData = (base64Chunk: string) => {
      if (this._streamController && base64Chunk) {
        try {
          const bytes = base64ToUint8Array(base64Chunk);
          this._streamController.enqueue(bytes);
        } catch (err) {
          console.error('[AndroidSerialPort] Error decoding incoming chunk:', err);
        }
      }
    };

    window.__onAndroidSerialDisconnect = () => {
      console.warn('[AndroidSerialPort] USB device disconnected.');
      this._isOpen = false;
      if (this._streamController) {
        try {
          this._streamController.close();
        } catch {
          // ignore already closed stream
        }
      }
    };
  }

  /**
   * Opens the native Android USB Serial connection.
   */
  async open(options: { baudRate: number }): Promise<void> {
    if (!window.AndroidSerialBridge) {
      throw new Error('AndroidSerialBridge is not available.');
    }

    this._currentBaudRate = options.baudRate || 115200;
    this._lastDtr = false;
    this._lastRts = false;

    const success = window.AndroidSerialBridge.openPort(this._currentBaudRate);

    if (!success) {
      throw new Error('Failed to open Android USB Serial Port. Please check USB connection and OTG permissions.');
    }

    this._isOpen = true;

    // Create ReadableStream
    this._readableStream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        this._streamController = controller;
      },
      cancel: () => {
        this._streamController = null;
      },
    });

    // Create WritableStream
    this._writableStream = new WritableStream<Uint8Array>({
      write: async (chunk: Uint8Array) => {
        if (!this._isOpen || !window.AndroidSerialBridge) {
          throw new Error('Android Serial port is closed.');
        }
        // Slice large payloads into 8192-byte chunks to avoid blocking WebView JS thread during large SPI flash writes
        const chunkSize = 8192;
        for (let i = 0; i < chunk.length; i += chunkSize) {
          const slice = chunk.subarray(i, i + chunkSize);
          const b64 = uint8ArrayToBase64(slice);
          const sent = window.AndroidSerialBridge.writeData(b64);
          if (!sent) {
            throw new Error('Failed to write bytes to Android USB Serial Port.');
          }
        }
      },
    });
  }

  get readable(): ReadableStream<Uint8Array> | null {
    return this._readableStream;
  }

  get writable(): WritableStream<Uint8Array> | null {
    return this._writableStream;
  }

  /**
   * Sets DTR and RTS hardware control lines (critical for ESP32 bootloader synchronization & reset).
   * Preserves state of un-specified control line to adhere to W3C Web Serial API spec.
   */
  async setSignals(signals: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void> {
    if (!window.AndroidSerialBridge) return;
    if (signals.dataTerminalReady !== undefined) {
      this._lastDtr = signals.dataTerminalReady;
    }
    if (signals.requestToSend !== undefined) {
      this._lastRts = signals.requestToSend;
    }
    window.AndroidSerialBridge.setSignals(this._lastDtr, this._lastRts);
  }

  /**
   * Dynamically alters the port baud rate (e.g. from 115200 bootloader up to 921600 flashing speed).
   */
  async setBaudRate(baudRate: number): Promise<void> {
    if (!window.AndroidSerialBridge) return;
    this._currentBaudRate = baudRate;
    window.AndroidSerialBridge.setBaudRate(baudRate);
  }

  /**
   * Closes the active native port.
   */
  async close(): Promise<void> {
    this._isOpen = false;
    if (this._streamController) {
      try {
        this._streamController.close();
      } catch {
        // stream may already be closed
      }
      this._streamController = null;
    }
    this._readableStream = null;
    this._writableStream = null;

    if (window.AndroidSerialBridge) {
      window.AndroidSerialBridge.closePort();
    }
  }

  /**
   * Returns device metadata info if supported by the native layer.
   */
  getInfo(): { usbVendorId?: number; usbProductId?: number } {
    try {
      if (window.AndroidSerialBridge) {
        const info = JSON.parse(window.AndroidSerialBridge.getDeviceInfo() || '{}');
        return {
          usbVendorId: info.vendorId,
          usbProductId: info.productId,
        };
      }
    } catch {
      // fallback
    }
    return {};
  }
}

/**
 * Requests an Android USB device via the native bridge and returns an AndroidSerialPort instance.
 */
export async function requestAndroidPort(): Promise<AndroidSerialPort> {
  if (!isAndroidApp()) {
    throw new Error('Not running inside the Android Native App.');
  }

  const resultJson = window.AndroidSerialBridge!.requestDevice();
  let result: { success: boolean; error?: string } = { success: false };

  try {
    result = JSON.parse(resultJson);
  } catch (err) {
    throw new Error('Invalid response from Android USB Bridge.');
  }

  if (!result.success) {
    throw new Error(result.error || 'No USB device selected or USB OTG permission denied.');
  }

  return new AndroidSerialPort();
}
