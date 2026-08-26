# Number to Barcode

A local-first, privacy-preserving PWA that captures numeric order IDs from camera or photo and generates scanner-ready Code 128 barcodes. All processing happens on-device — no images or data leave your browser.

## Features

- **Camera-first scanning** — Live barcode detection (native `BarcodeDetector` → ZXing fallback → Tesseract OCR fallback)
- **Screen mode** — Optimized for reading long order numbers from phone screens
- **Photo fallback** — Capture or import images when camera access is unavailable
- **Offline capable** — Service worker caches shell and assets for offline use
- **PWA installable** — Add to home screen for instant camera access
- **Privacy by design** — Zero network calls for image processing; history stored in `localStorage`

## Tech Stack

- React 19 + TypeScript 5.6
- Vite 7 (with code splitting)
- Tailwind CSS 4
- Express 4 (static file server)
- Tesseract.js (lazy-loaded OCR)
- ZXing (barcode fallback)
- JsBarcode (rendering)

## Quick Start

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Type check
npm run check

# Lint
npm run lint

# Run tests
npm run test

# Production build
npm run build

# Start production server
npm start
```

## Docker

```bash
docker build -t number-to-barcode .
docker run -p 3000:3000 number-to-barcode
```

## Project Structure

```
├── client/
│   ├── src/
│   │   ├── components/          # UI components
│   │   ├── hooks/               # useCameraSession, useScanLoop
│   │   ├── pages/               # Home, NotFound
│   │   ├── services/            # camera, ocr, barcode, number logic
│   │   ├── contexts/            # ThemeProvider
│   │   └── lib/                 # utils (cn)
│   ├── public/                  # sw.js, manifest, icons
│   └── index.html
├── server/
│   └── index.ts                 # Hardened Express server
├── .github/workflows/ci.yml     # GitHub Actions
├── Dockerfile
├── eslint.config.js
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Architecture Decisions

- **Lazy OCR initialization** — Tesseract worker starts only when native barcode detection fails, saving ~10MB download on fast paths
- **Cache-first SW strategy** — Hashed JS/CSS assets served from cache; HTML/manifest network-first
- **Scan engine extracted** — `useScanLoop` hook owns the frame → barcode → OCR → decision pipeline; `CameraStage` is purely presentational
- **Theme-aware exports** — Barcode colors read from CSS custom properties (`--barcode-line`, `--barcode-bg`)
- **Security headers** — CSP, HSTS, X-Content-Type-Options, Permissions-Policy on all responses

## License

MIT
