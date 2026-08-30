# Scanner In-Place Barcode Overlay & Compact Mobile Generator Spec

## 1. Scanner In-Place Barcode Overlay
- **Flow:** When a number is detected in `PelicanScanner.tsx` (via auto-scan or manual capture):
  - The scanner stays on the **Scan** tab.
  - An in-place high-contrast **Barcode Card Overlay** appears directly on top of the camera.
  - Displays:
    - Large high-contrast scannable barcode (Code 128 format by default).
    - The detected 14-digit Pelican number.
    - PNG & SVG download buttons.
    - **"Scan Next" / "Close"** button to dismiss the overlay and resume scanning immediately.
  - History is saved automatically.

## 2. Separate & Mobile-Optimized Manual Generator
- **Layout:**
  - Compact header and format selector (dropdown / horizontal scrollable pill bar).
  - Clean input with Voice Typing mic button and clear button.
  - Generated barcode card fits smoothly in the mobile viewport without pushing or overlapping the bottom tab navigation.
  - Removes duplicate number caption underneath card.
