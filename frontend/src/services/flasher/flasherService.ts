// flasherService.ts
// Orchestrates writing binary files to ESP32/ESP32-P4 flash memory and resetting the device.

import { logger } from './loggerService';

export const flasherService = {
  /**
   * Writes a binary file buffer to a specific flash memory address.
   */
  async flashFile(
    esploader: any,
    data: Uint8Array,
    address: string | number,
    onProgress?: (writtenBytes: number, totalBytes: number) => void,
    onVerify?: () => void
  ): Promise<void> {
    const addrVal = typeof address === 'string' ? parseInt(address, 16) : address;

    if (isNaN(addrVal)) {
      throw new Error(`Invalid flash address: ${address}. Must be a valid hex address (e.g. 0x00).`);
    }

    logger.log(`Preparing flash memory write at address ${address}...`);

    let isVerifyingTriggered = false;

    const triggerVerifyOnce = () => {
      if (!isVerifyingTriggered) {
        isVerifyingTriggered = true;
        if (onVerify) {
          onVerify();
        }
      }
    };

    // Monitor esptool internal logs for completion and verification keywords
    const unsubscribeLogger = logger.subscribe((entry) => {
      if (entry && entry.message) {
        const msg = String(entry.message);
        if (
          msg.includes('(100%)') ||
          msg.includes('Verifying') ||
          msg.includes('Hash of') ||
          msg.includes('Leaving...') ||
          msg.includes('MD5')
        ) {
          setTimeout(triggerVerifyOnce, 0);
        }
      }
    });

    const options = {
      fileArray: [
        {
          data,
          address: addrVal,
        },
      ],
      flashMode: 'keep',
      flashSize: 'keep',
      flashFreq: 'keep',
      eraseAll: false,
      compress: true,
      reportProgress: (_fileIndex: number, written: number, total: number) => {
        if (!isVerifyingTriggered && onProgress) {
          onProgress(written, total);
        }
        if (total > 0 && written >= total) {
          setTimeout(triggerVerifyOnce, 0);
        }
      },
    };

    try {
      await esploader.writeFlash(options);
      triggerVerifyOnce();
      logger.log(`Success: Flashed and verified memory at ${address}.`);
    } catch (error: any) {
      logger.error(`Flashing failed at address ${address}: ${error.message}`);
      if (error.message.includes('MD5') || error.message.includes('checksum') || error.message.includes('hash')) {
        throw new Error(
          `Checksum Error: Flash verification failed for address ${address}. Data may have been corrupted in transit.`
        );
      }
      throw error;
    } finally {
      unsubscribeLogger();
    }
  },

  /**
   * Resets the ESP32/ESP32-P4 chip to run the newly flashed firmware.
   */
  async resetDevice(esploader: any): Promise<void> {
    if (!esploader) return;

    try {
      logger.log('Executing hard reset to boot newly flashed firmware...');
      const transport = esploader.transport;
      if (transport) {
        // Assert EN low (reset state)
        await transport.setRTS(true);
        await transport.setDTR(false);
        await new Promise((r) => setTimeout(r, 200));

        // Assert EN high (boot state)
        await transport.setRTS(false);
        await new Promise((r) => setTimeout(r, 100));
        logger.log('Reset pins toggled. Firmware booting.');
      } else {
        await esploader.after('hard_reset');
      }
    } catch (error: any) {
      logger.warn(`Hardware pin toggle notice: ${error.message}`);
      try {
        await esploader.after('hard_reset');
      } catch (fallbackErr: any) {
        logger.warn(`Fallback reset notice: ${fallbackErr.message}`);
      }
    }
  },
};
