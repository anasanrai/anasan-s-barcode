import { Flashlight, ImageUp, Camera, Scan } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { extractPelicanNumber, FrameConfirmation } from "@/lib/pelican";
import { useLang } from "@/lib/i18n";

type Props = { onDetected: (value: string) => void };

// ── OCR Worker (singleton, lazy-loaded) ──────────────────────────────────────

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
      const w = (await (createWorker as any)("eng", 1, {
        langPath: "/tessdata",
        gzip: true,
        cacheMethod: "write",
      })) as unknown as TWorker;
      try {
        await w.setParameters?.({
          tessedit_char_whitelist: "0123456789Barcodes: ",
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

void getWorker().catch(() => {});
if (typeof requestIdleCallback !== "undefined") {
  requestIdleCallback(() => void getWorker().catch(() => {}));
}

// ── Image Preprocessing (tuned for Pelican low-light screen) ─────────────────

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

  // Grayscale (luminance)
  for (let i = 0; i < d.length; i += 4) {
    d[i] = d[i + 1] = d[i + 2] = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
  }

  // Screen-aware contrast stretch: Pelican screen is often dim / warm.
  // Use percentile stretch to ignore moiré/overlay outliers.
  const vals: number[] = [];
  for (let i = 0; i < d.length; i += 4) vals.push(d[i]);
  vals.sort((a, b) => a - b);
  const lo = vals[Math.floor(vals.length * 0.06)] ?? 0;
  const hi = vals[Math.floor(vals.length * 0.96)] ?? 255;
  const range = Math.max(1, hi - lo);

  for (let i = 0; i < d.length; i += 4) {
    let v = ((d[i] - lo) / range) * 255;
    // Gentle S-curve: push mid-tones for digit edges, keep screen text crisp
    v = v < 128 ? Math.max(0, v * 0.55) : Math.min(255, 90 + v * 0.72);
    d[i] = d[i + 1] = d[i + 2] = v;
  }

  ctx.putImageData(img, 0, 0);
  return off;
}

// ── OCR Functions ────────────────────────────────────────────────────────────

async function ocrCanvas(canvas: HTMLCanvasElement): Promise<string> {
  const w = await getWorker();
  const { data } = await w.recognize(preprocessForOcr(canvas));
  return data.text ?? "";
}

async function serverOcr(canvas: HTMLCanvasElement, timeoutMs = 1600): Promise<string | null> {
  try {
    const preprocessed = preprocessForOcr(canvas);
    const dataUrl = preprocessed.toDataURL("image/jpeg", 0.85);
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

async function raceOcr(canvas: HTMLCanvasElement): Promise<string | null> {
  const serverPromise = serverOcr(canvas, 1600);
  const localPromise = workerReady
    ? ocrCanvas(canvas).catch(() => null as string | null)
    : new Promise<null>((r) => setTimeout(() => r(null), 500));

  const result = await Promise.race([
    serverPromise.then((t) => (t ? { source: "server" as const, text: t } : null)),
    localPromise.then((t) => (t ? { source: "local" as const, text: t } : null)),
  ]);

  if (result) return result.text;

  const fallback = await Promise.race([
    serverPromise,
    localPromise,
    new Promise<null>((r) => setTimeout(() => r(null), 900)),
  ]);
  return fallback;
}

// Instant path for manual Capture: no artificial delays, true parallel race,
// first valid 14-digit candidate wins immediately.
async function instantShutterOcr(canvas: HTMLCanvasElement): Promise<string | null> {
  const detectorP = getDetector()
    .then((d) => (d ? d.detect(canvas).catch(() => [] as { rawValue: string }[]) : []))
    .then((bars) => {
      for (const b of bars) {
        const v = (b.rawValue ?? "").trim();
        if (/^\d{8,64}$/.test(v)) {
          const cand = extractPelicanNumber(v) ?? (v.length === 14 ? v : null);
          if (cand) return cand;
        }
      }
      return null;
    });

  const serverP = serverOcr(canvas, 2200).then((t) => (t ? extractPelicanNumber(t) : null));
  const localP = workerReady
    ? ocrCanvas(canvas)
        .then((t) => extractPelicanNumber(t))
        .catch(() => null as string | null)
    : Promise.resolve(null as string | null);

  const winner = await Promise.race([detectorP, serverP, localP].map((p) => p.then((v) => (v ? ({ v } as const) : null))));
  if (winner?.v) return winner.v;

  // If race had no winner yet, wait for the remaining with a short cap
  const all = await Promise.race([
    Promise.all([detectorP, serverP, localP]).then((arr) => arr.find(Boolean) ?? null),
    new Promise<null>((r) => setTimeout(() => r(null), 2600)),
  ]);
  return all ?? null;
}

async function ocrImageSrc(src: string): Promise<string> {
  const w = await getWorker();
  const { data } = await w.recognize(src);
  return data.text ?? "";
}

// ── BarcodeDetector (hardware-accelerated) ───────────────────────────────────

type BarcodeDetectorInstance = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
let detectorPromise: Promise<BarcodeDetectorInstance | null> | null = null;

function getDetector(): Promise<BarcodeDetectorInstance | null> {
  if (detectorPromise) return detectorPromise;
  detectorPromise = (async () => {
    const Ctor = (window as unknown as { BarcodeDetector?: new (opts: unknown) => BarcodeDetectorInstance }).BarcodeDetector;
    if (!Ctor) return null;
    try {
      return new Ctor({ formats: ["code_128", "ean_13", "ean_8", "code_39", "upc_a"] });
    } catch {
      try { return new Ctor({}); } catch { return null; }
    }
  })();
  return detectorPromise;
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

  const captureFrame = useCallback((): HTMLCanvasElement | null => {
    const v = videoRef.current;
    const canvas = canvasRef.current;
    if (!v || !canvas || v.readyState < 2 || v.videoWidth === 0) return null;
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    const sw = vw * 0.76;
    const sh = vh * 0.44;
    const sx = (vw - sw) / 2;
    const sy = (vh - sh) / 2;
    const scale = 1.35;
    canvas.width = Math.round(sw * scale);
    canvas.height = Math.round(sh * scale);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(v, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    return canvas;
  }, []);

  // Higher-res shutter for manual Capture: bigger scale so digits are crisp.
  const captureFrameHiRes = useCallback((): HTMLCanvasElement | null => {
    const v = videoRef.current;
    if (!v || v.readyState < 2 || v.videoWidth === 0) return null;
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    const sw = vw * 0.78;
    const sh = vh * 0.46;
    const sx = (vw - sw) / 2;
    const sy = (vh - sh) / 2;
    const scale = 1.9;
    const off = document.createElement("canvas");
    off.width = Math.round(sw * scale);
    off.height = Math.round(sh * scale);
    const ctx = off.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    (ctx as unknown as { imageSmoothingQuality?: string }).imageSmoothingQuality = "high";
    ctx.drawImage(v, sx, sy, sw, sh, 0, 0, off.width, off.height);
    return off;
  }, []);

  const [captureError, setCaptureError] = useState(false);

  const handleManualCapture = useCallback(async () => {
    if (capturing) return;
    // Manual overrides auto: pause auto loop instantly, never blocked by busyRef.
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    busyRef.current = true;
    setCapturing(true);
    setCaptureError(false);
    try {
      // Shutter: capture hi-res frame synchronously (0ms) from live video pixels.
      const canvas = captureFrameHiRes() ?? captureFrame();
      if (!canvas) {
        setCaptureError(true);
        return;
      }

      const found = await instantShutterOcr(canvas);
      if (found) {
        stopCamera();
        onDetectedRef.current(found);
        return;
      }
      // No number in this shutter — brief feedback, then resume auto.
      setCaptureError(true);
      window.setTimeout(() => setCaptureError(false), 1700);
    } finally {
      setCapturing(false);
      if (!streamRef.current) return;
      // Already stopped on success — don't resume if camera was closed.
      if (!streamRef.current) return;
      // Resume auto loop after a short re-aim window
      window.setTimeout(() => {
        if (!streamRef.current || timerRef.current) return;
        busyRef.current = false;
        timerRef.current = window.setInterval(async () => {
          if (busyRef.current) return;
          const c = captureFrame();
          if (!c) return;
          busyRef.current = true;
          try {
            const detector = await getDetector();
            if (detector) {
              try {
                const barcodes = await detector.detect(c);
                for (const b of barcodes) {
                  const val = (b.rawValue ?? "").trim();
                  if (/^\d{8,64}$/.test(val)) {
                    const cand = extractPelicanNumber(val) ?? (val.length === 14 ? val : null);
                    if (cand) {
                      const confirmed = confirmRef.current.push(cand);
                      if (confirmed) {
                        stopCamera();
                        onDetectedRef.current(confirmed);
                        return;
                      }
                    }
                  }
                }
              } catch {}
            }
            const text = await raceOcr(c);
            if (text) {
              const candidate = extractPelicanNumber(text);
              const confirmed = confirmRef.current.push(candidate);
              if (confirmed) {
                stopCamera();
                onDetectedRef.current(confirmed);
              }
            }
          } catch {} finally {
            busyRef.current = false;
          }
        }, 240);
      }, 350);
    }
  }, [capturing, captureFrame, captureFrameHiRes, stopCamera]);

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

      void getDetector().catch(() => {});
      void getWorker().catch(() => {});

      timerRef.current = window.setInterval(async () => {
        if (busyRef.current) return;
        const canvas = captureFrame();
        if (!canvas) return;
        busyRef.current = true;
        try {
          const detector = await getDetector();
          if (detector) {
            try {
              const barcodes = await detector.detect(canvas);
              for (const b of barcodes) {
                const val = (b.rawValue ?? "").trim();
                if (/^\d{8,64}$/.test(val)) {
                  const cand = extractPelicanNumber(val) ?? (val.length === 14 ? val : null);
                  if (cand) {
                    const confirmed = confirmRef.current.push(cand);
                    if (confirmed) {
                      stopCamera();
                      onDetectedRef.current(confirmed);
                      return;
                    }
                  }
                }
              }
            } catch {}
          }

          const text = await raceOcr(canvas);
          if (text) {
            const candidate = extractPelicanNumber(text);
            const confirmed = confirmRef.current.push(candidate);
            if (confirmed) {
              stopCamera();
              onDetectedRef.current(confirmed);
            }
          }
        } catch {} finally {
          busyRef.current = false;
        }
      }, 240);
    } catch (err) {
      const name = (err as DOMException)?.name ?? "";
      if (name === "NotAllowedError") setNeedsGesture(true);
      else setCameraError(true);
      setStarting(false);
    }
  }, [stopCamera, captureFrame]);

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
          await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("img")); });
          const barcodes = await detector.detect(img);
          for (const b of barcodes) {
            const val = (b.rawValue ?? "").trim();
            if (/^\d{8,64}$/.test(val)) {
              const cand = extractPelicanNumber(val) ?? (val.length === 14 ? val : null);
              if (cand) { URL.revokeObjectURL(url); stopCamera(); onDetected(cand); return; }
            }
          }
        }
      } catch {}
      const text = await ocrImageSrc(url);
      URL.revokeObjectURL(url);
      const candidate = extractPelicanNumber(text);
      if (candidate) { stopCamera(); onDetected(candidate); }
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
        <button type="button" className={`pelican-torch ${torchError ? "pelican-torch--error" : ""}`} onClick={() => void toggleTorch()} aria-label="Toggle flash">
          <Flashlight size={16} /> {torchError ? t.flashUnavailable : torchOn ? t.flashOn : t.flashOff}
        </button>
      )}

      {needsGesture && (
        <button type="button" className="pelican-tap" onClick={handleGestureTap}>
          <Camera size={22} /> {t.tapToStart}
        </button>
      )}

      {starting && !needsGesture && !cameraError && (
        <div className="pelican-starting" aria-hidden="true">{t.startingCamera}</div>
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
