import { Flashlight, ImageUp, Camera } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { extractPelicanNumber, FrameConfirmation } from "@/lib/pelican";

type Props = { onDetected: (value: string) => void };

// ---- OCR worker singleton (cross-platform) ----
type TWorker = {
  recognize: (src: HTMLCanvasElement | string) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<void>;
  setParameters?: (p: Record<string, string | number>) => Promise<void>;
};
let workerPromise: Promise<TWorker> | null = null;
async function getWorker(): Promise<TWorker> {
  if (workerPromise) return workerPromise;
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
      return w;
    } catch (e) {
      // Reset singleton so next call retries instead of returning rejected promise
      workerPromise = null;
      throw e;
    }
  })();
  return workerPromise;
}
// Warm at import time — hides the one-time ~1-2s download before camera opens
void getWorker().catch(() => {});
async function ocrCanvas(canvas: HTMLCanvasElement): Promise<string> {
  const w = await getWorker();
  const { data } = await w.recognize(canvas);
  return data.text ?? "";
}
async function ocrImageSrc(src: string): Promise<string> {
  const w = await getWorker();
  const { data } = await w.recognize(src);
  return data.text ?? "";
}
async function serverOcr(canvas: HTMLCanvasElement, timeoutMs = 700): Promise<string | null> {
  try {
    const dataUrl = canvas.toDataURL("image/jpeg", 0.65);
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

// Native BarcodeDetector fast path (hardware-accelerated, instant on Android Chrome/iOS 17+)
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
      try {
        return new Ctor({});
      } catch {
        return null;
      }
    }
  })();
  return detectorPromise;
}

export default function PelicanScanner({ onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const confirmRef = useRef(new FrameConfirmation(1)); // instant: 1 frame
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

      // INSTANT sampling: 260ms, native detector → server OCR → local OCR
      timerRef.current = window.setInterval(async () => {
        if (busyRef.current) return;
        const v = videoRef.current;
        const canvas = canvasRef.current;
        if (!v || !canvas || v.readyState < 2 || v.videoWidth === 0 || v.paused) return;
        busyRef.current = true;
        try {
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
          if (!ctx) return;
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(v, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

          // 1) Native BarcodeDetector fast path (~10-30ms, hardware)
          try {
            const detector = await getDetector();
            if (detector) {
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
            }
          } catch {}

          // 2) Server OCR instant path (~150-400ms, no client model download)
          const text = await serverOcr(canvas, 650);
          if (text != null) {
            const candidate = extractPelicanNumber(text);
            const confirmed = confirmRef.current.push(candidate);
            if (confirmed) {
              stopCamera();
              onDetectedRef.current(confirmed);
            }
            return; // Server responded — skip local OCR this tick
          }

          // 3) Local OCR fallback — only if server didn't respond (not timeout)
          try {
            const localText = await Promise.race([
              ocrCanvas(canvas),
              new Promise<string>((_, rej) => setTimeout(() => rej(new Error("local-ocr-timeout")), 900)),
            ]);
            const candidate = extractPelicanNumber(localText);
            const confirmed = confirmRef.current.push(candidate);
            if (confirmed) {
              stopCamera();
              onDetectedRef.current(confirmed);
            }
          } catch (err) {
            // Log timeout silently, surface real errors
            if (err instanceof Error && err.message !== "local-ocr-timeout") {
              console.error("[pelican] local ocr error:", err);
            }
          }
        } catch {
        } finally {
          busyRef.current = false;
        }
      }, 260);
    } catch (err) {
      const name = (err as DOMException)?.name ?? "";
      if (name === "NotAllowedError") setNeedsGesture(true);
      else setCameraError(true);
      setStarting(false);
    }
  }, [stopCamera]);

  useEffect(() => {
    void startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  useEffect(() => {
    return () => {
      workerPromise?.then((w) => w.terminate().catch(() => {})).catch(() => {});
      workerPromise = null;
    };
  }, []);

  const onImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = URL.createObjectURL(file);
    try {
      // Try native detector on image first (instant if it's a photographed barcode)
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
              if (cand) {
                URL.revokeObjectURL(url);
                stopCamera();
                onDetected(cand);
                return;
              }
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
        <p className="pelican-hint">Point at barcode number.</p>
      </div>

      {torchSupported && !needsGesture && (
        <button type="button" className={`pelican-torch ${torchError ? "pelican-torch--error" : ""}`} onClick={() => void toggleTorch()} aria-label="Toggle flash">
          <Flashlight size={16} /> {torchError ? "Flash unavailable" : torchOn ? "Flash on" : "Flash"}
        </button>
      )}

      {needsGesture && (
        <button type="button" className="pelican-tap" onClick={handleGestureTap}>
          <Camera size={22} /> Tap to start camera
        </button>
      )}

      {starting && !needsGesture && !cameraError && (
        <div className="pelican-starting" aria-hidden="true">Starting camera…</div>
      )}

      <div className="pelican-fallback">
        <button type="button" className="button button--secondary pelican-upload" onClick={() => fileInputRef.current?.click()}>
          <ImageUp size={16} /> Upload image
        </button>
        {cameraError && <span className="pelican-fallback__note">Camera unavailable — upload a photo of the Pelican screen.</span>}
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => void onImageSelected(e)} />
      </div>
    </div>
  );
}
