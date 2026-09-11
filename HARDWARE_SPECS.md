# UNIHIKER K10 — Complete Hardware & Engineering Specification

> Comprehensive module-by-module architectural reference, pinouts, register addresses, and peripheral bus routing for the UNIHIKER K10 platform.

---

## Architecture Overview

The **UNIHIKER K10** is an all-in-one AI & IoT development board powered by the **Espressif ESP32-S3-WROOM-1 N16R8** system-on-module. It integrates a 2.8" color LCD, 2MP DVP camera, dual MEMS microphones with dedicated audio ADC, class-D audio amplifier with speaker, environmental sensors, addressable RGB LEDs, and a micro:bit-compatible edge connector.

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                           UNIHIKER K10 HARDWARE BUS ARCHITECTURE               │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│   ┌────────────────────────────────────────────────────────────────────────┐   │
│   │               ESP32-S3-WROOM-1 N16R8 (Dual-Core LX7 @ 240 MHz)         │   │
│   │                 16 MB Flash · 8 MB PSRAM · Wi-Fi + BLE 5               │   │
│   └──────┬──────────────┬──────────────┬───────────────┬──────────────┬────┘   │
│          │ DVP Bus      │ SPI Bus      │ I²S Bus       │ I²C Bus      │ USB    │
│          ▼              ▼              ▼               ▼              ▼        │
│    ┌───────────┐  ┌───────────┐  ┌───────────┐   ┌───────────┐  ┌───────────┐  │
│    │  GC2145   │  │  ILI9341  │  │  ES7243E  │   │  AHT20    │  │   USB-C   │  │
│    │  2MP DVP  │  │  2.8" LCD │  │ Audio ADC │   │ Temp/Hum  │  │Native USB │  │
│    │  Camera   │  │  Display  │  │ 2×Mic In  │   │  (0x38)   │  │  + Power  │  │
│    └───────────┘  └─────┬─────┘  └─────┬─────┘   └─────┬─────┘  └───────────┘  │
│                         │              │               │                       │
│                   ┌─────┴─────┐  ┌─────┴─────┐   ┌─────┴─────┐                 │
│                   │GT30L24A3W │  │  NS4168   │   │LTR-303ALS │                 │
│                   │ Font Chip │  │ 2W Speaker│   │Light(0x29)│                 │
│                   └─────┬─────┘  │ Amplifier │   └─────┬─────┘                 │
│                         │        └───────────┘         │                       │
│                   ┌─────┴─────┐                  ┌─────┴─────┐                 │
│                   │ TF/MicroSD│                  │  SC7A20H  │                 │
│                   │ Card Slot │                  │Accel(0x19)│                 │
│                   └───────────┘                  └─────┬─────┘                 │
│                                                        │                       │
│                                                  ┌─────┴─────┐                 │
│                                                  │XL9535QF24 │                 │
│                                                  │16-bit GPIO│                 │
│                                                  │Exp. (0x20)│                 │
│                                                  └─────┬─────┘                 │
│                                                        │                       │
│                     ┌──────────────────────────────────┴─────────────────┐     │
│                     │ Backlight · Camera RST · Button A/B · User LEDs   │     │
│                     └────────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Main MCU / Processing Module

| Parameter | Specification |
|:---|:---|
| **Module** | **ESP32-S3-WROOM-1 N16R8** |
| **MCU Core** | ESP32-S3 (Xtensa® Dual-Core 32-bit LX7) |
| **Clock Frequency** | Adjustable up to **240 MHz** |
| **Internal SRAM** | 512 KB |
| **Internal ROM** | 384 KB |
| **Flash Memory** | **16 MB** Quad SPI (N16) |
| **PSRAM** | **8 MB** Octal SPI (R8) |
| **RTC SRAM** | 16 KB (low-power deep sleep retention) |
| **Operating Logic Level** | 3.3 V |
| **Vector Instructions** | Supported (optimized for Edge AI neural network inference) |

The ESP32-S3-WROOM-1 serves as the central brain. It directly connects to the parallel camera interface (DVP), display (SPI), native USB, digital audio (I²S), sensor bus (I²C), and expansion connectors.

---

## 2. Wireless Connectivity Module

Wireless communication is natively integrated inside the ESP32-S3-WROOM-1:

### Wi-Fi
- **Standard**: IEEE 802.11 b/g/n
- **Frequency**: 2.4 GHz band (channels 1–13/14)
- **Channel Bandwidth**: 20 MHz and 40 MHz
- **Operating Modes**:
  - Station (STA)
  - SoftAP (Hotspot)
  - Station + SoftAP concurrent mode
- **Security**: WPA/WPA2/WPA3 Personal, WPS

### Bluetooth
- **Standard**: Bluetooth 5.0 (LE / Bluetooth Low Energy)
- **Networking**: Bluetooth Mesh support
- **Max PHY Rate**: 2 Mbps high-speed throughput, coded PHY for long range
- **Advertising**: Extended advertising packet support

---

## 3. 2.8" LCD Display Module

| Parameter | Specification |
|:---|:---|
| **Controller IC** | **ILI9341** |
| **Screen Size** | 2.8 inches (diagonal) |
| **Resolution** | **240 × 320** pixels |
| **Color Depth** | 16-bit RGB565 / 65K colors |
| **Display Type** | Transflective Color TFT LCD (non-touch) |
| **Interface** | High-Speed SPI (up to 40–80 MHz) |
| **Logic Level** | 3.3 V |

### Signal Routing
- `LCD_SCLK` — SPI Clock
- `LCD_MOSI` — SPI Master Out Slave In
- `LCD_MISO` — SPI Master In Slave Out
- `LCD_CS` — Display Chip Select
- `LCD_DC` — Data / Command selection
- `LCD_RST` — Hardware Reset
- `LCD_BLK` — Backlight Control via **MMBT3904T** NPN transistor (PWM dimming capable via I/O expander)

---

## 4. Camera Module

| Parameter | Specification |
|:---|:---|
| **Sensor IC** | **GalaxyCore GC2145** |
| **Sensor Resolution** | **2 Megapixels** (1600 × 1200 UXGA) |
| **Optical Field of View (FOV)**| ~80° |
| **Interface** | **DVP (Digital Video Port)** 8-bit parallel bus |
| **Target Applications** | Edge AI vision, face detection, QR/barcode scanning, color recognition |

### Parallel DVP Signals (connected to ESP32-S3)
- Data bus: `Camera_D2`, `Camera_D3`, `Camera_D4`, `Camera_D5`, `Camera_D6`, `Camera_D7`, `Camera_D8`, `Camera_D9`
- Synchronization & Clock: `Camera_PCLK` (Pixel Clock), `Camera_HREF` (Horizontal Reference), `Camera_VSYNC` (Vertical Sync), `Camera_XCLK` (Master System Clock)
- Control: `Camera_RST` (controlled via XL9535 expander)

---

## 5. Temperature & Humidity Sensor

| Parameter | Specification |
|:---|:---|
| **Sensor IC** | **AHT20** (Aosong) |
| **Interface** | I²C Bus (shared with onboard sensors) |
| **I²C 7-bit Address** | **`0x38`** |
| **Temperature Range** | -40 °C to +85 °C |
| **Temperature Accuracy** | ±0.3 °C |
| **Humidity Range** | 0 % to 100 % RH |
| **Humidity Accuracy** | ±2 % RH (at 25 °C, 20–80% RH) |
| **Bus Pins** | `P19 / SCL`, `P20 / SDA` |

---

## 6. Ambient Light Sensor

| Parameter | Specification |
|:---|:---|
| **Sensor IC** | **Lite-On LTR-303ALS** |
| **Interface** | I²C Bus |
| **I²C 7-bit Address** | **`0x29`** |
| **Dynamic Range** | 0.01 Lux to **64,000 Lux** |
| **Channels** | Dual photodiode array (Visible + Infrared / Human eye photopic response) |
| **Bus Pins** | `P19 / SCL`, `P20 / SDA` |

---

## 7. 3-Axis Accelerometer (Motion & Orientation)

| Parameter | Specification |
|:---|:---|
| **Sensor IC** | **Silan SC7A20H** (ultra-low-power 3-axis MEMS accelerometer) |
| **Interface** | I²C Bus |
| **I²C 7-bit Address** | **`0x19`** |
| **Full Scales** | **±2g / ±4g / ±8g / ±16g** (user configurable) |
| **Data Output Rate** | 1 Hz to 5.3 kHz |
| **Features** | Freefall detection, tap/double-tap, 6D orientation, tilt sensing |
| **Bus Pins** | `P19 / SCL`, `P20 / SDA` |

---

## 8. I²C I/O Expansion Module

| Parameter | Specification |
|:---|:---|
| **Expander IC** | **XL9535QF24** (16-bit I²C / SMBus GPIO Expander) |
| **Interface** | I²C Bus |
| **I²C 7-bit Address** | **`0x20`** |
| **Interrupt Pin** | `BUS_INT` (active-low interrupt line to ESP32-S3) |
| **I/O Ports** | Port 0 (`P00`–`P07`), Port 1 (`P10`–`P17`) |

### Dedicated Peripheral Controls on XL9535
The expander manages control signals without consuming critical high-speed ESP32-S3 GPIO pins:
1. **LCD Backlight (`LCD_BLK`)** enable & PWM modulation
2. **Camera Reset (`Camera_RST`)**
3. **User Button A (`KeyA`)** state sensing
4. **User Button B (`KeyB`)** state sensing
5. **User LED** status indicator
6. **Auxiliary board lines & power gating**

---

## 9. MEMS Microphone Module (Audio Capture)

| Parameter | Specification |
|:---|:---|
| **Microphone Units** | **2 × High-SNR MEMS Microphones** (beamforming / noise cancellation layout) |
| **Audio ADC** | **Everest Semiconductor ES7243E** (high-performance 24-bit audio ADC) |
| **Interface** | **I²S (Inter-IC Sound)** bus to ESP32-S3 |
| **Capabilities** | Far-field voice capture, offline wake-word recognition, ASR (Automatic Speech Recognition), acoustic analysis |

---

## 10. Audio Amplifier & Speaker Module

| Parameter | Specification |
|:---|:---|
| **Audio Amplifier** | **NS4168** (Class-D mono audio power amplifier) |
| **Speaker Power Rating** | **2 Watts** onboard micro-speaker |
| **Audio Interface** | Digital **I²S Audio Bus** |

### I²S Audio Bus Pins
- `I2S_MCLK` — Master Clock
- `I2S_BCLK` — Bit Clock (Serial Clock)
- `I2S_LRCK` — Left/Right Clock (Word Select)
- `I2S_SDI` — Serial Data In (Microphone ADC capture)
- `I2S_SDO` — Serial Data Out (Speaker DAC playback)

---

## 11. Addressable RGB LED Module

| Parameter | Specification |
|:---|:---|
| **LED Units** | **3 × WS2812** Smart RGB LEDs |
| **Protocol** | Single-wire NZR timing protocol (800 kHz) |
| **Color Depth** | 24-bit true color (8-bit Red, 8-bit Green, 8-bit Blue) |
| **Architecture** | Daisy-chained serial data bus |
| **Use Cases** | Status indicators, ambient mood lighting, UI state, AI feedback |

---

## 12. User & Control Buttons

| Button | Label | Connection & Function |
|:---|:---|:---|
| **Button A** | `KeyA` | Associated with **P5** and readable via XL9535 GPIO expander |
| **Button B** | `KeyB` | Associated with **P11** and readable via XL9535 GPIO expander |
| **RESET** | `RST` | Hardware hard-reset line pulling ESP32-S3 `CHIP_PU` low |
| **BOOT** | `BOOT` | Pulls `GPIO0` low on reset to enter ROM bootloader / download mode |

---

## 13. TF / MicroSD Card Storage

| Parameter | Specification |
|:---|:---|
| **Slot Type** | Self-ejecting push-push MicroSD / TF card socket |
| **Interface** | High-Speed SPI |
| **Max Capacity** | Up to 32 GB (FAT32/exFAT support in FreeRTOS/Arduino) |
| **Use Cases** | AI model weights, training datasets, captured photos/video clips, audio files, application logs |

---

## 14. Serial Font Chip (Multilingual Rendering)

| Parameter | Specification |
|:---|:---|
| **IC Part Number** | **GT30L24A3W** |
| **Type** | Serial Font-ROM memory |
| **Interface** | High-speed Serial Interface |
| **Features** | Hardware-stored dot-matrix font sets (Chinese GB2312/GB18030, Latin, ASCII, extended multilingual character sets) |
| **Benefit** | Frees flash memory from large bitmap font arrays; instant UI font rendering |

---

## 15. USB-C Interface

| Parameter | Specification |
|:---|:---|
| **Connector** | Reversible USB Type-C |
| **Power Supply** | 5.0 V DC (up to 2A supply rating) |
| **Data Connection** | Native USB OTG (`USB_DP` / `USB_DN`) routed directly to ESP32-S3 |
| **Protection** | Onboard **TVS ESD protection diode arrays** and overcurrent clamp |
| **Functionality** | High-speed firmware flashing, USB CDC Serial monitor, USB HID/JTAG emulation |

---

## 16. Battery Power Module

| Parameter | Specification |
|:---|:---|
| **Connector** | **2-pin PH2.0** polarized battery socket |
| **Rated Voltage** | **3.7 V** nominal LiPo / Li-ion |
| **Operating Input Range** | **3.0 V to 6.0 V / 6.5 V** DC |
| **Recommended Sources**| 1S 3.7V Lithium Polymer battery or 3 × 1.5V AA/AAA battery pack |

---

## 17. Power Regulation Architecture

The K10 employs a multi-rail low-noise LDO power distribution network:

| Regulator IC | Output Rail | Targeted Peripheral Domain |
|:---|:---|:---|
| **BL8555-28PRA** | **2.8 V** | Dedicated low-noise rail for camera analog circuitry & LCD logic |
| **AP7343Q-18W5-7** | **1.8 V** | Core camera sensor digital rail & sensor references |
| Primary Buck/LDO | **3.3 V** | ESP32-S3 main supply, audio, and general peripherals |
| Direct 5V / VBUS | **5.0 V** | USB power distribution & external Gravity 5V outputs |

---

## 18. GPIO Expansion & Gravity Ports

The UNIHIKER K10 exposes standard 3-pin and 4-pin DFRobot **Gravity** connectors:
- **Gravity IO1 (P0)**: Digital / Analog I/O (ADC channel, PWM, digital interrupt)
- **Gravity IO2 (P1)**: Digital / Analog I/O (ADC channel, PWM, digital interrupt)
- **Gravity I²C**: Dedicated 4-pin port (`VCC`, `GND`, `SCL/P19`, `SDA/P20`) for chainable Gravity sensors and actuators

---

## 19. Micro:bit-Compatible Edge Connector

The bottom edge connector conforms to the standard 0.1" pitch micro:bit form factor, enabling compatibility with dozens of expansion shields, robotic chassis, and breakout boards:

| Pin | Primary Function | Alternate Functions |
|:---|:---|:---|
| **P0** | Digital / Analog I/O | ADC, PWM, Touch |
| **P1** | Digital / Analog I/O | ADC, PWM, Touch |
| **P2** | Digital / Analog I/O | ADC, PWM |
| **P3** | Digital / Analog I/O | General GPIO |
| **P4** | Digital I/O | General GPIO |
| **P5** | Digital Input | Tied to **Button A (KeyA)** |
| **P6**–**P10** | Digital I/O | General expansion |
| **P11** | Digital Input | Tied to **Button B (KeyB)** |
| **P12**–**P16** | Digital I/O | General expansion (PWM capable) |
| **P19** | **I²C SCL** | Shared hardware I²C clock line |
| **P20** | **I²C SDA** | Shared hardware I²C data line |
| **3V3** | **3.3 V Power Rail** | Regulated system power output |
| **GND** | **Ground** | Common system ground reference |

---

## 20. Master Communication Bus Summary

### I²C Bus (`P19/SCL`, `P20/SDA`)
| 7-bit Address | Peripheral IC | Description |
|:---|:---|:---|
| **`0x19`** | **SC7A20H** | 3-Axis Accelerometer |
| **`0x20`** | **XL9535QF24** | 16-bit GPIO Expander (Buttons, Backlight, RST) |
| **`0x29`** | **LTR-303ALS** | Ambient Light Sensor (0–64k Lux) |
| **`0x38`** | **AHT20** | Temperature & Humidity Sensor |

### SPI Bus
- **ILI9341**: 2.8" LCD Display (High-speed display refresh)
- **GT30L24A3W**: Multilingual font ROM
- **MicroSD Card**: High-speed FAT32 file storage

### I²S Audio Bus
- **ES7243E**: Dual MEMS microphone recording ADC
- **NS4168**: 2W Class-D audio amplifier & speaker playback

### DVP Parallel Video Bus
- **GC2145**: 2MP camera sensor parallel interface (8-bit data + PCLK + HREF + VSYNC)

### USB Bus
- Native ESP32-S3 USB transceiver (`USB_P` / `USB_N`) with ESD TVS protection clamp
