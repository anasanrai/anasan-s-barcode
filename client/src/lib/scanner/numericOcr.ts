import { detectBarcodeFormat, extractPelicanNumber, isValidGtin, validateBarcode } from "@/lib/pelican";
import {
  extractNumericCandidate,
  isValidGtinChecksum,
  validateBarcodeString,
  type ScanRuleConfig,
} from "./barcodeValidation";
import { preprocessFrame, type PreprocessPass } from "./preprocessing";
import type { CandidateResult } from "./types";

// ── Tesseract WASM Worker Singleton & Watchdog ──────────────────────────────

type TesseractWorker = {
  recognize: (src: HTMLCanvasElement | string) => Promise<{
    data: {
      text: string;
      confidence: number;
    };
  }>;
  terminate: () => Promise<void>;
  setParameters?: (p: Record<string, string | number>) => Promise<void>;
};

let tesseractWorkerPromise: Promise<TesseractWorker> | null = null;
let activeWorker: TesseractWorker | null = null;

function getBaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

export async function getTesseractWorker(): Promise<TesseractWorker> {
  if (activeWorker) return activeWorker;
  if (tesseractWorkerPromise) return tesseractWorkerPromise;

  tesseractWorkerPromise = (async () => {
    try {
      const { createWorker } = await import("tesseract.js");
      const base = getBaseUrl();
      const workerUrl = base ? new URL("/tesseract/worker.min.js", base).href : "/tesseract/worker.min.js";
      const coreUrl = base ? new URL("/tesseract", base).href : "/tesseract";
      const langUrl = base ? new URL("/tessdata", base).href : "/tessdata";

      let w: TesseractWorker;

      try {
        // Self-hosted offline assets with cacheMethod "none" to prevent IndexedDB locks in Android WebViews
        w = (await (createWorker as any)("eng", 1, {
          workerPath: workerUrl,
          corePath: coreUrl,
          langPath: langUrl,
          gzip: true,
          cacheMethod: "none",
        })) as unknown as TesseractWorker;
      } catch (e) {
        // Fallback for CDN or standard loading
        w = (await (createWorker as any)("eng", 1, {
          langPath: "https://tessdata.projectnaptha.com/4.0.0_fast",
          gzip: true,
          cacheMethod: "none",
        })) as unknown as TesseractWorker;
      }

      try {
        await w.setParameters?.({
          // Allow digits and common screen label characters (Barcode, SKU, :, etc.)
          tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz: -#",
          tessedit_pageseg_mode: "7" as unknown as number, // Single text line mode for instant bank-card speed
        });
      } catch {}

      activeWorker = w;
      return w;
    } catch (err) {
      tesseractWorkerPromise = null;
      activeWorker = null;
      throw err;
    }
  })();

  return tesseractWorkerPromise;
}

// Background warmup
if (typeof window !== "undefined") {
  void getTesseractWorker().catch(() => {});
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(() => void getTesseractWorker().catch(() => {}));
  }
}

// ── Hardware Barcode Detector Integration ────────────────────────────────────

type BarcodeDetectorInstance = {
  detect: (src: CanvasImageSource) => Promise<{ rawValue: string; format?: string }[]>;
};

let detectorPromise: Promise<BarcodeDetectorInstance | null> | null = null;

export function getHardwareBarcodeDetector(): Promise<BarcodeDetectorInstance | null> {
  if (detectorPromise) return detectorPromise;
  detectorPromise = (async () => {
    if (typeof window === "undefined") return null;
    const Ctor = (window as unknown as { BarcodeDetector?: new (opts: unknown) => BarcodeDetectorInstance }).BarcodeDetector;
    if (!Ctor) return null;
    try {
      return new Ctor({
        formats: ["code_128", "ean_13", "ean_8", "code_39", "upc_a", "itf", "qr_code"],
      });
    } catch {
      try {
        return new Ctor({});
      } catch {
        return null;
      }
    }
  })();
  return detectorPromise;
}

// ── Primary Recognition Pipeline ─────────────────────────────────────────────

export interface RecognitionOptions {
  pass?: PreprocessPass;
  strict?: boolean;
  rules?: ScanRuleConfig;
  timeoutMs?: number;
}

/**
 * Execute OCR recognition with strict timeout watchdog to guarantee the scanning loop never freezes.
 */
export async function recognizeNumericTarget(
  canvas: HTMLCanvasElement,
  options: RecognitionOptions = {},
): Promise<CandidateResult | null> {
  const startTime = Date.now();
  const timeoutLimit = options.timeoutMs ?? 450;

  // 1. Check Hardware BarcodeDetector first (<5ms if barcode is visually presented)
  try {
    const detector = await getHardwareBarcodeDetector();
    if (detector) {
      const barcodes = await detector.detect(canvas);
      for (const b of barcodes) {
        const raw = b.rawValue?.trim() ?? "";
        const cand =
          extractNumericCandidate(raw, options.rules) ??
          extractPelicanNumber(raw, options.strict ?? true);
        if (cand && (validateBarcodeString(cand, options.rules).valid || validateBarcode(cand).valid)) {
          return {
            value: cand,
            format: detectBarcodeFormat(cand),
            confidence: 100,
            source: "hardware",
            isValidChecksum: isValidGtinChecksum(cand) || isValidGtin(cand),
            timestamp: startTime,
          };
        }
      }
    }
  } catch {}

  // 2. Preprocess frame with adaptive pass (Takes ~1-2ms on pre-allocated buffers)
  const preprocessed = preprocessFrame(canvas, options.pass ?? "standard");

  // 3. Run fast local Tesseract WASM with watchdog timeout
  try {
    const worker = await getTesseractWorker();

    const ocrPromise = worker.recognize(preprocessed);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("OCR timeout")), timeoutLimit),
    );

    const { data } = await Promise.race([ocrPromise, timeoutPromise]);
    const rawText = data.text ?? "";
    const confidence = Math.round(data.confidence ?? 80);

    const cand =
      extractNumericCandidate(rawText, options.rules) ??
      extractPelicanNumber(rawText, options.strict ?? false);
    if (!cand) return null;

    const validation = validateBarcodeString(cand, options.rules);
    if (!validation.valid && !validateBarcode(cand).valid) return null;

    return {
      value: cand,
      format: detectBarcodeFormat(cand),
      confidence,
      source: "ocr",
      rawText,
      isValidChecksum: isValidGtinChecksum(cand) || isValidGtin(cand),
      timestamp: startTime,
    };
  } catch {
    return null;
  }
}
