import { Activity, Copy, Check, Flashlight, ImageUp, Camera, RefreshCw, Share2, Sparkles, X, Sun, Moon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { detectBarcodeFormat, extractPelicanNumber, validateBarcode } from "@/lib/pelican";
import { useLang } from "@/lib/i18n";
import BarcodePreview from "./BarcodePreview";
import { evaluateFrameQuality } from "@/lib/scanner/frameQuality";
import { exportBarcodeDataUrl } from "@/lib/scanner/barcodeEngine";
import { recognizeNumericTarget } from "@/lib/scanner/numericOcr";
import { TemporalConsensusEngine } from "@/lib/scanner/temporalConsensus";
import type { FrameQualityMetrics, PreprocessPass, ScannerStatus, ScannerTelemetry } from "@/lib/scanner/types";

type Props = {
  onDetected: (value: string) => void;
  showDebugByDefault?: boolean;
};

export default function PelicanScanner({ onDetected, showDebugByDefault = false }: Props) {
  const { t } = useLang();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const busyRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const consensusEngineRef = useRef<TemporalConsensusEngine>(new TemporalConsensusEngine());
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  // Frame timing & FPS tracking
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(Date.now());
  const currentFpsRef = useRef(0);

  const [status, setStatus] = useState<ScannerStatus>("STARTING");
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [guidance, setGuidance] = useState<FrameQualityMetrics["guidance"]>(null);
  const [candidateLive, setCandidateLive] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(showDebugByDefault);
  const [maxBrightness, setMaxBrightness] = useState(false);

  const [telemetry, setTelemetry] = useState<ScannerTelemetry>({
    fps: 0,
    frameProcessingMs: 0,
    ocrMs: 0,
    totalPipelineMs: 0,
    lastSharpness: 0,
    lastBrightness: 0,
    status: "STARTING",
    detectedCandidate: null,
    activePass: "standard",
  });

  const stopCamera = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((trk) => trk.stop());
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
      await track.applyConstraints({
        advanced: [{ torch: !torchOn } as unknown as MediaTrackConstraintSet],
      });
      setTorchOn((v) => !v);
    } catch {}
  };

  /**
   * Crop ROI from the active video feed directly into a reusable canvas.
   * Target ROI is centered at 78% width and 42% height of the viewfinder.
   */
  const captureRoiCanvas = useCallback((): { canvas: HTMLCanvasElement; quality: FrameQualityMetrics } | null => {
    const v = videoRef.current;
    if (!v || v.readyState < 2 || v.videoWidth === 0) return null;

    const vw = v.videoWidth;
    const vh = v.videoHeight;
    const sw = Math.round(vw * 0.78);
    const sh = Math.round(vh * 0.42);
    const sx = Math.round((vw - sw) / 2);
    const sy = Math.round((vh - sh) / 2);

    const targetW = 640;
    const targetH = Math.round((targetW * sh) / sw);

    let off = cropCanvasRef.current;
    if (!off) {
      off = document.createElement("canvas");
      cropCanvasRef.current = off;
    }
    if (off.width !== targetW || off.height !== targetH) {
      off.width = targetW;
      off.height = targetH;
    }

    const ctx = off.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(v, sx, sy, sw, sh, 0, 0, targetW, targetH);

    const imgData = ctx.getImageData(0, 0, targetW, targetH);
    const quality = evaluateFrameQuality(imgData.data, targetW, targetH, 2);

    return { canvas: off, quality };
  }, []);

  const handleConfirmedMatch = useCallback(
    (cand: string) => {
      stopCamera();
      setStatus("CONFIRMED");
      setScannedBarcode(cand);
      onDetectedRef.current(cand);

      // Trigger subtle haptic buzz if supported by device
      try {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate([40, 30, 40]);
        }
      } catch {}
    },
    [stopCamera],
  );

  /**
   * Main adaptive scanning engine loop
   */
  const startScanningLoop = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);

    consensusEngineRef.current.reset();
    setStatus("SEARCHING");

    timerRef.current = window.setInterval(async () => {
      if (busyRef.current) return;

      // Track FPS
      frameCountRef.current += 1;
      const now = Date.now();
      if (now - lastFpsTimeRef.current >= 1000) {
        currentFpsRef.current = Math.round((frameCountRef.current * 1000) / (now - lastFpsTimeRef.current));
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;
      }

      const frameData = captureRoiCanvas();
      if (!frameData) return;

      const { canvas, quality } = frameData;
      setGuidance(quality.guidance ?? null);

      // If frame is severely out of focus / dark, skip heavy OCR computation
      if (!quality.isAcceptable && quality.guidance === "LOW_LIGHT" && quality.brightness < 18) {
        setTelemetry((prev) => ({
          ...prev,
          fps: currentFpsRef.current,
          lastSharpness: quality.sharpness,
          lastBrightness: quality.brightness,
          status: "SEARCHING",
        }));
        return;
      }

      busyRef.current = true;
      const t0 = performance.now();

      try {
        // Select adaptive preprocessing pass based on optical conditions
        let pass: PreprocessPass = "standard";
        if (quality.glareRatio > 0.25) {
          pass = "glare_mitigation";
        } else if (quality.contrast < 22 && quality.brightness < 120) {
          pass = "adaptive_binarize";
        } else if (quality.brightness < 80 && quality.contrast > 35) {
          pass = "inverted";
        }

        const candidate = await recognizeNumericTarget(canvas, { pass });
        const ocrTime = Math.round(performance.now() - t0);

        if (candidate) {
          setStatus("CANDIDATE_DETECTED");
          setCandidateLive(candidate.value);
        }

        const locked = consensusEngineRef.current.push(candidate, quality.sharpness);
        const totalPipelineTime = Math.round(performance.now() - t0);

        setTelemetry({
          fps: currentFpsRef.current,
          frameProcessingMs: Math.round(t0 - now),
          ocrMs: ocrTime,
          totalPipelineMs: totalPipelineTime,
          lastSharpness: quality.sharpness,
          lastBrightness: quality.brightness,
          status: locked ? "CONFIRMED" : candidate ? "CANDIDATE_DETECTED" : "SEARCHING",
          detectedCandidate: candidate?.value ?? null,
          activePass: pass,
        });

        if (locked && validateBarcode(locked).valid) {
          handleConfirmedMatch(locked);
        }
      } catch {} finally {
        busyRef.current = false;
      }
    }, 80);
  }, [captureRoiCanvas, handleConfirmedMatch]);

  const startCamera = useCallback(async () => {
    setCameraError(false);
    setNeedsGesture(false);
    setStatus("STARTING");
    setScannedBarcode(null);
    setCandidateLive(null);
    stopCamera();

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(true);
      setStatus("ERROR");
      return;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
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
        return;
      }

      window.setTimeout(() => {
        if (video.paused) setNeedsGesture(true);
      }, 400);

      const track = stream.getVideoTracks()[0];
      const caps = (track.getCapabilities?.() as unknown as { torch?: boolean }) ?? {};
      if (caps?.torch) setTorchSupported(true);

      startScanningLoop();
    } catch (err) {
      const name = (err as DOMException)?.name ?? "";
      if (name === "NotAllowedError") setNeedsGesture(true);
      else setCameraError(true);
      setStatus("ERROR");
    }
  }, [stopCamera, startScanningLoop]);

  useEffect(() => {
    void startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const handleScanNext = () => {
    setScannedBarcode(null);
    setCandidateLive(null);
    setCopied(false);
    void startCamera();
  };

  const handleCopy = async () => {
    if (!scannedBarcode) return;
    try {
      await navigator.clipboard.writeText(scannedBarcode);
      setCopied(true);
      toast.success(t.copied);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleShare = async () => {
    if (!scannedBarcode) return;
    const format = detectBarcodeFormat(scannedBarcode);
    const dataUrl = exportBarcodeDataUrl(scannedBarcode, format);

    if (navigator.share && dataUrl) {
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `barcode-${scannedBarcode}.png`, { type: "image/png" });
        await navigator.share({
          title: `Barcode ${scannedBarcode}`,
          text: scannedBarcode,
          files: [file],
        });
        return;
      } catch {}
    }

    if (dataUrl) {
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `barcode-${scannedBarcode}.png`;
      a.click();
      toast.success("Barcode image downloaded");
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;

    try {
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("Image load failed"));
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const cand = await recognizeNumericTarget(canvas, { strict: false });
        if (cand && validateBarcode(cand.value).valid) {
          handleConfirmedMatch(cand.value);
        } else {
          toast.error("No numeric barcode recognized in photo");
        }
      }
    } catch {
      toast.error("Failed to process image");
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className={`pelican-scan ${maxBrightness ? "pelican-scan--max-bright" : ""}`}>
      {/* Live camera stream */}
      <video ref={videoRef} autoPlay muted playsInline className="pelican-video" />

      {/* Viewfinder HUD */}
      {!scannedBarcode && (
        <>
          <div className="pelican-overlay" aria-hidden="true">
            <div className={`pelican-rect ${candidateLive ? "pelican-rect--candidate" : ""}`}>
              <div className="pelican-rect__corner pelican-rect__corner--tl" />
              <div className="pelican-rect__corner pelican-rect__corner--tr" />
              <div className="pelican-rect__corner pelican-rect__corner--bl" />
              <div className="pelican-rect__corner pelican-rect__corner--br" />
              <div className="pelican-rect__laser" />
            </div>

            <div className="pelican-hud-status">
              <span className={`pelican-hud-badge pelican-hud-badge--${status.toLowerCase()}`}>
                <span className="pelican-hud-dot" />
                {status === "CANDIDATE_DETECTED" ? t.lockingLive : status === "SEARCHING" ? t.scanningLive : t.startingCamera}
              </span>

              {guidance && (
                <span className="pelican-guidance-pill">
                  {guidance === "LOW_LIGHT" && t.guidanceLowLight}
                  {guidance === "GLARE" && t.guidanceGlare}
                  {guidance === "BLURRY" && t.guidanceBlurry}
                  {guidance === "TOO_BRIGHT" && t.guidanceTooBright}
                </span>
              )}
            </div>
          </div>

          {/* Quick Controls Bar */}
          <div className="pelican-controls-bar">
            {torchSupported && !needsGesture && (
              <button
                type="button"
                className={`pelican-ctrl-btn ${torchOn ? "pelican-ctrl-btn--active" : ""}`}
                onClick={() => void toggleTorch()}
                aria-label="Toggle flash"
              >
                <Flashlight size={18} />
                <span>{torchOn ? t.flashOn : t.flashOff}</span>
              </button>
            )}

            <button
              type="button"
              className={`pelican-ctrl-btn ${showDebug ? "pelican-ctrl-btn--active" : ""}`}
              onClick={() => setShowDebug((v) => !v)}
              aria-label="Toggle diagnostics"
            >
              <Activity size={18} />
              <span>{t.debugTelemetry}</span>
            </button>

            <button
              type="button"
              className="pelican-ctrl-btn"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Upload photo"
            >
              <ImageUp size={18} />
              <span>{t.uploadImage}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => void handleImageUpload(e)}
            />
          </div>

          {/* Diagnostics / Telemetry Overlay */}
          {showDebug && (
            <div className="pelican-debug-hud">
              <div className="pelican-debug-hud__title">
                <Activity size={13} />
                <span>Real-Time Engine Telemetry</span>
              </div>
              <div className="pelican-debug-hud__grid">
                <div>FPS: <b>{telemetry.fps}</b></div>
                <div>OCR Latency: <b>{telemetry.ocrMs}ms</b></div>
                <div>Pipeline: <b>{telemetry.totalPipelineMs}ms</b></div>
                <div>Sharpness: <b>{telemetry.lastSharpness}</b></div>
                <div>Luma: <b>{telemetry.lastBrightness}</b></div>
                <div>Pass: <b>{telemetry.activePass}</b></div>
              </div>
              {telemetry.detectedCandidate && (
                <div className="pelican-debug-hud__cand">
                  Candidate: <code>{telemetry.detectedCandidate}</code>
                </div>
              )}
            </div>
          )}

          {/* Camera Permission Gesture Modal */}
          {needsGesture && (
            <div className="pelican-modal-card">
              <Camera size={32} className="text-amber-400 mb-2" />
              <h3>Camera Access</h3>
              <p>Please allow camera permission to begin scanning.</p>
              <button
                type="button"
                className="button button--primary w-full mt-3"
                onClick={() => void startCamera()}
              >
                {t.tapToStart}
              </button>
            </div>
          )}

          {cameraError && (
            <div className="pelican-modal-card">
              <Camera size={32} className="text-rose-400 mb-2" />
              <h3>Camera Unavailable</h3>
              <p>{t.cameraUnavailable}</p>
              <button
                type="button"
                className="button button--secondary w-full mt-3"
                onClick={() => fileInputRef.current?.click()}
              >
                {t.uploadImage}
              </button>
            </div>
          )}
        </>
      )}

      {/* Production Full-Screen Barcode Result Modal */}
      {scannedBarcode && (
        <div className="scanner-result-overlay" role="dialog" aria-label={t.scanResult}>
          <div className="scanner-result-card">
            <div className="scanner-result-card__header">
              <div className="scanner-result-card__badge-row">
                <span className="scanner-result-card__badge">
                  <Sparkles size={13} /> {t.scanResult}
                </span>
                <span className="scanner-result-card__format">
                  {detectBarcodeFormat(scannedBarcode)}
                </span>
              </div>
              <button
                type="button"
                className="scanner-result-card__close"
                onClick={handleScanNext}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Formatted readable digits */}
            <div className="scanner-result-digits">
              <code>{scannedBarcode}</code>
            </div>

            {/* High-contrast generated barcode image */}
            <div className="scanner-result-card__barcode">
              <BarcodePreview
                value={scannedBarcode}
                format={detectBarcodeFormat(scannedBarcode)}
                onError={() => {}}
              />
            </div>

            {/* Quick Actions */}
            <div className="scanner-result-actions">
              <button
                type="button"
                className="button button--primary scanner-result-btn scanner-result-btn--next"
                onClick={handleScanNext}
              >
                <RefreshCw size={18} />
                <span>{t.scanNext}</span>
              </button>

              <div className="scanner-result-secondary-actions">
                <button
                  type="button"
                  className="button button--secondary scanner-result-btn"
                  onClick={() => void handleCopy()}
                >
                  {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                  <span>{copied ? t.copied : t.copyNumber}</span>
                </button>

                <button
                  type="button"
                  className="button button--secondary scanner-result-btn"
                  onClick={() => void handleShare()}
                >
                  <Share2 size={16} />
                  <span>{t.shareBarcode}</span>
                </button>

                <button
                  type="button"
                  className={`button button--secondary scanner-result-btn ${maxBrightness ? "button--active" : ""}`}
                  onClick={() => setMaxBrightness((v) => !v)}
                  aria-label="Toggle max brightness"
                >
                  {maxBrightness ? <Sun size={16} /> : <Moon size={16} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
