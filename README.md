# Anasan Barcode — Production Mobile Scanner & Utility Platform

A high-performance, two-surface barcode generation and computer-vision numeric recognition platform.

- **Mobile App**: Camera-first, real-time, 100% offline numeric scanner engineered for walking warehouse/store operators scanning electronic device screens (glare, motion blur, LCD pixel moiré, low light).
- **Web App**: Manual barcode generator, product catalog lookup (4,700+ items), weekly leaderboards, manager & admin dashboards, and desktop utility workflows.

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
│   │   └── *.test.ts               # Complete unit test suite
│   ├── pelican.ts                  # Domain GTIN checksum & normalization rules
│   ├── productDb.ts                # Offline searchable product catalog
│   └── i18n.tsx                    # English & Arabic bilingual support
├── components/
│   ├── PelicanScanner.tsx          # Real-time camera viewfinder HUD & barcode presentation
│   ├── BarcodeGenerator.tsx        # Manual generator with preview and export
│   ├── BarcodePreview.tsx          # High-contrast scannable barcode renderer
│   ├── LookupPanel.tsx             # 4,700+ item product lookup interface
│   └── LeaderboardModal.tsx        # Store & performer ranking modal
└── pages/
    ├── Home.tsx                    # Two-surface orchestrator (Mobile Camera vs Web Workbench)
    ├── AdminPage.tsx               # Store manager & owner dashboard
    └── StarGalleryPage.tsx         # Performance recognition gallery
```

---

## ⏱️ Latency Budget & Performance

| Pipeline Stage | Target | Typical Measured |
| :--- | :---: | :---: |
| **ROI Capture & Resampling** | < 20 ms | 4–8 ms |
| **Frame Quality & Sharpness Filter** | < 5 ms | 1–2 ms |
| **Adaptive Screen Preprocessing** | < 25 ms | 3–8 ms |
| **Numeric OCR (WASM SIMD LSTM)** | < 150 ms | 60–120 ms |
| **Temporal Consensus & Checksum** | < 2 ms | < 1 ms |
| **Instant Barcode Generation** | < 5 ms | < 2 ms |
| **Total End-to-End Latency** | **< 1000 ms** | **120–400 ms** |

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

The mobile client is built on Capacitor 8.5 with native camera permissions and hardware acceleration.

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

---

## 🌐 Web Deployment (Vercel)

The web client and serverless API endpoints deploy directly to Vercel:
```bash
vercel --prod
```
The ServiceWorker (`sw.js`) automatically precaches the application shell, WebAssembly SIMD binaries, and Tesseract trained data for instant offline loading.
