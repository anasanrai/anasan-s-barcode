import { Flashlight, ImageUp } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { extractPelicanNumber, FrameConfirmation } from "@/lib/pelican";

type Props = {
  onDetected: (value: string) => void;
};

async function runOcrFromCanvas(canvas: HTMLCanvasElement): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  // Restrict to digits + Barcodes label chars to improve accuracy
  // tesseract 6 API: worker.recognize(canvas)
  const { data } = await worker.recognize(canvas);
  await worker.terminate();
  return data.text ?? "";
}

async function runOcrFromImageSrc(src: string): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  const { data } = await worker.recognize(src);
  await worker.terminate();
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
  const [cameraError, setCameraError] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
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
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    let cancelled = false;
    confirmRef.current = new FrameConfirmation(2);

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        const track = stream.getVideoTracks()[0];
        const caps2 = (track.getCapabilities?.() as unknown as { torch?: boolean }) ?? {};
        if (caps2?.torch) setTorchSupported(true);

        // sample loop: crop center rectangle and OCR
        timerRef.current = window.setInterval(async () => {
          if (busyRef.current || cancelled) return;
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (!video || !canvas || video.readyState < 2 || video.videoWidth === 0) return;
          busyRef.current = true;
          try {
            const vw = video.videoWidth;
            const vh = video.videoHeight;
            // Scan area: center 68% width, 36% height (matches overlay)
            const sw = vw * 0.68;
            const sh = vh * 0.38;
            const sx = (vw - sw) / 2;
            const sy = (vh - sh) / 2;
            canvas.width = sw;
            canvas.height = sh;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
            // Light preprocessing: upscale for tesseract
            // run OCR on this crop
            const text = await runOcrFromCanvas(canvas);
            const candidate = extractPelicanNumber(text);
            const confirmed = confirmRef.current.push(candidate);
            if (confirmed) {
              stopCamera();
              onDetectedRef.current(confirmed);
            }
            // Do NOT show errors repeatedly; silently keep scanning
          } catch {
            // ignore OCR errors — keep camera open
          } finally {
            busyRef.current = false;
          }
        }, 900);

        // If no detection after 12s, reveal fallback (image upload)
        window.setTimeout(() => {
          if (!cancelled) setShowFallback(true);
        }, 12000);
      } catch {
        if (!cancelled) {
          setCameraError(true);
          setShowFallback(true);
        }
      }
    };

    void start();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [stopCamera]);

  const onImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = URL.createObjectURL(file);
    try {
      const text = await runOcrFromImageSrc(url);
      URL.revokeObjectURL(url);
      const candidate = extractPelicanNumber(text);
      if (candidate) {
        stopCamera();
        onDetected(candidate);
      } else {
        // No auto error spam; show fallback hint after image fail
        setShowFallback(true);
      }
    } catch {
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="pelican-scan">
      <video ref={videoRef} autoPlay muted playsInline className="pelican-video" />
      <canvas ref={canvasRef} className="pelican-canvas" aria-hidden="true" />
      <div className="pelican-overlay" aria-hidden="true">
        <div className="pelican-rect" />
        <p className="pelican-hint">Point at barcode number.</p>
      </div>

      {torchSupported && (
        <button type="button" className="pelican-torch" onClick={() => void toggleTorch()} aria-label="Toggle flash">
          <Flashlight size={18} /> {torchOn ? "Flash on" : "Flash"}
        </button>
      )}

      {showFallback && (
        <div className="pelican-fallback">
          <button type="button" className="button button--secondary pelican-upload" onClick={() => fileInputRef.current?.click()}>
            <ImageUp size={18} /> Upload image
          </button>
          {cameraError && <span className="pelican-fallback__note">Camera unavailable — upload a photo of the Pelican screen.</span>}
          <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={(e) => void onImageSelected(e)} />
        </div>
      )}
    </div>
  );
}
