# Anasan Barcode — Fast Camera-to-Barcode Utility

A high-performance, privacy-first camera-to-barcode scanner and generator.

- **Mobile App**: Camera-first, real-time, 100% offline numeric scanner engineered for scanning electronic device screens (glare, motion blur, LCD pixel moiré, low light).
- **Web App**: Fast manual barcode and QR code generator, live camera scanner, and responsive utility workbench.

---

## 🚀 Key Features

- **⚡ Real-Time On-Device Recognition (<500ms latency)**: Point camera at any screen displaying numbers (e.g. `06281016003788`) — instantly confirms the number and generates a full-screen scannable barcode.
- **📴 100% Offline & Private**: Zero server OCR dependencies, zero cloud API calls, and zero external telemetry. All frame preprocessing, neural OCR (WASM SIMD), and checksum validations run entirely in memory on-device.
- **🎯 Electronic Screen Optimization**: Multi-pass adaptive image preprocessing pipeline designed specifically for electronic displays:
  - *Pass 1 (Fast Contrast)*: Integer luma conversion + 5th–95th percentile contrast stretching with S-curve LUT.
  - *Pass 2 (Glare Mitigation)*: Integral-image local background gradient division to eliminate screen glare and reflection hotspots.
  - *Pass 3 (Adaptive Binarization)*: Sauvola/Bradley-inspired thresholding for unevenly backlit screens.
  - *Pass 4 (Dark Mode Inversion)*: Automatic polarity inversion for light digits displayed on dark UI backgrounds.
  - *Pass 5 (Sharpening)*: 3x3 unsharp masking convolution kernel for distant or blurry device screens.
- **🔍 Sharpness-Aware Frame Selection**: Discrete Laplacian variance estimation gates frames before OCR to prevent CPU/battery drain on out-of-focus motion frames.
- **🔄 Temporal Consensus Engine**: Rolling sliding-window candidate buffer with Levenshtein distance clustering and GTIN check-digit weighting. Recovers seamlessly from single-frame motion blur or walking jitter.
- **📊 Real-Time Diagnostic Telemetry**: Toggleable on-screen HUD displaying live FPS, frame processing time, OCR latency, sharpness score, luma, and active preprocessing pass.
- **🏷️ Multi-Format Generator**: Generates Code 128, EAN-13, EAN-8, UPC-A, Code 39, ITF-14, and QR codes instantly with download and copy options.

---

## 🏗️ Architecture Overview

```
client/src/
├── lib/
│   ├── scanner/
│   │   ├── types.ts                # Scanner state machine, telemetry & quality types
│   │   ├── frameQuality.ts         # Fast Laplacian variance & exposure metrics (<2ms)
│   │   ├── preprocessing.ts        # Screen reflection, glare & contrast passes (<5ms)
│   │   ├── numericOcr.ts           # Tesseract WASM (whitelist: 0-9, PSM 7) & BarcodeDetector
│   │   ├── temporalConsensus.ts    # Multi-frame consensus, Levenshtein clustering & checksum lock
│   │   ├── barcodeEngine.ts        # Synchronous in-memory ITF-14, Code128, EAN, UPC, QR encoder
│   │   └── *.test.ts               # Unit test suite
│   ├── pelican.ts                  # Domain GTIN checksum & normalization rules
│   ├── useNumberHistory.ts         # On-device recent scan & generation history
│   └── i18n.tsx                    # English & Arabic bilingual support
├── components/
│   ├── PelicanScanner.tsx          # Real-time camera viewfinder HUD & barcode presentation
│   ├── BarcodeGenerator.tsx        # Generator with preview, QR mode, and export
│   ├── BarcodePreview.tsx          # High-contrast scannable barcode renderer
│   ├── QRCodePreview.tsx           # Vector QR code renderer
│   └── Header.tsx                  # App bar with theme, language, and install options
└── pages/
    ├── Home.tsx                    # Two-surface orchestrator (Mobile Camera vs Web Workbench)
    └── AboutPage.tsx               # About & developer information
```

---

## 🛠️ Local Development & Commands

### Prerequisites
- Node.js 20+
- pnpm / npm

### Install Dependencies
```bash
pnpm install
```

### Run Tests
```bash
npm test
```

### Type Check
```bash
npm run check
```

### Start Local Development Server
```bash
npm run dev
```

### Production Web Build
```bash
npm run build
```

---

## 📱 Mobile Build Setup (Android & iOS)

The mobile client is built on Capacitor with native camera permissions and hardware acceleration.

### Sync Web Assets to Native Platforms
```bash
pnpm cap sync
```

### Android Build
```bash
# Sync and assemble debug APK
pnpm run build:android
# Or open in Android Studio:
pnpm run cap:open:android
```

### iOS Build
```bash
# Sync and open in Xcode:
pnpm run cap:open:ios
```
