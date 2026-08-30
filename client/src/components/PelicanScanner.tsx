import { Flashlight, ImageUp, Camera, Scan } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { extractPelicanNumber, FrameConfirmation } from "@/lib/pelican";
import { useLang } from "@/lib/i18n";

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
        w = (await (createWorker as any)("eng", 1, {
          langPath: "/tessdata",
          gzip: true,
          cacheMethod: "write",
        })) as unknown as TWorker;
      } catch {
        // Fallback to CDN if local tessdata fails
        w = (await (createWorker as any)("eng", 1, {
          langPath: "https://tessdata.projectnaptha.com/4.0.0_fast",
          gzip: true,
          cacheMethod: "write",
        })) as unknown as TWorker;
      }

      try {
        await w.setParameters?.({
          tessedit_char_whitelist: "0123456789Barcodes:SKUabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ -/.",
          tessedit_pageseg_mode: "6" as unknown as number,
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

async function ocrCanvas(canvas: HTMLCanvasElement): Promise<string> {
  const w = await getWorker();
  const pre = preprocessForOcr(canvas);
  const { data } = await w.recognize(pre);
  return data.text ?? "";
}

async function serverOcr(canvas: HTMLCanvasElement, timeoutMs = 1800): Promise<string | null> {
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

async function scanCanvas(canvas: HTMLCanvasElement, timeoutMs = 1800): Promise<string | null> {
  // 1. Hardware BarcodeDetector
  try {
    const det = await getDetector();
    if (det) {
      const barcodes = await det.detect(canvas);
      for (const b of barcodes) {
        const val = (b.rawValue ?? "").trim();
        const cand = extractPelicanNumber(val) ?? (/^\d{8,24}$/.test(val) ? val : null);
        if (cand) return cand;
      }
    }
  } catch {}

  // 2. Parallel OCR: local Tesseract + server OCR
  const localPromise = workerReady
    ? ocrCanvas(canvas)
        .then((t) => extractPelicanNumber(t))
        .catch(() => null)
    : Promise.resolve(null);

  const serverPromise = serverOcr(canvas, timeoutMs)
    .then((t) => (t ? extractPelicanNumber(t) : null))
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
  const confirmRef = useRef(new FrameConfirmation(1));
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

  // Crop centered scan zone (optimal 800px width for fast Tesseract execution)
  const captureCrop = useCallback((): HTMLCanvasElement | null => {
    const v = videoRef.current;
    if (!v || v.readyState < 2 || v.videoWidth === 0) return null;
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    const sw = vw * 0.76;
    const sh = vh * 0.44;
    const sx = (vw - sw) / 2;
    const sy = (vh - sh) / 2;

    const targetW = 800;
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

  // Full frame capture (fallback for manual capture if target was off-center)
  const captureFull = useCallback((): HTMLCanvasElement | null => {
    const v = videoRef.current;
    if (!v || v.readyState < 2 || v.videoWidth === 0) return null;
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    const targetW = 960;
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

  const startAutoLoop = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(async () => {
      if (busyRef.current) return;
      const crop = captureCrop();
      if (!crop) return;
      busyRef.current = true;
      try {
        const cand = await scanCanvas(crop, 1500);
        if (cand) {
          const confirmed = confirmRef.current.push(cand);
          if (confirmed) {
            stopCamera();
            onDetectedRef.current(confirmed);
            return;
          }
        }
      } catch {} finally {
        busyRef.current = false;
      }
    }, 280);
  }, [captureCrop, stopCamera]);

  // Manual Capture button handler: instant shutter, scans crop + full frame in parallel
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

      // Scan target crop first (fastest)
      let cand: string | null = null;
      if (crop) {
        cand = await scanCanvas(crop, 2200);
      }

      // If not found in center crop, scan full view
      if (!cand && full) {
        cand = await scanCanvas(full, 2200);
      }

      if (cand) {
        stopCamera();
        onDetectedRef.current(cand);
        return;
      }

      // No match found — show retry pill
      setCaptureError(true);
      window.setTimeout(() => setCaptureError(false), 2000);
    } finally {
      setCapturing(false);
      // If camera is still active, resume auto scanning
      if (streamRef.current) {
        window.setTimeout(() => {
          if (!streamRef.current || timerRef.current) return;
          busyRef.current = false;
          startAutoLoop();
        }, 300);
      }
    }
  }, [capturing, captureCrop, captureFull, startAutoLoop, stopCamera]);

  const startCamera = useCallback(async () => {
    setCameraError(false);
    setNeedsGesture(false);
    setStarting(true);
    stopCamera();
    confirmRef.current = new FrameConfirmation(1);

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
    try {
      try {
        const detector = await getDetector();
        if (detector) {
          const img = new Image();
          img.src = url;
          await new Promise<void>((res, rej) => {
            img.onload = () => res();
            img.onerror = () => rej(new Error("img"));
          });
          const barcodes = await detector.detect(img);
          for (const b of barcodes) {
            const val = (b.rawValue ?? "").trim();
            const cand = extractPelicanNumber(val) ?? (/^\d{8,24}$/.test(val) ? val : null);
            if (cand) {
              URL.revokeObjectURL(url);
              stopCamera();
              onDetected(cand);
              return;
            }
          }
        }
      } catch {}
      const text = await ocrImageSrc(url);
      URL.revokeObjectURL(url);
      const candidate = extractPelicanNumber(text);
      if (candidate) {
        stopCamera();
        onDetected(candidate);
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
    </div>
  );
}