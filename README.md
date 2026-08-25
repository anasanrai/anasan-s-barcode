# Number to Barcode

**Number to Barcode** is a mobile-first, local-first web application that recognizes one numeric identifier and immediately renders a scanner-ready **Code 128** barcode. It is designed for order screens, printed labels, reflected displays, imported photos, and handwritten return notes.

> All barcode detection, OCR, image preprocessing, and barcode generation run in the browser. The application does not send captured camera frames or imported images to an OCR service.

## What it does

| Workflow                   | Behavior                                                                                                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Live physical barcode      | Decodes compatible linear barcodes locally before OCR. QR codes and non-numeric payloads are not accepted as order numbers. |
| Live numeric-only screen   | Uses a focused center-line OCR pass for a quick result, then falls back to the broader local OCR path only when necessary.  |
| Reflected or angled screen | Applies local screen normalization and allows an explicit **Capture** action to prioritize the current frame.               |
| Photo import               | Reads a captured or selected image locally; complete photo values require agreement across two local reads.                 |
| Handwritten return number  | Supports four-digit photo candidates after strict local confirmation. It never combines several visible values.             |
| Manual entry               | Accepts exact digits only. Spaces, punctuation, and letters are rejected rather than altered.                               |
| Barcode result             | Generates Code 128 by default, with copy and PNG-save actions.                                                              |

## Safety rules

The scanner deliberately favors correctness over guessing. It accepts only complete digit-only candidates that pass configured length and format validation. It rejects letters, separators, symbols, non-numeric machine codes, date/time-like content, partial OCR values, and scenes where more than one comparable target number is visible. The result is encoded exactly as accepted; no digits are silently inserted, removed, reordered, or normalized.

## Stack

- **React 19**, TypeScript, Vite, and Tailwind CSS 4
- **Tesseract.js** for browser-local OCR
- Browser `TextDetector` when available for a fast native recognition path
- Browser `BarcodeDetector` and ZXing for local linear-barcode detection
- **JsBarcode** for Code 128 SVG rendering and high-resolution PNG export
- A service worker and web app manifest for installable PWA behavior

## Run locally

### Prerequisites

- Node.js 22 or newer
- pnpm 10 or newer

### Installation

```bash
pnpm install
pnpm dev
```

Open the Vite URL shown in the terminal. Use HTTPS on a physical phone for live camera access; browsers do not permit camera use from an insecure context.

## Validation commands

```bash
# Automated unit tests
pnpm exec vitest run

# TypeScript validation
pnpm check

# Production build
pnpm build

# Service-worker syntax check
node --check client/public/sw.js

# Formatting check
pnpm exec prettier --check .
```

## Project structure

```text
client/
  index.html                    # App document and versioned manifest link
  public/
    manifest.webmanifest        # Installable app metadata
    sw.js                       # Offline shell and update lifecycle
  src/
    components/
      CameraStage.tsx           # Camera, photo, OCR, and user-feedback flow
      BarcodePreview.tsx        # Rendered barcode presentation
      InstallAppControl.tsx     # PWA install prompt and instructions
    pages/
      Home.tsx                  # Scanner and barcode result states
    services/
      camera.ts                 # Camera framing, local preprocessing, quality gates
      ocr.ts                    # Local OCR worker and screen fast path
      ocrPipeline.ts            # Strict candidate selection and confirmation rules
      barcodeGuard.ts           # Local linear-barcode detection
      barcode.ts                # Barcode rendering and PNG export
      number.ts                 # Exact numeric validation and format rules
server/
  index.ts                      # Static production server with update-critical headers
```

## Mobile use

1. Open the app in Chrome or Safari over HTTPS and allow camera access.
2. Center one order number inside the reticle. The scanner automatically reads a clear numeric line.
3. If a reflection, angle, or focus delay prevents automatic capture, press the round **Capture** button to prioritize the current frame.
4. Use **Photo** to take or choose a still image when the live camera is unavailable.
5. Review the generated Code 128 barcode, then copy the exact value or save a PNG label.

For an installed PWA update, close all open copies of the app and reopen it after the latest service worker has been delivered. If a mobile launcher icon remains outdated, remove the old shortcut and install again.

## Current constraints

The application can safely refuse a scene rather than guessing. For best results, position only the intended number inside the reticle, keep the phone still, and use manual capture for glare or a reflection. End-to-end optical testing must be completed on a physical camera device; a sandboxed desktop preview has no physical phone camera stream.

## License

This repository is licensed under the terms declared in `package.json`.
