# K10 Hub — Android Native Companion App

An Android application that wraps the K10 Hub web platform and exposes a high-speed **USB Host OTG Serial Bridge**, enabling **1-Click firmware flashing of UNIHIKER K10 (ESP32-S3 / ESP32-P4)** directly from Android mobile phones.

---

## 🎯 Why This Exists

1. **Browser Limitation**: Google Chrome on mobile disables the Web Serial API by default (`navigator.serial` is hidden behind experimental flags), while other mobile browsers (Firefox, Samsung Internet, and default WebViews) do not support Web Serial at all.
2. **Native Solution**: This app streams the identical K10-Hub web interface inside a native Android `WebView`, while delegating raw USB-OTG communication (baud rate control, DTR/RTS pin resets, and binary streaming) to the native Android core via [`usb-serial-for-android`](https://github.com/mik3y/usb-serial-for-android).

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────┐
│                   K10 Hub Android App                  │
│                                                        │
│   ┌────────────────────────────────────────────────┐   │
│   │               Android WebView                  │   │
│   │   (Runs React, Vite, esptool-js, UI, Terminal) │   │
│   └──────────────────────┬─────────────────────────┘   │
│                          │                             │
│       JavaScript Bridge (@JavascriptInterface)         │
│         (openPort, writeData, setSignals, etc.)        │
│                          │                             │
│   ┌──────────────────────▼─────────────────────────┐   │
│   │         AndroidSerialBridge.kt                 │   │
│   │        (Native USB Host Driver Layer)          │   │
│   └──────────────────────┬─────────────────────────┘   │
└──────────────────────────┼─────────────────────────────┘
                           │ USB-OTG
                           ▼
          ┌──────────────────────────────────┐
          │      UNIHIKER K10 Board          │
          │ (CH340 / CP210x / ESP32-S3 CDC)  │
          └──────────────────────────────────┘
```

- **Zero Duplication**: Flashing protocols, MD5 checksum verification, logs, and progress indicators are handled by the web app's `esptool-js`.
- **Hardware Control**: Android native code handles USB permission prompts, hardware reset lines (`DTR`/`RTS` for bootloader synchronization), and high-throughput bidirectional byte streaming.

---

## 📋 Prerequisites

- **Android Studio** (Hedgehog 2023.1.1 or newer recommended)
- **JDK 17**
- **Android Phone** with USB-OTG support (Android 7.0 / SDK 24 minimum, target SDK 34)
- **USB-C to USB-C cable** (or USB-A to USB-C with USB-OTG adapter)

---

## 🚀 Getting Started

### 1. Open Project in Android Studio
1. Launch Android Studio.
2. Select **Open** and choose the `android` folder located in this repository:
   ```
   k10-hub/android
   ```
3. Let Gradle sync project dependencies.

### 2. Configure the Hub URL
In [`MainActivity.kt`](file:///c:/Users/MAKERBRAINS/Downloads/k10-hub/android/app/src/main/java/com/k10hub/app/MainActivity.kt):
- **Live Production URL (Default)**:
  ```kotlin
  private var hubUrl = "https://k10hub.vercel.app/"
  ```
- **Local Development (Android Emulator)**:
  ```kotlin
  private var hubUrl = "http://10.0.2.2:5173"
  ```
- **Local Development (Physical Phone on same Wi-Fi)**:
  ```kotlin
  private var hubUrl = "http://192.168.1.X:5173" // Replace with your computer's LAN IP
  ```

### 3. Build & Run
- Connect your phone via USB debugging (or start an Android Emulator).
- Click the green **Run** button (or press `Shift + F10`).
- To generate a standalone debug APK from terminal:
  ```bash
  cd android
  ./gradlew assembleDebug
  ```
  The APK will be generated at `app/build/outputs/apk/debug/app-debug.apk`.

---

## 🔌 How to Flash Firmware from Mobile

1. Plug the **UNIHIKER K10** board into your Android phone using a USB-C to USB-C cable or OTG adapter.
2. On certain phone brands (OnePlus, Oppo, Vivo, Realme), ensure **OTG Connection** is turned ON in **Android Settings > Additional Settings > OTG**.
3. Open the **K10 Hub** Android app.
4. Navigate to any project (e.g., *Sensors Demo*, *AI Vision*, *Weather Station*).
5. Scroll down to the **1-Click Web Flasher** panel:
   - Notice the purple badge: **Android Native USB-OTG Active**.
6. Tap **Flash Firmware**.
7. Android will display a system dialog:
   > *"Allow K10 Hub to access this USB device?"*
8. Tap **Allow** (or check *Always allow*).
9. The phone directly flashes the firmware to the K10 board, verifies MD5 checksums, and reboots the board!

---

## 🛠️ Key Files

- [AndroidSerialBridge.kt](file:///c:/Users/MAKERBRAINS/Downloads/k10-hub/android/app/src/main/java/com/k10hub/app/AndroidSerialBridge.kt): Native USB Host serial driver and `@JavascriptInterface` bridge.
- [MainActivity.kt](file:///c:/Users/MAKERBRAINS/Downloads/k10-hub/android/app/src/main/java/com/k10hub/app/MainActivity.kt): Manages WebView, pull-to-refresh, USB attach/detach lifecycle, and permission requests.
- [device_filter.xml](file:///c:/Users/MAKERBRAINS/Downloads/k10-hub/android/app/src/main/res/xml/device_filter.xml): USB Vendor ID filters for UNIHIKER K10 onboard chips (CH340, CP210x, ESP32 CDC).
- [androidSerialBridge.ts](file:///c:/Users/MAKERBRAINS/Downloads/k10-hub/frontend/src/services/flasher/androidSerialBridge.ts): Frontend Web Serial API polyfill routing commands through the native Android bridge.
- [serialService.ts](file:///c:/Users/MAKERBRAINS/Downloads/k10-hub/frontend/src/services/flasher/serialService.ts): Web flasher service handling port discovery for both Desktop and Mobile.
- [WebFlasherPanel.tsx](file:///c:/Users/MAKERBRAINS/Downloads/k10-hub/frontend/src/components/projects/WebFlasherPanel.tsx): React UI displaying the mobile OTG flashing status badge.
