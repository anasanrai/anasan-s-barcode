/**
 * Pelican screen parsing.
 * - Keep value as string to preserve leading zeros.
 * - Prefer 14-digit sequences near "Barcodes:" label.
 * - Require 2-3 frame confirmation is handled by caller.
 */

export const PELICAN_LENGTH = 14;

const LONG_DIGITS = /\d{6,64}/g;

/** Normalize common OCR confusions but preserve leading zeros. */
export function normalizeOcrText(raw: string): string {
  // Fix frequent confusions on Pelican white card: O->0, o->0, l/I->1, S->5 is risky, so only O/o
  // Also remove spaces/dashes inside numbers: "0628 1016 0037 88" -> "06281016003788"
  let t = raw.replace(/[Oo]/g, "0").replace(/[lI]/g, "1");
  // Collapse spaces/dashes between digits
  t = t.replace(/(\d)[ \-\.]+(?=\d)/g, "$1");
  return t;
}

/** Extract the best candidate number from raw OCR text. */
export function extractPelicanNumber(ocrText: string): string | null {
  if (!ocrText) return null;
  const text = normalizeOcrText(ocrText);

  // Prefer the number that appears after "Barcodes" label (case-insensitive).
  const barcodesIndex = text.toLowerCase().indexOf("barcode");
  if (barcodesIndex !== -1) {
    const after = text.slice(barcodesIndex);
    const candidates = after.match(LONG_DIGITS);
    if (candidates) {
      // Prefer exact 14 first
      const exact = candidates.find((c) => c.length === PELICAN_LENGTH);
      if (exact) return exact;
      // Then prefer longest >=14 near label
      const near = candidates.sort((a, b) => b.length - a.length)[0];
      // For Pelican use-case return 14-digit if available anywhere
      if (near && near.length >= 13 && near.length <= 20) {
        // if longer than 14, take first 14? No — only exact length is valid. Keep as-is if 14 else null.
        // Fall through to global search.
      }
    }
  }

  const all = text.match(LONG_DIGITS);
  if (!all) return null;

  // Priority: exact 14-digit match anywhere in text
  const exact14 = all.find((c) => c.length === PELICAN_LENGTH);
  if (exact14) return exact14;

  // Do not guess: if no 14-digit, return null to avoid partial/SKU.
  // Caller may decide to accept other lengths via validateExactDigits, but for Pelican flow we want 14.
  return null;
}

/** Generic numeric extractor that returns the first digit run of 6-64 (used for manual fallback). */
export function extractAnyNumericCandidate(ocrText: string): string | null {
  const m = ocrText.match(LONG_DIGITS);
  if (!m) return null;
  return m.find((c) => c.length === PELICAN_LENGTH) ?? null;
}

/** Frame-confirmation helper: requires same value in N consecutive observations. Default 1 = instant. */
export class FrameConfirmation {
  private last: string | null = null;
  private count = 0;
  constructor(private requiredFrames = 1) {}
  push(value: string | null): string | null {
    if (!value) {
      this.last = null;
      this.count = 0;
      return null;
    }
    if (value === this.last) {
      this.count += 1;
    } else {
      this.last = value;
      this.count = 1;
    }
    if (this.count >= this.requiredFrames) {
      const confirmed = this.last;
      this.reset();
      return confirmed;
    }
    return null;
  }
  reset() {
    this.last = null;
    this.count = 0;
  }
}
