import type { BarcodeFormat } from "@/components/BarcodePreview";
export type { BarcodeFormat } from "@/components/BarcodePreview";

export const PELICAN_LENGTH = 14;

export function normalizeOcrText(raw: string): string {
  if (!raw) return "";
  let t = raw.replace(/\r\n/g, "\n");
  // Clean OCR spacing within numbers: e.g. "0628 1016 0037 88" -> "06281016003788"
  t = t.replace(/(\d)[ \t\.\-_]+(?=\d)/g, "$1");
  return t;
}

/** Compute the GTIN/EAN/UPC check digit for a string *without* the check digit. */
export function gtinCheckDigit(digitsWithoutCheck: string): number {
  let sum = 0;
  // GTIN uses right-to-left position weighting; here we iterate left-to-right.
  // For GTIN-14: positions from left are weighted 3,1,3,1,... starting with 3.
  for (let i = 0; i < digitsWithoutCheck.length; i++) {
    const d = parseInt(digitsWithoutCheck[i], 10);
    sum += i % 2 === 0 ? d * 3 : d;
  }
  const mod = sum % 10;
  return mod === 0 ? 0 : 10 - mod;
}

/** Validate a full GTIN-8 / GTIN-12 (UPC) / GTIN-13 (EAN-13) / GTIN-14 / ITF-14 code. */
export function isValidGtin(value: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(value)) return false;
  const check = parseInt(value.slice(-1), 10);
  return gtinCheckDigit(value.slice(0, -1)) === check;
}

/** Validate a scanned value. Non-GTIN lengths are accepted (e.g. internal CODE128 codes). */
export function validateBarcode(value: string): { valid: boolean; reason?: string } {
  if (!value || !/^\d+$/.test(value)) return { valid: false, reason: "not numeric" };
  if (/^\d{8}$|^\d{12,14}$/.test(value)) {
    return isValidGtin(value)
      ? { valid: true }
      : { valid: false, reason: "invalid check digit" };
  }
  return { valid: true };
}

/** Try to turn a candidate digit string into a trustworthy barcode value. */
function cleanDigits(raw: string): string {
  return raw.replace(/[Oo]/g, "0").replace(/[Il|]/g, "1").replace(/\D/g, "");
}

export function extractPelicanNumber(ocrText: string, strict = false): string | null {
  if (!ocrText) return null;
  const text = normalizeOcrText(ocrText);

  // 1. Direct label pattern: "Barcodes: 06281016003788" or "Barcode: 06281016003788"
  const labelMatch = text.match(/barcode[s]?[\s:\-_]*([0-9OlI\s\-]{8,24})/i);
  if (labelMatch && labelMatch[1]) {
    const cleaned = cleanDigits(labelMatch[1]);
    const validated = normalizeBarcodeCandidate(cleaned, strict);
    if (validated) return validated;
  }

  // 2. Multiline search: line contains "barcode" and number is on that line or next line
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/barcode/i.test(line)) {
      // Check current line after the word barcode
      const afterPart = cleanDigits(line.replace(/.*barcode[s]?[\s:\-_]*/i, ""));
      const afterValidated = normalizeBarcodeCandidate(afterPart, strict);
      if (afterValidated) return afterValidated;

      // Check next line
      if (i + 1 < lines.length) {
        const nextLineDigits = cleanDigits(lines[i + 1].trim());
        const nextValidated = normalizeBarcodeCandidate(nextLineDigits, strict);
        if (nextValidated) return nextValidated;
      }
    }
  }

  // 3. Search for any exact 14-digit sequence anywhere in the OCR text
  const cleanedAll = text.replace(/[Oo](?=\d)/g, "0").replace(/[Il|](?=\d)/g, "1");
  const all14 = cleanedAll.match(/\b\d{14}\b/g) || cleanedAll.match(/\d{14}/g);
  if (all14 && all14.length > 0) {
    const validated = normalizeBarcodeCandidate(all14[0], strict);
    if (validated) return validated;
  }

  // 4. Search for 13-digit EAN-13 (often displayed on screens, padded to 14 in Pelican)
  const all13 = cleanedAll.match(/\b\d{13}\b/g);
  if (all13 && all13.length > 0) {
    const validated = normalizeBarcodeCandidate(all13[0], strict);
    if (validated) return validated;
  }

  if (strict) return null;

  // 5. Search for any 8-18 digit sequence (GTIN, UPC, EAN-8, internal CODE128)
  const general = cleanedAll.match(/\b\d{8,18}\b/g);
  if (general && general.length > 0) {
    const validated = normalizeBarcodeCandidate(general[0], strict);
    if (validated) return validated;
  }

  return null;
}

/**
 * Normalize a digit-only candidate:
 * - GTIN-8 / GTIN-12 / GTIN-14 must have a valid check digit.
 * - GTIN-13: if prepending "0" makes a valid GTIN-14, return the 14-digit form
 *   (common for Pelican screens that drop the leading zero). Otherwise validate as
 *   EAN-13 and return as-is if valid.
 * - Other lengths are returned as-is (internal CODE128 codes).
 */
function normalizeBarcodeCandidate(digits: string, strict = false): string | null {
  if (!digits || digits.length < 8) return null;

  // Standard GTIN lengths: validate directly
  if (/^\d{8}$|^\d{12}$|^\d{14}$/.test(digits)) {
    return isValidGtin(digits) ? digits : null;
  }

  // 13-digit: try GTIN-14 with leading zero, then EAN-13
  if (/^\d{13}$/.test(digits)) {
    const padded = "0" + digits;
    if (isValidGtin(padded)) return padded;
    if (isValidGtin(digits)) return digits;
    return null;
  }

  // Non-standard length: accept as internal code only outside the scanner —
  // strict mode (camera path) rejects these to prevent OCR garbage.
  if (!strict && /^\d{8,18}$/.test(digits)) return digits;
  return null;
}

export class FrameConfirmation {
  private last: string | null = null;
  private count = 0;
  private requiredFrames: number;

  constructor(requiredFrames = 1) {
    this.requiredFrames = requiredFrames;
  }

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
      const c = this.last;
      this.reset();
      return c;
    }
    return null;
  }
  reset() {
    this.last = null;
    this.count = 0;
  }
}

export function detectBarcodeFormat(value: string): BarcodeFormat {
  const len = value.length;
  if (len === 14) return "ITF14";
  if (len === 13) return "EAN13";
  if (len === 12) return "UPC";
  if (len === 8) return "EAN8";
  return "CODE128";
}

