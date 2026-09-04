import { Copy, Check, Flashlight, RefreshCw, Sparkles, X, Sun, Moon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { detectBarcodeFormat, extractPelicanNumber, validateBarcode } from "@/lib/pelican";
import { validateBarcodeString } from "@/lib/scanner/barcodeValidation";
import { playSuccessTone } from "@/lib/scanner/audioFeedback";
import { useLang } from "@/lib/i18n";
import BarcodePreview from "./BarcodePreview";
import { evaluateFrameQuality } from "@/lib/scanner/frameQuality";
import { recognizeNumericTarget } from "@/lib/scanner/numericOcr";
import { TemporalConsensusEngine } from "@/lib/scanner/temporalConsensus";
import type { FrameQualityMetrics, PreprocessPass, ScannerStatus } from "@/lib/scanner/types";

type Props = {
  onDetected: (value: string) => void;
};

export default function PelicanScanner({ onDetected }: Props) {
  const { lang, t } = useLang();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const busyRef = useRef(false);
  const consensusEngineRef = useRef<TemporalConsensusEngine>(new TemporalConsensusEngine());
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const [status, setStatus] = useState<ScannerStatus>("STARTING");
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [candidateLive, setCandidateLive] = useState<string | null>(null);
  const [guidance, setGuidance] = useState<string | null>(null);

  const activeLoopRef = useRef(false);
  const animIdRef = useRef<number | null>(null);
  const rvfcIdRef = useRef<number | null>(null);
  const lastProcessTimeRef = useRef(0);

  const stopCamera = useCallback(() => {
    activeLoopRef.current = false;
    busyRef.current = false;
    if (animIdRef.current !== null) {
      window.cancelAnimationFrame(animIdRef.current);
      animIdRef.current = null;
    }
    const v = videoRef.current;
    if (v && "cancelVideoFrameCallback" in v && rvfcIdRef.current !== null) {
      (v as any).cancelVideoFrameCallback(rvfcIdRef.current);
      rvfcIdRef.current = null;
    }
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
   * Crop center ROI from active video feed directly into a compact 480x160 canvas.
   * Target ROI is a horizontal card-scanner bounding box (80% width x 28% height).
   */
  const captureRoiCanvas = useCallback((): { canvas: HTMLCanvasElement; quality: FrameQualityMetrics } | null => {
    const v = videoRef.current;
    if (!v || v.readyState < 2 || v.videoWidth === 0) return null;

    const vw = v.videoWidth;
    const vh = v.videoHeight;
    const sw = Math.round(vw * 0.82);
    const sh = Math.round(vh * 0.28);
    const sx = Math.round((vw - sw) / 2);
    const sy = Math.round((vh - sh) / 2);

    const targetW = 480;
    const targetH = 160;

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

      // Trigger instant sound chime & haptic feedback on match
      playSuccessTone();
      try {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate([40, 30, 40]);
        }
      } catch {}
    },
    [stopCamera],
  );

  /**
   * Continuous banking-card style scanning engine loop
   */
  const startScanningLoop = useCallback(() => {
    activeLoopRef.current = false;
    if (animIdRef.current !== null) {
      window.cancelAnimationFrame(animIdRef.current);
      animIdRef.current = null;
    }

    consensusEngineRef.current.reset();
    setStatus("SEARCHING");
    activeLoopRef.current = true;
    lastProcessTimeRef.current = 0;
    busyRef.current = false;

    const MIN_INTERVAL_MS = 35; // ~28 fps continuous scan loop

    const processFrame = async () => {
      if (!activeLoopRef.current) return;

      const now = performance.now();
      if (!busyRef.current && now - lastProcessTimeRef.current >= MIN_INTERVAL_MS) {
        lastProcessTimeRef.current = now;

        const frameData = captureRoiCanvas();
        if (frameData) {
          const { canvas, quality } = frameData;
          setGuidance(quality.guidance ?? null);

          // If frame has extreme motion blur or pitch black, skip OCR to save battery
          if (!quality.isAcceptable && quality.guidance === "LOW_LIGHT" && quality.brightness < 12) {
            // Wait for better frame
          } else {
            busyRef.current = true;
            try {
              let pass: PreprocessPass = "standard";
              if (quality.glareRatio > 0.25) {
                pass = "glare_mitigation";
              } else if (quality.contrast < 24 && quality.brightness < 120) {
                pass = "adaptive_binarize";
              } else if (quality.brightness < 70 && quality.contrast > 35) {
                pass = "inverted";
              }

              const candidate = await recognizeNumericTarget(canvas, { pass, timeoutMs: 400 });

              if (candidate && activeLoopRef.current) {
                setStatus("CANDIDATE_DETECTED");
                setCandidateLive(candidate.value);
              }

              const locked = consensusEngineRef.current.push(candidate, quality.sharpness);

              if (locked && (validateBarcodeString(locked).valid || validateBarcode(locked).valid)) {
                handleConfirmedMatch(locked);
                return;
              }
            } catch {
              // Ignore frame errors and continue next frame
            } finally {
              busyRef.current = false;
            }
          }
        }
      }

      if (activeLoopRef.current) {
        scheduleNext();
      }
    };

    const scheduleNext = () => {
      if (!activeLoopRef.current) return;
      const v = videoRef.current;
      if (v && "requestVideoFrameCallback" in v) {
        rvfcIdRef.current = (v as any).requestVideoFrameCallback(processFrame);
      } else {
        animIdRef.current = window.requestAnimationFrame(processFrame);
      }
    };

    scheduleNext();
  }, [captureRoiCanvas, handleConfirmedMatch]);

  const startCamera = useCallback(async () => {
    setCameraError(false);
    setNeedsGesture(false);
    setStatus("STARTING");
    setScannedBarcode(null);
    setCandidateLive(null);
    setGuidance(null);
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
      }, 300);

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
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="pelican-scanner-view relative w-full h-full flex flex-col bg-black text-white overflow-hidden select-none">
      {/* ── Background Live Video ───────────────────────────────────────── */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        playsInline
        muted
        autoPlay
      />

      {/* ── Top Floating Flashlight / Actions ───────────────────────────── */}
      <div className="relative z-20 flex items-center justify-between p-4 pt-3 pointer-events-auto">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-black/60 backdrop-blur-md border border-white/10 text-white">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {lang === "ar" ? "ماسح البطاقات الفوري" : "Instant Card Scanner"}
          </span>
        </div>

        {torchSupported && (
          <button
            type="button"
            className={`p-2.5 rounded-full transition-all backdrop-blur-md border ${
              torchOn
                ? "bg-amber-500 text-black border-amber-400 shadow-lg shadow-amber-500/30"
                : "bg-black/60 text-white/80 border-white/15 active:scale-95"
            }`}
            onClick={toggleTorch}
            aria-label="Toggle Flashlight"
          >
            <Flashlight size={18} />
          </button>
        )}
      </div>

      {/* ── Center Banking-Card Viewfinder ─────────────────────────────── */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pointer-events-none">
        <div className="relative w-full max-w-[340px] aspect-[3.2/1] rounded-2xl border border-white/20 bg-black/10 backdrop-blur-[2px] shadow-2xl overflow-hidden">
          {/* Card Frame Glowing Corners */}
          <div className="absolute -top-[1px] -left-[1px] w-6 h-6 border-t-2 border-l-2 border-[#FF7A18] rounded-tl-xl" />
          <div className="absolute -top-[1px] -right-[1px] w-6 h-6 border-t-2 border-r-2 border-[#FF7A18] rounded-tr-xl" />
          <div className="absolute -bottom-[1px] -left-[1px] w-6 h-6 border-b-2 border-l-2 border-[#FF7A18] rounded-bl-xl" />
          <div className="absolute -bottom-[1px] -right-[1px] w-6 h-6 border-b-2 border-r-2 border-[#FF7A18] rounded-br-xl" />

          {/* Sweeping Laser Line Animation */}
          {status !== "CONFIRMED" && (
            <div className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#FF7A18] to-transparent shadow-[0_0_12px_#FF7A18] animate-scan-laser" />
          )}

          {/* Center Target Crosshair Grid */}
          <div className="absolute inset-0 flex items-center justify-center opacity-30">
            <div className="w-8 h-[1px] bg-white/40" />
            <div className="h-8 w-[1px] bg-white/40" />
          </div>

          {/* Live Candidate Detection Pill */}
          {candidateLive && status !== "CONFIRMED" && (
            <div className="absolute bottom-2 inset-x-0 flex justify-center">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#FF7A18]/90 text-white tracking-wider backdrop-blur-sm shadow-md animate-fade-in">
                {candidateLive}
              </span>
            </div>
          )}
        </div>

        {/* Guidance / Status Text */}
        <div className="mt-4 flex flex-col items-center gap-1 text-center">
          <p className="text-xs font-medium text-white/90 drop-shadow-md">
            {lang === "ar" ? "وجه الكاميرا نحو الرقم للتعرف الفوري" : "Align number inside box to scan instantly"}
          </p>
          {guidance && (
            <p className="text-[11px] text-amber-300 font-medium drop-shadow-sm">
              {guidance === "LOW_LIGHT"
                ? lang === "ar"
                  ? "إضاءة منخفضة - قرب الكاميرا أو شغل الفلاش"
                  : "Low light - move closer or enable torch"
                : guidance === "BLURRY"
                  ? lang === "ar"
                    ? "ثبت الكاميرا قليلاً"
                    : "Hold steady"
                  : ""}
            </p>
          )}
        </div>
      </div>

      {/* ── Permission / Error Banner ──────────────────────────────────── */}
      {needsGesture && (
        <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-[#FF7A18]/20 flex items-center justify-center text-[#FF7A18] mb-3">
            <RefreshCw size={24} className="animate-spin" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">
            {lang === "ar" ? "إذن الكاميرا مطلوب" : "Camera Access Required"}
          </h3>
          <p className="text-xs text-white/70 max-w-xs mb-4">
            {lang === "ar"
              ? "يرجى الضغط لبدء الكاميرا والموافقة على إذن التصوير"
              : "Tap below to initialize live camera scanning"}
          </p>
          <button
            type="button"
            className="px-5 py-2.5 rounded-xl font-bold text-sm bg-[#FF7A18] text-white shadow-lg active:scale-95 transition-all"
            onClick={startCamera}
          >
            {lang === "ar" ? "تشغيل الكاميرا" : "Start Camera"}
          </button>
        </div>
      )}

      {cameraError && !needsGesture && (
        <div className="absolute inset-0 z-30 bg-black/90 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 mb-3">
            <X size={24} />
          </div>
          <h3 className="text-base font-bold text-white mb-1">
            {lang === "ar" ? "تعذر فتح الكاميرا" : "Camera Unavailable"}
          </h3>
          <p className="text-xs text-white/70 max-w-xs mb-4">
            {lang === "ar"
              ? "تأكد من منح صلاحية الكاميرا من إعدادات التطبيق"
              : "Please check camera permissions in your device settings"}
          </p>
          <button
            type="button"
            className="px-5 py-2.5 rounded-xl font-bold text-sm bg-white/15 text-white active:scale-95 transition-all"
            onClick={startCamera}
          >
            {lang === "ar" ? "إعادة المحاولة" : "Try Again"}
          </button>
        </div>
      )}

      {/* ── Instant Scanned Barcode Card Modal ──────────────────────────── */}
      {scannedBarcode && (
        <div className="absolute inset-0 z-40 bg-black/85 backdrop-blur-lg flex flex-col items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-neutral-900 border border-white/15 shadow-2xl p-5 flex flex-col items-center">
            {/* Header / Success Pill */}
            <div className="flex items-center justify-between w-full mb-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Sparkles size={12} />
                {lang === "ar" ? "تم التعرف بنجاح" : "Scanned Instantly"}
              </span>
              <span className="text-xs font-mono text-white/50">
                {detectBarcodeFormat(scannedBarcode)}
              </span>
            </div>

            {/* Generated Vector Barcode View */}
            <div className="w-full bg-white rounded-2xl p-4 shadow-inner flex flex-col items-center justify-center my-2">
              <BarcodePreview
                value={scannedBarcode}
                format={detectBarcodeFormat(scannedBarcode)}
                onError={() => {}}
                showActions={false}
              />
            </div>

            {/* Scanned Number Display & Copy Button */}
            <div className="w-full mt-3 flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/10">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold tracking-wider text-white/50">
                  {lang === "ar" ? "الرقم المقروء" : "Scanned Value"}
                </span>
                <span className="text-sm font-mono font-bold text-white tracking-wider">
                  {scannedBarcode}
                </span>
              </div>
              <button
                type="button"
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all"
                onClick={handleCopy}
                aria-label="Copy barcode number"
              >
                {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
              </button>
            </div>

            {/* Scan Next / Action Buttons */}
            <div className="w-full mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-[#FF7A18] text-white flex items-center justify-center gap-2 shadow-lg shadow-[#FF7A18]/25 active:scale-95 transition-all"
                onClick={handleScanNext}
              >
                <RefreshCw size={16} />
                <span>{lang === "ar" ? "مسح رقم آخر" : "Scan Next"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
