// serialService.ts
// Handles Web Serial connection, port requests, device lifecycle, and chip family detection.

// @ts-ignore
import { ESPLoader, Transport } from 'esptool-js/bundle.js';
import { logger } from './loggerService';

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
   * Checks if the Web Serial API is available in the current browser.
   */
  checkBrowserSupport(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  },

  /**
   * Requests a serial port from the browser.
   * Must be triggered directly by a user gesture.
   */
  async requestPort(): Promise<any> {
    if (!this.checkBrowserSupport()) {
      throw new Error(
        "Your browser doesn't support Web Serial. Please use Google Chrome, Microsoft Edge, or another Chromium-based browser."
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
      await esploader.main('default_reset');

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
