import { Flashlight, ImageUp, Camera, Scan, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { detectBarcodeFormat, extractPelicanNumber, FrameConfirmation, validateBarcode, type BarcodeFormat } from "@/lib/pelican";
import { useLang } from "@/lib/i18n";
import BarcodePreview from "./BarcodePreview";

type Props = { onDetected: (value: string) => void };

// ── OCR Worker (singleton, resilient loader) ──────────────────────────────────

type TWorker = {
  recognize: (src: HTMLCanvasElement | string) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<void>;
  setParameters?: (p: Record<string, string | number>) => Promise<void>;
};

let workerPromise: Promise<TWorker> | null = null;
let workerReady = false;

async function getWorker(): Promise<TWorker> {
  if (workerPromise && workerReady) return workerPromise;
  workerPromise = (async () => {
    try {
      const { createWorker } = await import("tesseract.js");
      let w: TWorker;
      try {
        // Fully self-hosted: worker + wasm core + lang data all served from our origin (offline-capable)
        w = (await (createWorker as any)("eng", 1, {
          workerPath: "/tesseract/worker.min.js",
          corePath: "/tesseract",
          langPath: "/tessdata",
          gzip: true,
          cacheMethod: "write",
        })) as unknown as TWorker;
      } catch {
        // Fallback to CDN if local assets fail
        w = (await (createWorker as any)("eng", 1, {
          langPath: "https://tessdata.projectnaptha.com/4.0.0_fast",
          gzip: true,
          cacheMethod: "write",
        })) as unknown as TWorker;
      }

      try {
        await w.setParameters?.({
          tessedit_char_whitelist: "0123456789",
          tessedit_pageseg_mode: "7" as unknown as number,
          classify_bln_numeric_mode: "1" as unknown as number,
        });
      } catch {}
      workerReady = true;
      return w;
    } catch (e) {
      workerPromise = null;
      workerReady = false;
      throw e;
    }
  })();
  return workerPromise;
}

// Warm up worker in background
void getWorker().catch(() => {});
if (typeof requestIdleCallback !== "undefined") {
  requestIdleCallback(() => void getWorker().catch(() => {}));
}

// ── Fast Histogram-based Image Preprocessing ─────────────────────────────────

function preprocessForOcr(src: HTMLCanvasElement): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const ctx = off.getContext("2d", { willReadFrequently: true });
  if (!ctx) return src;
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const totalPixels = d.length / 4;

  // 1. Fast integer luma grayscale & histogram
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const gray = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
    d[i] = d[i + 1] = d[i + 2] = gray;
    hist[gray]++;
  }

  // 2. 5th-95th percentile contrast stretch via 256-bin histogram (O(1) memory, ~1ms)
  let count = 0;
  let lo = 0;
  let hi = 255;
  const loThresh = totalPixels * 0.05;
  const hiThresh = totalPixels * 0.95;

  for (let i = 0; i < 256; i++) {
    count += hist[i];
    if (count >= loThresh && lo === 0) lo = i;
    if (count >= hiThresh) {
      hi = i;
      break;
    }
  }
  const range = Math.max(1, hi - lo);

  // 3. Fast LUT contrast mapping with S-curve for screen digits
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    if (i <= lo) lut[i] = 0;
    else if (i >= hi) lut[i] = 255;
    else {
      const norm = (i - lo) / range;
      lut[i] = norm < 0.5 ? Math.max(0, Math.round(norm * 1.8 * 128)) : Math.min(255, Math.round(128 + (norm - 0.5) * 2 * 127));
    }
  }

  for (let i = 0; i < d.length; i += 4) {
    const v = lut[d[i]];
    d[i] = d[i + 1] = d[i + 2] = v;
  }

  ctx.putImageData(img, 0, 0);
  return off;
}

// ── OCR & Detection Pipeline ─────────────────────────────────────────────────

function canvasFromImage(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const ctx = c.getContext("2d");
  if (ctx) ctx.drawImage(img, 0, 0);
  return c;
}

async function ocrCanvas(canvas: HTMLCanvasElement): Promise<string> {
  const w = await getWorker();
  const pre = preprocessForOcr(canvas);
  const { data } = await w.recognize(pre);
  return data.text ?? "";
}

async function serverOcr(canvas: HTMLCanvasElement, timeoutMs = 1800): Promise<string | null> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return null;
  try {
    const pre = preprocessForOcr(canvas);
    const dataUrl = pre.toDataURL("image/jpeg", 0.85);
    const b64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch("/api/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: b64 }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const j = (await res.json()) as { text?: string };
    return j.text ?? null;
  } catch {
    return null;
  }
}

// BarcodeDetector (hardware-accelerated if available)
type BarcodeDetectorInstance = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
let detectorPromise: Promise<BarcodeDetectorInstance | null> | null = null;

function getDetector(): Promise<BarcodeDetectorInstance | null> {
  if (detectorPromise) return detectorPromise;
  detectorPromise = (async () => {
    const Ctor = (window as unknown as { BarcodeDetector?: new (opts: unknown) => BarcodeDetectorInstance }).BarcodeDetector;
    if (!Ctor) return null;
    try {
      return new Ctor({ formats: ["code_128", "ean_13", "ean_8", "code_39", "upc_a", "itf"] });
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

// ZXing (pure JS, bundled): works offline on every browser, including iOS Safari.
// Narrow format hints + no TRY_HARDER keep decode time ~tens of milliseconds.
type ZXingReader = { decodeFromCanvas: (canvas: HTMLCanvasElement) => { getText: () => string } };
let zxingPromise: Promise<ZXingReader | null> | null = null;

function getZxing(): Promise<ZXingReader | null> {
  if (zxingPromise) return zxingPromise;
  zxingPromise = (async () => {
    try {
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
        import("@zxing/browser"),
        import("@zxing/library"),
      ]);
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.CODE_128,
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.ITF,
        BarcodeFormat.CODE_39,
      ]);
      return new (BrowserMultiFormatReader as unknown as new (hints?: Map<number, unknown>) => ZXingReader)(hints);
    } catch {
      return null;
    }
  })();
  return zxingPromise;
}

// ZXing decode time scales with pixel count — decode on a capped-size copy
function downscaleForDecode(canvas: HTMLCanvasElement, maxW = 640): HTMLCanvasElement {
  if (canvas.width <= maxW) return canvas;
  const scale = maxW / canvas.width;
  const off = document.createElement("canvas");
  off.width = maxW;
  off.height = Math.round(canvas.height * scale);
  const ctx = off.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(canvas, 0, 0, off.width, off.height);
  return off;
}

function candidateFromRawValue(val: string): string | null {
  const raw = val.trim();
  const cand = extractPelicanNumber(raw) ?? (/^\d{8,24}$/.test(raw) ? raw : null);
  return cand && validateBarcode(cand).valid ? cand : null;
}

async function scanCanvas(canvas: HTMLCanvasElement, timeoutMs = 1800, allowServer = true): Promise<string | null> {
  // 1. Fast decode: hardware BarcodeDetector then ZXing (checksummed symbology read — instant)
  try {
    const det = await getDetector();
    if (det) {
      const barcodes = await det.detect(canvas);
      for (const b of barcodes) {
        const cand = candidateFromRawValue(b.rawValue ?? "");
        if (cand) return cand;
      }
    }
  } catch {}

  try {
    const zxing = await getZxing();
    if (zxing) {
      const result = zxing.decodeFromCanvas(downscaleForDecode(canvas));
      const cand = candidateFromRawValue(result.getText());
      if (cand) return cand;
    }
  } catch {}

  // 2. OCR fallback: strict extraction — GTIN check digit must pass
  const localPromise = workerReady
    ? ocrCanvas(canvas)
        .then((t) => extractPelicanNumber(t, true))
        .catch(() => null)
    : Promise.resolve(null);

  if (!allowServer) {
    return localPromise;
  }

  const serverPromise = serverOcr(canvas, timeoutMs)
    .then((t) => (t ? extractPelicanNumber(t, true) : null))
    .catch(() => null);

  const first = await Promise.race([
    localPromise.then((v) => (v ? { v } : null)),
    serverPromise.then((v) => (v ? { v } : null)),
  ]);
  if (first?.v) return first.v;

  const results = await Promise.all([localPromise, serverPromise]);
  return results[0] ?? results[1] ?? null;
}

async function ocrImageSrc(src: string): Promise<string> {
  const w = await getWorker();
  const { data } = await w.recognize(src);
  return data.text ?? "";
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PelicanScanner({ onDetected }: Props) {
  const { t } = useLang();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const confirmRef = useRef(new FrameConfirmation(3));
  const busyRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const torchFailCountRef = useRef(0);

  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchError, setTorchError] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [starting, setStarting] = useState(true);
  const [cameraError, setCameraError] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);

  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const stopCamera = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const toggleTorch = async () => {
    const stream = streamRef.current;
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    const caps = (track.getCapabilities?.() as unknown as { torch?: boolean }) ?? {};
    if (!caps?.torch) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as unknown as MediaTrackConstraintSet] });
      setTorchOn((v) => !v);
      torchFailCountRef.current = 0;
      setTorchError(false);
    } catch {
      torchFailCountRef.current += 1;
      if (torchFailCountRef.current >= 2) setTorchError(true);
    }
  };

  // Crop centered scan zone — 640px is sweet spot for 14-digit OCR: sharp enough, ~40% faster than 800
  const captureCrop = useCallback((): HTMLCanvasElement | null => {
    const v = videoRef.current;
    if (!v || v.readyState < 2 || v.videoWidth === 0) return null;
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    const sw = vw * 0.76;
    const sh = vh * 0.44;
    const sx = (vw - sw) / 2;
    const sy = (vh - sh) / 2;

    const targetW = 640;
    const targetH = Math.round((targetW * sh) / sw);

    const off = document.createElement("canvas");
    off.width = targetW;
    off.height = targetH;
    const ctx = off.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(v, sx, sy, sw, sh, 0, 0, targetW, targetH);
    return off;
  }, []);

  // Full frame capture (fallback for manual capture if target was off-center) — cap for speed
  const captureFull = useCallback((): HTMLCanvasElement | null => {
    const v = videoRef.current;
    if (!v || v.readyState < 2 || v.videoWidth === 0) return null;
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    const targetW = 720;
    const targetH = Math.round((targetW * vh) / vw);

    const off = document.createElement("canvas");
    off.width = targetW;
    off.height = targetH;
    const ctx = off.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(v, 0, 0, vw, vh, 0, 0, targetW, targetH);
    return off;
  }, []);

  const handleMatchFound = useCallback((cand: string) => {
    stopCamera();
    onDetectedRef.current(cand);
    setScannedBarcode(cand);
  }, [stopCamera]);

  const startAutoLoop = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(async () => {
      if (busyRef.current) return;
      const crop = captureCrop();
      if (!crop) return;
      busyRef.current = true;
      try {
        // Local-only in the auto loop: no per-frame network calls
        const cand = await scanCanvas(crop, 800, false);
        if (cand) {
          const confirmed = confirmRef.current.push(cand);
          if (confirmed) {
            if (!validateBarcode(confirmed).valid) {
              confirmRef.current.reset();
              return;
            }
            handleMatchFound(confirmed);
            return;
          }
        }
      } catch {} finally {
        busyRef.current = false;
      }
    }, 200);
  }, [captureCrop, handleMatchFound]);

  // Manual Capture: staged for speed —
  // Stage 1 (instant): checksummed decode (detector + ZXing) on crop & full in parallel
  // Stage 2: strict OCR race on the crop (local warm worker vs server, bounded)
  const handleManualCapture = useCallback(async () => {
    if (capturing) return;

    // Pause auto loop immediately
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    busyRef.current = true;
    setCapturing(true);
    setCaptureError(false);

    try {
      const crop = captureCrop();
      const full = captureFull();

      if (!crop && !full) {
        setCaptureError(true);
        return;
      }

      const decode = async (c: HTMLCanvasElement): Promise<string | null> => {
        try {
          const det = await getDetector();
          if (det) {
            for (const b of await det.detect(c)) {
              const cand = candidateFromRawValue(b.rawValue ?? "");
              if (cand) return cand;
            }
          }
        } catch {}
        try {
          const zxing = await getZxing();
          if (zxing) {
            const result = zxing.decodeFromCanvas(downscaleForDecode(c));
            const cand = candidateFromRawValue(result.getText());
            if (cand) return cand;
          }
        } catch {}
        return null;
      };

      const frames = [crop, full].filter((c): c is HTMLCanvasElement => Boolean(c));
      const decoded = await Promise.race(
        frames.map((f) => decode(f).then((v) => (v ? { v } : null))),
      );
      if (decoded?.v && validateBarcode(decoded.v).valid) {
        handleMatchFound(decoded.v);
        return;
      }

      // Stage 2: OCR race across all frames, first strict-valid result wins
      const ocrJobs = frames.map((f) => scanCanvas(f, 1800, true).catch(() => null));
      const ocrFirst = await Promise.race(ocrJobs.map((p) => p.then((v) => (v ? { v } : null))));
      let cand: string | null = ocrFirst?.v ?? null;
      if (!cand) {
        const all = await Promise.all(ocrJobs);
        cand = all.find((v) => v) ?? null;
      }

      if (cand && validateBarcode(cand).valid) {
        handleMatchFound(cand);
        return;
      }

      // No match found — show retry pill
      setCaptureError(true);
      window.setTimeout(() => setCaptureError(false), 2000);
    } finally {
      setCapturing(false);
      // If camera is still active and no barcode was scanned, resume auto scanning
      if (streamRef.current && !scannedBarcode) {
        window.setTimeout(() => {
          if (!streamRef.current || timerRef.current) return;
          busyRef.current = false;
          startAutoLoop();
        }, 300);
      }
    }
  }, [capturing, captureCrop, captureFull, handleMatchFound, scannedBarcode, startAutoLoop]);

  // Eagerly warm decoders on mount for instant capture — keep desktop/mobile snappy
  useEffect(() => {
    void getWorker().catch(() => {});
    void getZxing().catch(() => {});
    void getDetector().catch(() => {});
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(false);
    setNeedsGesture(false);
    setStarting(true);
    setScannedBarcode(null);
    stopCamera();
    // 2-frame confirmation: balance speed (~560ms) + accuracy (check-digit still enforced)
    confirmRef.current = new FrameConfirmation(2);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(true);
      setStarting(false);
      return;
    }
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
      video.muted = true;
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        setNeedsGesture(true);
        setStarting(false);
        return;
      }
      window.setTimeout(() => {
        if (video.paused) setNeedsGesture(true);
      }, 500);

      const track = stream.getVideoTracks()[0];
      const caps = (track.getCapabilities?.() as unknown as { torch?: boolean }) ?? {};
      if (caps?.torch) setTorchSupported(true);
      setStarting(false);

      // Start auto scan interval
      startAutoLoop();
    } catch (err) {
      const name = (err as DOMException)?.name ?? "";
      if (name === "NotAllowedError") setNeedsGesture(true);
      else setCameraError(true);
      setStarting(false);
    }
  }, [stopCamera, startAutoLoop]);

  const handleScanNext = () => {
    setScannedBarcode(null);
    setCaptureError(false);
    void startCamera();
  };

  useEffect(() => {
    void startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  useEffect(() => {
    return () => {
      workerPromise?.then((w) => w.terminate().catch(() => {})).catch(() => {});
      workerPromise = null;
      workerReady = false;
    };
  }, []);

  const onImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = URL.createObjectURL(file);
    const loadImage = async (src: string): Promise<HTMLImageElement> => {
      const img = new Image();
      img.src = src;
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("img"));
      });
      return img;
    };
    try {
      try {
        const detector = await getDetector();
        if (detector) {
          const img = await loadImage(url);
          const barcodes = await detector.detect(img);
          for (const b of barcodes) {
            const cand = candidateFromRawValue(b.rawValue ?? "");
            if (cand) {
              URL.revokeObjectURL(url);
              handleMatchFound(cand);
              return;
            }
          }
        }
      } catch {}
      try {
        const zxing = await getZxing();
        if (zxing) {
          const img = await loadImage(url);
          const result = zxing.decodeFromCanvas(downscaleForDecode(canvasFromImage(img)));
          const cand = candidateFromRawValue(result.getText());
          if (cand) {
            URL.revokeObjectURL(url);
            handleMatchFound(cand);
            return;
          }
        }
      } catch {}
      const text = await ocrImageSrc(url);
      URL.revokeObjectURL(url);
      const candidate = extractPelicanNumber(text, true);
      if (candidate && validateBarcode(candidate).valid) {
        handleMatchFound(candidate);
      }
    } catch {
      URL.revokeObjectURL(url);
    }
  };

  const handleGestureTap = () => {
    const v = videoRef.current;
    if (v) v.play().catch(() => setCameraError(true));
    setNeedsGesture(false);
    if (!streamRef.current) void startCamera();
  };

  return (
    <div className="pelican-scan">
      <video ref={videoRef} autoPlay muted playsInline className="pelican-video" />
      <canvas ref={canvasRef} className="pelican-canvas" aria-hidden="true" />

      {!scannedBarcode && (
        <>
          <div className="pelican-overlay" aria-hidden="true">
            <div className="pelican-rect" />
            <p className="pelican-hint">{t.pointAtBarcode}</p>
          </div>

          {torchSupported && !needsGesture && (
            <button
              type="button"
              className={`pelican-torch ${torchError ? "pelican-torch--error" : ""}`}
              onClick={() => void toggleTorch()}
              aria-label="Toggle flash"
            >
              <Flashlight size={16} /> {torchError ? t.flashUnavailable : torchOn ? t.flashOn : t.flashOff}
            </button>
          )}

          {needsGesture && (
            <button type="button" className="pelican-tap" onClick={handleGestureTap}>
              <Camera size={22} /> {t.tapToStart}
            </button>
          )}

          {starting && !needsGesture && !cameraError && (
            <div className="pelican-starting" aria-hidden="true">
              {t.startingCamera}
            </div>
          )}

          {!starting && !needsGesture && !cameraError && (
            <>
              <button
                type="button"
                className={`pelican-manual ${capturing ? "pelican-manual--active" : ""}`}
                onClick={() => void handleManualCapture()}
                disabled={capturing}
                aria-label="Capture now"
              >
                <Scan size={18} /> {capturing ? t.capturing : t.capture}
              </button>
              {captureError && (
                <div className="pelican-capture-error" role="status" aria-live="polite">
                  {t.captureRetry}
                </div>
              )}
            </>
          )}

          <div className="pelican-fallback">
            <button type="button" className="button button--secondary pelican-upload" onClick={() => fileInputRef.current?.click()}>
              <ImageUp size={16} /> {t.uploadImage}
            </button>
            {cameraError && <span className="pelican-fallback__note">{t.cameraUnavailable}</span>}
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => void onImageSelected(e)} />
          </div>
        </>
      )}

      {/* In-place Scannable Barcode Overlay inside Scanner */}
      {scannedBarcode && (
        <div className="scanner-result-overlay" role="dialog" aria-label={t.scanResult}>
          <div className="scanner-result-card">
            <div className="scanner-result-card__header">
              <span className="scanner-result-card__badge">{t.scanResult}</span>
              <button
                type="button"
                className="scanner-result-card__close"
                onClick={handleScanNext}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="scanner-result-card__barcode">
              {scannedBarcode && (
                <BarcodePreview
                  value={scannedBarcode}
                  format={detectBarcodeFormat(scannedBarcode)}
                  onError={() => {}}
                />
              )}
            </div>

            <button
              type="button"
              className="scanner-result-card__btn-next"
              onClick={handleScanNext}
            >
              <RotateCcw size={18} />
              <span>{t.scanNext}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
