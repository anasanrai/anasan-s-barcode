import { detectBarcodeFormat, extractPelicanNumber, isValidGtin, validateBarcode } from "@/lib/pelican";
import { preprocessFrame, type PreprocessPass } from "./preprocessing";
import type { CandidateResult, ScanRuleConfig } from "./types";

// ── Tesseract WASM Worker Singleton ──────────────────────────────────────────

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
let tesseractReady = false;

export async function getTesseractWorker(): Promise<TesseractWorker> {
  if (tesseractWorkerPromise && tesseractReady) return tesseractWorkerPromise;

  tesseractWorkerPromise = (async () => {
    try {
      const { createWorker } = await import("tesseract.js");
      let w: TesseractWorker;

      try {
        // Self-hosted offline assets
        w = (await (createWorker as any)("eng", 1, {
          workerPath: "/tesseract/worker.min.js",
          corePath: "/tesseract",
          langPath: "/tessdata",
          gzip: true,
          cacheMethod: "write",
        })) as unknown as TesseractWorker;
      } catch {
        // Fallback if offline path fails in test/development
        w = (await (createWorker as any)("eng", 1, {
          langPath: "https://tessdata.projectnaptha.com/4.0.0_fast",
          gzip: true,
          cacheMethod: "write",
        })) as unknown as TesseractWorker;
      }

      try {
        await w.setParameters?.({
          tessedit_char_whitelist: "0123456789",
          tessedit_pageseg_mode: "7" as unknown as number, // Single text line mode
          classify_bln_numeric_mode: "1" as unknown as number,
        });
      } catch {}

      tesseractReady = true;
      return w;
    } catch (err) {
      tesseractWorkerPromise = null;
      tesseractReady = false;
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
}

/**
 * Execute OCR recognition on an input canvas.
 */
export async function recognizeNumericTarget(
  canvas: HTMLCanvasElement,
  options: RecognitionOptions = {},
): Promise<CandidateResult | null> {
  const startTime = Date.now();

  // 1. Check Hardware BarcodeDetector first (takes <5ms if available)
  try {
    const detector = await getHardwareBarcodeDetector();
    if (detector) {
      const barcodes = await detector.detect(canvas);
      for (const b of barcodes) {
        const raw = b.rawValue?.trim() ?? "";
        const cand = extractPelicanNumber(raw, options.strict ?? true);
        if (cand && validateBarcode(cand).valid) {
          return {
            value: cand,
            format: detectBarcodeFormat(cand),
            confidence: 100,
            source: "hardware",
            isValidChecksum: isValidGtin(cand),
            timestamp: startTime,
          };
        }
      }
    }
  } catch {}

  // 2. Preprocess frame with chosen pass
  const preprocessed = preprocessFrame(canvas, options.pass ?? "standard");

  // 3. Run fast local Tesseract WASM
  try {
    const worker = await getTesseractWorker();
    const { data } = await worker.recognize(preprocessed);
    const rawText = data.text ?? "";
    const confidence = Math.round(data.confidence ?? 80);

    const cand = extractPelicanNumber(rawText, options.strict ?? false);
    if (!cand) return null;

    const validation = validateBarcode(cand);
    if (!validation.valid) return null;

    return {
      value: cand,
      format: detectBarcodeFormat(cand),
      confidence,
      source: "ocr",
      rawText,
      isValidChecksum: isValidGtin(cand),
      timestamp: startTime,
    };
  } catch {
    return null;
  }
}
