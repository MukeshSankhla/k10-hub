# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in getDefaultProguardFile(...)

# Keep JavascriptInterface annotations
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep usb-serial-for-android driver classes
-keep class com.hoho.android.usbserial.** { *; }
