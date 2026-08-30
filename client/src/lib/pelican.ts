export const PELICAN_LENGTH = 14;

export function normalizeOcrText(raw: string): string {
  if (!raw) return "";
  let t = raw.replace(/\r\n/g, "\n");
  // Clean OCR spacing within numbers: e.g. "0628 1016 0037 88" -> "06281016003788"
  t = t.replace(/(\d)[ \t\.\-_]+(?=\d)/g, "$1");
  return t;
}

export function extractPelicanNumber(ocrText: string): string | null {
  if (!ocrText) return null;
  const text = normalizeOcrText(ocrText);

  // 1. Direct label pattern: "Barcodes: 06281016003788" or "Barcode: 06281016003788"
  const labelMatch = text.match(/barcode[s]?[\s:\-_]*([0-9OlI\s\-]{8,24})/i);
  if (labelMatch && labelMatch[1]) {
    const cleaned = labelMatch[1].replace(/[Oo]/g, "0").replace(/[Il|]/g, "1").replace(/\D/g, "");
    if (cleaned.length === 14) return cleaned;
    if (cleaned.length === 13) return "0" + cleaned;
    if (cleaned.length >= 8 && cleaned.length <= 18) return cleaned;
  }

  // 2. Multiline search: line contains "barcode" and number is on that line or next line
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/barcode/i.test(line)) {
      // Check current line after the word barcode
      const afterPart = line
        .replace(/.*barcode[s]?[\s:\-_]*/i, "")
        .replace(/[Oo]/g, "0")
        .replace(/[Il|]/g, "1")
        .replace(/\D/g, "");
      if (afterPart.length === 14) return afterPart;
      if (afterPart.length === 13) return "0" + afterPart;
      if (afterPart.length >= 8 && afterPart.length <= 18) return afterPart;

      // Check next line
      if (i + 1 < lines.length) {
        const nextLineDigits = lines[i + 1]
          .trim()
          .replace(/[Oo]/g, "0")
          .replace(/[Il|]/g, "1")
          .replace(/\D/g, "");
        if (nextLineDigits.length === 14) return nextLineDigits;
        if (nextLineDigits.length === 13) return "0" + nextLineDigits;
        if (nextLineDigits.length >= 8 && nextLineDigits.length <= 18) return nextLineDigits;
      }
    }
  }

  // 3. Search for any exact 14-digit sequence anywhere in the OCR text
  const cleanedAll = text.replace(/[Oo](?=\d)/g, "0").replace(/[Il|](?=\d)/g, "1");
  const all14 = cleanedAll.match(/\b\d{14}\b/g) || cleanedAll.match(/\d{14}/g);
  if (all14 && all14.length > 0) {
    return all14[0];
  }

  // 4. Search for 13-digit EAN-13 (often displayed on screens, padded to 14 in Pelican)
  const all13 = cleanedAll.match(/\b\d{13}\b/g);
  if (all13 && all13.length > 0) {
    return "0" + all13[0];
  }

  // 5. Search for any 8-18 digit sequence (GTIN, UPC, EAN-8)
  const general = cleanedAll.match(/\b\d{8,18}\b/g);
  if (general && general.length > 0) {
    return general[0];
  }

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
