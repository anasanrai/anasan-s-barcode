import { Flashlight, ImageUp, Camera } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { extractPelicanNumber, FrameConfirmation } from "@/lib/pelican";

type Props = { onDetected: (value: string) => void };

// ---- OCR worker singleton (cross-platform) ----
type TWorker = { recognize: (src: HTMLCanvasElement | string) => Promise<{ data: { text: string } }>; terminate: () => Promise<void> };
let workerPromise: Promise<TWorker> | null = null;
async function getWorker(): Promise<TWorker> {
  if (workerPromise) return workerPromise;
  workerPromise = (async () => {
    const { createWorker } = await import("tesseract.js");
    // eng only; no extra OSD to keep wasm small and fast on iOS
    const w = (await createWorker("eng")) as unknown as TWorker;
    return w;
  })();
  return workerPromise;
}
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

export default function PelicanScanner({ onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const confirmRef = useRef(new FrameConfirmation(2));
  const busyRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
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
    } catch { /* ignore */ }
  };

  const startCamera = useCallback(async () => {
    setCameraError(false);
    setNeedsGesture(false);
    setStarting(true);
    // Clean previous
    stopCamera();
    confirmRef.current = new FrameConfirmation(2);

    // Guard: insecure context or no mediaDevices
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(true);
      setStarting(false);
      return;
    }
    try {
      // Try environment first, fallback to generic video on failure (iOS 16 quirk)
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
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
      // iOS Safari requires explicit play() after user gesture; try and detect failure
      try {
        await video.play();
      } catch {
        setNeedsGesture(true);
        setStarting(false);
        return;
      }
      // Check if video actually started (readyState)
      // Give it a moment; if still paused and no gesture, show tap button
      window.setTimeout(() => {
        if (video.paused) setNeedsGesture(true);
      }, 600);

      const track = stream.getVideoTracks()[0];
      const caps = (track.getCapabilities?.() as unknown as { torch?: boolean }) ?? {};
      if (caps?.torch) setTorchSupported(true);
      setStarting(false);

      // Pre-warm OCR worker in background (hide latency on first frame, iOS slow wasm)
      void getWorker().catch(() => {});

      // OCR sampling loop
      timerRef.current = window.setInterval(async () => {
        if (busyRef.current) return;
        const v = videoRef.current;
        const canvas = canvasRef.current;
        if (!v || !canvas || v.readyState < 2 || v.videoWidth === 0 || v.paused) return;
        busyRef.current = true;
        try {
          const vw = v.videoWidth;
          const vh = v.videoHeight;
          // Center crop matching overlay: 68% width, 38% height
          const sw = vw * 0.68;
          const sh = vh * 0.38;
          const sx = (vw - sw) / 2;
          const sy = (vh - sh) / 2;
          // Upscale 1.6x for OCR accuracy (helps small Pelican text)
          const scale = 1.6;
          canvas.width = sw * scale;
          canvas.height = sh * scale;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          // Improve contrast for ML Kit / Tesseract
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(v, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
          // Light grayscale + contrast boost helps iOS auto-exposure white card
          try {
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const d = img.data;
            for (let i = 0; i < d.length; i += 4) {
              const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
              const v2 = g > 155 ? 255 : g < 90 ? 0 : g;
              d[i] = d[i + 1] = d[i + 2] = v2;
            }
            ctx.putImageData(img, 0, 0);
          } catch { /* cross-origin canvas on some iOS — ignore */ }

          const text = await ocrCanvas(canvas);
          const candidate = extractPelicanNumber(text);
          const confirmed = confirmRef.current.push(candidate);
          if (confirmed) {
            stopCamera();
            onDetectedRef.current(confirmed);
          }
        } catch {
          // never surface OCR errors — keep scanning
        } finally {
          busyRef.current = false;
        }
      }, 900);
    } catch (err) {
      const name = (err as DOMException)?.name ?? "";
      // iOS blocks without gesture: NotAllowedError before any tap
      if (name === "NotAllowedError") setNeedsGesture(true);
      else setCameraError(true);
      setStarting(false);
    }
  }, [stopCamera]);

  useEffect(() => {
    // Attempt auto-start; iOS will flip to needsGesture if blocked
    void startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Cleanup worker on unmount (do not terminate per-frame anymore)
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
    // User explicitly tapped — now play() will succeed on iOS
    const v = videoRef.current;
    if (v) v.play().catch(() => setCameraError(true));
    setNeedsGesture(false);
    // If camera was already bound but paused, resume; otherwise restart
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
        <button type="button" className="pelican-torch" onClick={() => void toggleTorch()} aria-label="Toggle flash">
          <Flashlight size={16} /> {torchOn ? "Flash on" : "Flash"}
        </button>
      )}

      {/* iOS / blocked camera gate */}
      {needsGesture && (
        <button type="button" className="pelican-tap" onClick={handleGestureTap}>
          <Camera size={22} /> Tap to start camera
        </button>
      )}

      {starting && !needsGesture && !cameraError && (
        <div className="pelican-starting" aria-hidden="true">Starting camera…</div>
      )}

      {/* Always-on low-profile fallback — works on Android Chrome, iOS Safari, desktop, PWA */}
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
