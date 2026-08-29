# Pelican Barcode — Android App

Very simple app that converts a barcode number visible on a Pelican screen into a scannable **Code 128** barcode.

## Flow
```
Open app → Camera opens immediately → Point at "Barcodes:" number → OCR detects 06281016003788 → Same value 2 frames → Full-screen Code128
```

No login, no database, no menus.

## Tech
- **OCR:** Google ML Kit Text Recognition (on-device, no server) — `com.google.mlkit:text-recognition`
- **Camera:** CameraX
- **Barcode generation:** ZXing `core` — `MultiFormatWriter.encode(..., CODE_128)` — value kept as **String** to preserve leading `0`.

## Build
```bash
cd android
./gradlew assembleDebug   # or assembleRelease
adb install app/build/outputs/apk/debug/app-debug.apk
```

## Behavior
- Only numeric strings; prefers exact **14 digits** near `Barcodes:` label; ignores SKU / Arabic / price.
- Requires same value in **2 consecutive frames** before showing barcode (prevents flicker).
- If OCR cannot read, camera stays open — no repeated errors.
- Torch button appears only if device has flash.
- Result screen: very large barcode + small number + **Back / Scan Again**.

Input on Pelican:
```
Barcodes:
06281016003788
```
Output: Code 128 encoding `06281016003788` exactly (leading zero preserved, no extra text).
