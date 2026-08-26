import { useCallback, useEffect, useRef, useState } from "react";
import {
  CameraService,
  FrameMotionTracker,
  shouldWaitForFrameMotion,
  shouldWaitForScreenSharpness,
} from "@/services/camera";
import {
  BarcodeGuard,
  selectNumericLinearBarcode,
} from "@/services/barcodeGuard";
import {
  evaluateOcrFrame,
  selectBarcodeAdjacentNumeric,
  selectProminentDisplayNumber,
  StabilityTracker,
  type FrameDecision,
  type OcrTextBlock,
  type ScanState,
} from "@/services/ocrPipeline";
import { NativeTextService } from "@/services/nativeText";
import { BrowserOCRService, type OCRService } from "@/services/ocr";
import type { BarcodeFormat } from "@/services/number";

export type DebugFrame = {
  durationMs: number;
  engineConfidence: number;
  decision: FrameDecision;
  path:
    | "barcode-native"
    | "barcode-adaptive"
    | "native"
    | "ocr-fast"
    | "ocr"
    | "ocr-corrected";
  skipped?: "throttled" | "in-flight";
};

export type CaptureQuality = {
  state: "ready" | "hold" | "soft" | "dim" | "glare";
  label: string;
};

const SCAN_INTERVAL_MS = 900;
const REQUIRED_STABLE_FRAMES = 3;

function stateCopy(
  state: ScanState,
  detail: string,
  stability: number
): { title: string; detail: string } {
  if (state === "confirmed")
    return {
      title: "Number confirmed",
      detail: "Stable across three consecutive frames. Preparing verification.",
    };
  if (state === "candidate")
    return {
      title: "Number detected",
      detail: `${detail} Stable ${Math.min(stability, REQUIRED_STABLE_FRAMES)}/${REQUIRED_STABLE_FRAMES}.`,
    };
  if (state === "multiple")
    return { title: "Multiple numbers detected", detail };
  if (state === "invalid-format") return { title: "Invalid format", detail };
  if (state === "uncertain") return { title: "Uncertain result", detail };
  return { title: "Reading…", detail };
}

interface UseScanLoopOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  cameraService: CameraService;
  isActive: boolean;
  screenMode: boolean;
  immediateCapture: boolean;
  autoCapture: boolean;
  format: BarcodeFormat;
  minLength: number;
  maxLength: number;
  onConfirmed: (value: string, confidence: number) => void;
}

export function useScanLoop(options: UseScanLoopOptions) {
  const {
    videoRef,
    canvasRef,
    cameraService,
    isActive,
    screenMode,
    immediateCapture,
    autoCapture,
    format,
    minLength,
    maxLength,
    onConfirmed,
  } = options;

  const barcodeGuardRef = useRef(new BarcodeGuard());
  const ocrRef = useRef<OCRService>(new BrowserOCRService());
  const nativeTextRef = useRef(new NativeTextService());
  const processingRef = useRef(false);
  const queuedManualCaptureRef = useRef(false);
  const capturedRef = useRef(false);
  const lastScanAtRef = useRef(0);
  const stabilityRef = useRef(
    new StabilityTracker(immediateCapture ? 1 : REQUIRED_STABLE_FRAMES)
  );
  const motionRef = useRef(new FrameMotionTracker(1, 18));

  const [status, setStatus] = useState("Camera ready");
  const [statusKind, setStatusKind] = useState<ScanState>("reading");
  const [detail, setDetail] = useState("Enable the camera to begin local OCR.");
  const [stableCount, setStableCount] = useState(0);
  const [captureQuality, setCaptureQuality] = useState<CaptureQuality>({
    state: "soft",
    label: "ANALYZING LENS",
  });
  const [manualCapturePending, setManualCapturePending] = useState(false);
  const [debugFrame, setDebugFrame] = useState<DebugFrame | null>(null);

  const applyState = useCallback(
    (state: ScanState, nextDetail: string, stability: number) => {
      const copy = stateCopy(state, nextDetail, stability);
      setStatusKind(state);
      setStatus(copy.title);
      setDetail(copy.detail);
      setStableCount(stability);
    },
    []
  );

  const reset = useCallback(() => {
    capturedRef.current = false;
    stabilityRef.current.reset();
    motionRef.current.reset();
    setStableCount(0);
    setCaptureQuality({ state: "hold", label: "HOLD STILL" });
    setDebugFrame(null);
  }, []);

  const scan = useCallback(
    async (force = false) => {
      const now = performance.now();
      if (
        !isActive ||
        capturedRef.current ||
        !videoRef.current ||
        !canvasRef.current
      )
        return;
      if (
        videoRef.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        !videoRef.current.videoWidth
      ) {
        applyState("reading", "Preparing the camera stream…", 0);
        return;
      }
      if (processingRef.current) {
        if (force) {
          queuedManualCaptureRef.current = true;
          setManualCapturePending(true);
        }
        if (import.meta.env.DEV)
          setDebugFrame((current) =>
            current ? { ...current, skipped: "in-flight" } : current
          );
        return;
      }
      const runManualCapture = force || queuedManualCaptureRef.current;
      if (runManualCapture) queuedManualCaptureRef.current = false;
      const scanCooldown = immediateCapture ? 160 : SCAN_INTERVAL_MS;
      if (!runManualCapture && now - lastScanAtRef.current < scanCooldown) {
        if (import.meta.env.DEV)
          setDebugFrame((current) =>
            current ? { ...current, skipped: "throttled" } : current
          );
        return;
      }
      processingRef.current = true;
      lastScanAtRef.current = now;
      const startedAt = performance.now();
      if (runManualCapture) {
        setManualCapturePending(true);
        setCaptureQuality({ state: "ready", label: "CAPTURING" });
      }
      try {
        const frame = cameraService.captureCenteredFrame(
          videoRef.current,
          canvasRef.current,
          screenMode
        );
        if (!frame) return;
        const motion = motionRef.current.observe(frame);
        if (
          shouldWaitForFrameMotion(
            runManualCapture,
            screenMode,
            immediateCapture,
            motion.stable
          )
        ) {
          stabilityRef.current.reset();
          setCaptureQuality((current) =>
            current.state === "hold"
              ? current
              : { state: "hold", label: "HOLD STILL" }
          );
          applyState(
            "reading",
            "Hold the number still inside the frame. The sensor will lock before reading.",
            0
          );
          return;
        }
        if (screenMode) cameraService.normalizeScreenFrame(frame);
        const rawBarcodes = await barcodeGuardRef.current.detect(frame);
        let directBarcode = selectNumericLinearBarcode(
          rawBarcodes,
          minLength,
          maxLength
        );
        let barcodeRegions = rawBarcodes
          .filter(
            (barcode) =>
              barcode.format !== "qr_code" && barcode.format !== "zxing_1d"
          )
          .map((barcode) => barcode.bbox);
        let enhancedFrame: HTMLCanvasElement | null = null;
        let barcodePath: DebugFrame["path"] = "barcode-native";
        if (!directBarcode && !screenMode) {
          enhancedFrame = cameraService.createAdaptiveBarcodeFrame(frame);
          if (enhancedFrame) {
            const enhancedBarcodes = await barcodeGuardRef.current.detect(
              enhancedFrame,
              true
            );
            directBarcode = selectNumericLinearBarcode(
              enhancedBarcodes,
              minLength,
              maxLength
            );
            barcodeRegions = [
              ...barcodeRegions,
              ...enhancedBarcodes
                .filter(
                  (barcode) =>
                    barcode.format !== "qr_code" &&
                    barcode.format !== "zxing_1d"
                )
                .map((barcode) => barcode.bbox),
            ];
            barcodePath = "barcode-adaptive";
          }
        }
        const focusRegion =
          directBarcode?.format === "zxing_1d"
            ? barcodeRegions[0]
            : (directBarcode?.bbox ?? barcodeRegions[0]);
        const quality = cameraService.assessFrameQuality(frame, focusRegion);
        setCaptureQuality((current) =>
          current.state === quality.state && current.label === quality.label
            ? current
            : { state: quality.state, label: quality.label }
        );
        if (!screenMode && !directBarcode && barcodeRegions.length === 0)
          setCaptureQuality((current) =>
            current.state === "hold"
              ? current
              : { state: "hold", label: "ALIGN BARCODE" }
          );
        if (
          screenMode &&
          !immediateCapture &&
          shouldWaitForScreenSharpness(runManualCapture, quality.sharpness)
        ) {
          stabilityRef.current.reset();
          applyState(
            "uncertain",
            "Hold the phone steady. Waiting for the screen number to become sharp.",
            0
          );
          return;
        }
        if (focusRegion && quality.sharpness >= 7)
          void cameraService.freezeFocusWhenSharp();

        const decide = (
          blocks: OcrTextBlock[],
          minimumConfidence?: number
        ): FrameDecision | undefined => {
          const rules = {
            format,
            minLength: screenMode ? Math.max(8, minLength) : minLength,
            maxLength,
            minimumConfidence,
          };
          if (barcodeRegions.length > 0)
            return selectBarcodeAdjacentNumeric(blocks, barcodeRegions, rules);
          if (screenMode) return selectProminentDisplayNumber(blocks, rules);
          return evaluateOcrFrame(blocks, rules);
        };

        let path: DebugFrame["path"] = directBarcode ? barcodePath : "ocr";
        let recognized = {
          blocks: [] as OcrTextBlock[],
          engineConfidence: directBarcode ? 100 : 0,
        };
        let decision: FrameDecision | undefined;

        if (directBarcode) {
          const width = Math.max(
            1,
            directBarcode.bbox.x1 - directBarcode.bbox.x0
          );
          const height = Math.max(
            1,
            directBarcode.bbox.y1 - directBarcode.bbox.y0
          );
          decision = {
            state: "candidate",
            detail: "Barcode decoded locally. Preparing Code 128.",
            candidate: {
              value: directBarcode.value,
              confidence: 100,
              area: width * height,
              bbox: directBarcode.bbox,
            },
            blocks: [],
          };
        } else {
          const ocrFrame = enhancedFrame ?? frame;
          recognized = {
            blocks: await nativeTextRef.current.detect(ocrFrame),
            engineConfidence: 100,
          };
          decision = recognized.blocks.length
            ? decide(recognized.blocks)
            : undefined;
          if (!decision?.candidate) {
            const fastScreenFrame = screenMode
              ? cameraService.createFastScreenFrame(ocrFrame)
              : null;
            if (fastScreenFrame) {
              applyState(
                "reading",
                "Reading the centered number line locally…",
                0
              );
              recognized = await ocrRef.current.recognizeFastScreen(
                fastScreenFrame,
                { includeSeparatedNumericWords: true }
              );
              decision = decide(recognized.blocks);
              if (decision?.candidate) path = "ocr-fast";
            }
            if (!decision?.candidate) {
              recognized = await ocrRef.current.recognize(ocrFrame, {
                includeSeparatedNumericWords: screenMode,
              });
              decision = decide(recognized.blocks);
            }
          } else {
            path = "native";
          }
        }
        if (runManualCapture && screenMode && !decision?.candidate) {
          const corrected = cameraService.rotateFrame(frame, 25);
          if (corrected) {
            applyState(
              "reading",
              "Correcting the screen angle and reading the current frame…",
              0
            );
            recognized = await ocrRef.current.recognize(corrected, {
              includeSeparatedNumericWords: true,
            });
            decision = decide(recognized.blocks, 30);
            path = "ocr-corrected";
          }
        }
        const stability =
          decision?.state === "candidate" && decision.candidate
            ? stabilityRef.current.observe(decision.candidate)
            : stabilityRef.current.reset();
        const finalState: ScanState = stability.confirmed
          ? "confirmed"
          : (decision?.state ?? "uncertain");
        applyState(finalState, decision?.detail ?? "Uncertain result.", stability.count);
        if (import.meta.env.DEV && decision) {
          setDebugFrame({
            durationMs: Math.round(performance.now() - startedAt),
            engineConfidence: Math.round(recognized.engineConfidence),
            decision,
            path,
          });
        }
        if (
          stability.confirmed &&
          decision?.candidate &&
          autoCapture &&
          !capturedRef.current
        ) {
          capturedRef.current = true;
          cameraService.stop();
          navigator.vibrate?.(32);
          window.setTimeout(
            () => onConfirmed(decision.candidate!.value, decision.candidate!.confidence),
            immediateCapture ? 0 : 180
          );
        }
      } catch (error) {
        stabilityRef.current.reset();
        motionRef.current.reset();
        applyState(
          "uncertain",
          "Local OCR is starting or could not read this frame. Keep the number still and sharp.",
          0
        );
        if (import.meta.env.DEV)
          console.debug("[Number to Barcode OCR] frame failed", error);
      } finally {
        processingRef.current = false;
        if (runManualCapture) setManualCapturePending(false);
      }
    },
    [
      applyState,
      autoCapture,
      cameraService,
      canvasRef,
      format,
      immediateCapture,
      isActive,
      maxLength,
      minLength,
      onConfirmed,
      screenMode,
      videoRef,
    ]
  );

  // Initialize OCR and barcode fallback on mount
  useEffect(() => {
    void barcodeGuardRef.current.warmFallback();
    return () => {
      void ocrRef.current.dispose();
    };
  }, []);

  // Run scan loop
  useEffect(() => {
    if (!isActive || !videoRef.current) return;
    const video = videoRef.current;
    if ("requestVideoFrameCallback" in video) {
      let frameHandle = 0;
      const onFrame = () => {
        void scan();
        frameHandle = video.requestVideoFrameCallback(onFrame);
      };
      frameHandle = video.requestVideoFrameCallback(onFrame);
      return () => video.cancelVideoFrameCallback(frameHandle);
    }
    const interval = window.setInterval(
      () => void scan(),
      immediateCapture ? 120 : 320
    );
    return () => window.clearInterval(interval);
  }, [immediateCapture, isActive, scan, videoRef]);

  return {
    status,
    statusKind,
    detail,
    stableCount,
    captureQuality,
    manualCapturePending,
    debugFrame,
    scan,
    reset,
  };
}
