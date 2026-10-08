# Keep all JavascriptInterface annotations and bridged methods
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep K10 Hub native bridge class and all its public methods
-keep class com.k10hub.app.AndroidSerialBridge {
    public *;
}
-keepclassmembers class com.k10hub.app.AndroidSerialBridge {
    public *;
}

# Keep usb-serial-for-android driver classes and probes
-keep class com.hoho.android.usbserial.** { *; }
-dontwarn com.hoho.android.usbserial.**
