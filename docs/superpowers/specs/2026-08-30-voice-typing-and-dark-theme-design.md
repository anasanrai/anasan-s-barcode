# Voice Typing (Audio-to-Barcode) & Obsidian-Amber Dark Theme Specification

## 1. Overview
This specification adds ultra-fast voice typing for numbers and alphanumeric codes to HungerStation Barcode generator, and updates the Dark Mode color tokens to match the Saztech obsidian-black and warm amber-orange branding.

## 2. Voice Typing (Audio-to-Barcode)
- **Component:** `NumberInput.tsx`
- **Trigger:** Microphone icon button embedded inside the `NumberInput` row.
- **Engine:** Web Speech API (`webkitSpeechRecognition` / `SpeechRecognition`) with fallback.
- **Speed & Latency:** ~0 ms live streaming as user speaks.
- **Parsing & Normalization:**
  - Converts spoken number words ("zero", "one", "double two", "three", "ar: صفر، واحد، اثنان") to digits.
  - Normalizes format: uppercase letters and clean numeric digits according to active format (`CODE128`, `EAN-13`, etc.).
  - Continuous live transcription with visual pulsing indicator while active.
  - Auto-submits / auto-updates generator value live.

## 3. Dark Theme Branding (Saztech Obsidian & Amber Orange)
- **Palette:**
  - `--color-bg`: `#0D0E12` (Obsidian deep black)
  - `--color-surface`: `#16171F` (Charcoal carbon)
  - `--color-surface-raised`: `#1F202B` (Elevated charcoal)
  - `--color-border`: `rgba(255, 122, 24, 0.12)` (Warm ember border)
  - `--color-text`: `#F0F1F5` (Crisp light text)
  - `--color-text-muted`: `#9E9EB2` (Cool muted text)
  - `--color-accent`: `#FF7A18` (Vibrant warm amber orange)
  - `--color-accent-dim`: `rgba(255, 122, 24, 0.16)`
  - `--color-accent-glow`: `rgba(255, 122, 24, 0.35)`
  - Barcode yellow canvas remains high-contrast `#FBEF00` / white for 100% optical scanner readability.

## 4. Verification & Testing
- Unit tests for speech normalizer (converting English and Arabic spoken digits to clean strings).
- Verify dark and light theme switching.
- Verify TypeScript types and Vite build.
