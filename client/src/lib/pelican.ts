export const PELICAN_LENGTH = 14;

const LONG_DIGITS = /\d{6,64}/g;

export function normalizeOcrText(raw: string): string {
  let t = raw.replace(/[Oo]/g, "0").replace(/[lI]/g, "1");
  t = t.replace(/(\d)[ \-\.]+(?=\d)/g, "$1");
  return t;
}

export function extractPelicanNumber(ocrText: string): string | null {
  if (!ocrText) return null;
  const text = normalizeOcrText(ocrText);

  const barcodesIndex = text.toLowerCase().indexOf("barcode");
  if (barcodesIndex !== -1) {
    const after = text.slice(barcodesIndex);
    const candidates = after.match(LONG_DIGITS);
    if (candidates) {
      const exact = candidates.find((c) => c.length === PELICAN_LENGTH);
      if (exact) return exact;
    }
  }

  const all = text.match(LONG_DIGITS);
  if (!all) return null;

  const exact14 = all.find((c) => c.length === PELICAN_LENGTH);
  if (exact14) return exact14;

  return null;
}

export class FrameConfirmation {
  private last: string | null = null;
  private count = 0;
  constructor(private requiredFrames = 1) {}
  push(value: string | null): string | null {
    if (!value) { this.last = null; this.count = 0; return null; }
    if (value === this.last) { this.count += 1; }
    else { this.last = value; this.count = 1; }
    if (this.count >= this.requiredFrames) { const c = this.last; this.reset(); return c; }
    return null;
  }
  reset() { this.last = null; this.count = 0; }
}
