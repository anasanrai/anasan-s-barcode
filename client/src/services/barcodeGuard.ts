/** Signal Field barcode-first scanner: native linear payloads are validated locally before any OCR fallback is considered. */

import type { BoundingBox } from "./ocrPipeline";

type MachineCodeDetector = {
  detect(image: ImageBitmapSource): Promise<Array<{ rawValue: string; format: string; boundingBox: DOMRectReadOnly }>>;
};

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => MachineCodeDetector;

export type DetectedBarcode = { value: string; format: string; bbox: BoundingBox };

const LINEAR_FORMATS = new Set(["code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e", "itf", "codabar", "zxing_1d"]);

type ZxingReader = { decodeFromCanvas: (frame: HTMLCanvasElement) => { getText: () => string } };

export function selectNumericLinearBarcode(detections: DetectedBarcode[], minLength: number, maxLength: number): DetectedBarcode | null {
  return detections.find((detection) => LINEAR_FORMATS.has(detection.format) && /^\d+$/.test(detection.value) && detection.value.length >= minLength && detection.value.length <= maxLength) ?? null;
}

export class BarcodeGuard {
  private detector: MachineCodeDetector | null = null;
  private available = false;
  private zxingReader: ZxingReader | null = null;
  private zxingThoroughReader: ZxingReader | null = null;
  private zxingWarmup: Promise<void> | null = null;

  constructor() {
    const Detector = (globalThis as typeof globalThis & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!Detector) return;
    try {
      this.detector = new Detector({ formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e", "itf", "codabar"] });
      this.available = true;
    } catch {
      this.detector = null;
    }
  }

  async detect(frame: HTMLCanvasElement, thorough = false): Promise<DetectedBarcode[]> {
    const nativeDetections = await this.detectNative(frame);
    if (nativeDetections.some((detection) => selectNumericLinearBarcode([detection], 1, Number.MAX_SAFE_INTEGER))) return nativeDetections;
    const fallback = await this.detectWithZxing(frame, thorough);
    return fallback ? [...nativeDetections, fallback] : nativeDetections;
  }

  async detectRegions(frame: HTMLCanvasElement): Promise<BoundingBox[]> { return (await this.detect(frame)).filter((detection) => LINEAR_FORMATS.has(detection.format)).map((detection) => detection.bbox); }

  get isAvailable(): boolean { return this.available || Boolean(this.zxingReader); }

  async warmFallback(): Promise<void> {
    if (this.zxingReader || this.zxingWarmup) return this.zxingWarmup ?? Promise.resolve();
    this.zxingWarmup = Promise.all([import("@zxing/browser"), import("@zxing/library")])
      .then(([{ BrowserMultiFormatOneDReader }, { BarcodeFormat, DecodeHintType }]) => {
        const formats = [BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.ITF, BarcodeFormat.CODABAR];
        const fastHints = new Map<any, any>([[DecodeHintType.POSSIBLE_FORMATS, formats]]);
        const thoroughHints = new Map<any, any>([[DecodeHintType.POSSIBLE_FORMATS, formats], [DecodeHintType.TRY_HARDER, true]]);
        this.zxingReader = new BrowserMultiFormatOneDReader(fastHints);
        this.zxingThoroughReader = new BrowserMultiFormatOneDReader(thoroughHints);
      })
      .catch(() => { this.zxingReader = null; this.zxingThoroughReader = null; })
      .finally(() => { this.zxingWarmup = null; });
    return this.zxingWarmup;
  }

  private async detectNative(frame: HTMLCanvasElement): Promise<DetectedBarcode[]> {
    if (!this.detector) return [];
    try {
      const detections = await this.detector.detect(frame);
      return detections.map(({ rawValue, format, boundingBox }) => ({ value: rawValue.trim(), format, bbox: { x0: boundingBox.x, y0: boundingBox.y, x1: boundingBox.x + boundingBox.width, y1: boundingBox.y + boundingBox.height } }));
    } catch {
      return [];
    }
  }

  private async detectWithZxing(frame: HTMLCanvasElement, thorough: boolean): Promise<DetectedBarcode | null> {
    await this.warmFallback();
    const reader = thorough ? this.zxingThoroughReader ?? this.zxingReader : this.zxingReader;
    if (!reader) return null;
    try {
      const value = reader.decodeFromCanvas(frame).getText().trim();
      return { value, format: "zxing_1d", bbox: { x0: 0, y0: 0, x1: frame.width, y1: frame.height } };
    } catch {
      return null;
    }
  }
}
