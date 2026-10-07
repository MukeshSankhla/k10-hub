// serialService.ts
// Handles Web Serial connection, port requests, device lifecycle, and chip family detection.

// @ts-ignore
import { ESPLoader, Transport } from 'esptool-js/bundle.js';
import { logger } from './loggerService';
import { isAndroidApp, requestAndroidPort } from './androidSerialBridge';

let port: any = null;
let transport: any = null;
let esploader: any = null;
let deviceLostCallback: (() => void) | null = null;

export interface ConnectedDeviceInfo {
  chipName: string;
  chipDescription: string;
  macAddress: string;
  esploader: any;
}

export const serialService = {
  /**
   * Detects whether running inside the K10-Hub Android Native Shell.
   */
  isAndroidNativeApp(): boolean {
    return isAndroidApp();
  },

  /**
   * Checks if serial flashing is available in the current environment (Native Android or Web Serial).
   */
  checkBrowserSupport(): boolean {
    return this.isAndroidNativeApp() || (typeof navigator !== 'undefined' && 'serial' in navigator);
  },

  /**
   * Detects whether the user is on a mobile device.
   */
  isMobile(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  },

  /**
   * Detects whether the user is on Google Chrome / Chromium on Android.
   */
  isAndroidChrome(): boolean {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    return /Android/i.test(ua) && (/Chrome/i.test(ua) || /Chromium/i.test(ua));
  },

  /**
   * Detects whether the user is on Apple iOS (where Apple WebKit blocks Web Serial).
   */
  isIOS(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  },

  /**
   * Requests a serial port from the browser or Android USB host.
   * Must be triggered directly by a user gesture.
   */
  async requestPort(): Promise<any> {
    if (this.isAndroidNativeApp()) {
      port = await requestAndroidPort();
      logger.log('USB-OTG device connected via Android Native Core.');
      return port;
    }

    if (!this.checkBrowserSupport()) {
      throw new Error(
        "Your browser doesn't support Web Serial. Please use Google Chrome, Microsoft Edge, or the K10-Hub Android App."
      );
    }

    try {
      port = await (navigator as any).serial.requestPort();
      logger.log('Serial port selected by user.');
      return port;
    } catch (error: any) {
      if (error.name === 'NotFoundError' || error.message?.includes('User cancelled') || error.message?.includes('No port selected')) {
        throw new Error('Permission Denied: No serial port selected.');
      }
      throw error;
    }
  },

  /**
   * Connects to the selected ESP32/ESP32-P4 device, synchronizes, and detects the chip family.
   */
  async connectDevice(baudRate = 921600, onDisconnect: (() => void) | null = null): Promise<ConnectedDeviceInfo> {
    if (!port) {
      throw new Error('No serial port selected. Please select a port first.');
    }

    try {
      logger.log('Initializing Web Serial transport layer...');
      transport = new Transport(port, false);

      deviceLostCallback = () => {
        logger.error('Serial Port Lost: Connection to the device was unplugged or interrupted.');
        if (onDisconnect) {
          onDisconnect();
        }
      };
      transport.setDeviceLostCallback(deviceLostCallback);

      logger.log(`Connecting and syncing bootloader (baud rate: ${baudRate})...`);

      const termAdapter = logger.getTerminalAdapter();
      esploader = new ESPLoader({
        transport,
        baudrate: baudRate,
        terminal: termAdapter,
      });

      // Synchronize stub loader with board
      try {
        await esploader.main('default_reset');
      } catch (firstErr: any) {
        logger.warn(`Initial reset sync notice: ${firstErr.message}. Attempting ESP32-S3 CDC auto-reset...`);

        // Retry with ESP32-S3 CDC 1200-baud touch auto-reset sequence
        try {
          if (transport) {
            await transport.setBaudrate(1200);
            await transport.setRTS(true);
            await transport.setDTR(false);
            await new Promise((r) => setTimeout(r, 150));
            await transport.setRTS(false);
            await transport.setDTR(false);
            await new Promise((r) => setTimeout(r, 100));
            await transport.setBaudrate(baudRate);
          }
        } catch (_: any) {}

        // Second sync attempt
        esploader = new ESPLoader({
          transport,
          baudrate: baudRate,
          terminal: termAdapter,
        });
        await esploader.main('default_reset');
      }

      const chipName = esploader.chip ? esploader.chip.CHIP_NAME : 'ESP32 (Generic)';
      let chipDesc = chipName;
      let macAddr = '—';

      try {
        if (esploader.chip) {
          if (esploader.chip.getChipDescription) {
            chipDesc = await esploader.chip.getChipDescription(esploader);
          }
          if (esploader.chip.readMac) {
            macAddr = await esploader.chip.readMac(esploader);
          }
        }
      } catch (err: any) {
        logger.warn(`Could not read chip MAC / features: ${err.message}`);
      }

      logger.log(`Connected to target: ${chipDesc} (MAC: ${macAddr})`);

      return {
        chipName,
        chipDescription: chipDesc,
        macAddress: macAddr,
        esploader,
      };
    } catch (error: any) {
      logger.error(`Failed to connect to microcontroller: ${error.message}`);
      await this.disconnectDevice().catch(() => {});
      throw error;
    }
  },

  /**
   * Closes the active serial connections and resets state.
   */
  async disconnectDevice(): Promise<void> {
    logger.log('Closing serial port...');

    if (transport) {
      try {
        transport.setDeviceLostCallback(null);
        await transport.disconnect();
      } catch (error: any) {
        logger.warn(`Error during port disconnect: ${error.message}`);
      }
      transport = null;
    }

    esploader = null;
    port = null;
    deviceLostCallback = null;
    logger.log('Serial port disconnected.');
  },

  /**
   * Checks if a device is currently connected.
   */
  isConnected(): boolean {
    return esploader !== null;
  },

  /**
   * Returns the active ESPLoader instance.
   */
  getLoader(): any {
    return esploader;
  },

  /**
   * Returns the transport instance for direct serial reading/writing.
   */
  getTransport(): any {
    return transport;
  },
};
