/** Signal Field design system: explicit permission recovery and compact touch controls make the camera stage dependable on real mobile browsers. */
/* Signal Field scanner: preserve a one-action mobile flow while exposing only actionable capture quality and OCR state. */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Aperture,
  Bug,
  Camera,
  Flashlight,
  ImagePlus,
  RefreshCcw,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  X,
  ZoomIn,
} from "lucide-react";
import "./ocr-audit.css";
import "./mobile-camera.css";
import "./direct-camera.css";
import {
  CameraAccessError,
  CameraService,
  FrameMotionTracker,
  shouldWaitForFrameMotion,
  shouldWaitForScreenSharpness,
  type CameraAccessIssue,
  type CameraRuntimeDiagnostics,
} from "@/services/camera";
import {
  BarcodeGuard,
  selectNumericLinearBarcode,
} from "@/services/barcodeGuard";
import {
  cleanNumberInput,
  type BarcodeFormat,
  validateNumber,
} from "@/services/number";
import { BrowserOCRService, type OCRService } from "@/services/ocr";
import { NativeTextService } from "@/services/nativeText";
import InstallAppControl from "@/components/InstallAppControl";
import {
  evaluateOcrFrame,
  selectBarcodeAdjacentNumeric,
  selectProminentDisplayNumber,
  selectVerifiedPhotoOrderNumber,
  StabilityTracker,
  type FrameDecision,
  type OcrTextBlock,
  type ScanState,
} from "@/services/ocrPipeline";

type CameraStageProps = {
  simpleMode?: boolean;
  screenMode?: boolean;
  immediateCapture?: boolean;
  minLength: number;
  maxLength: number;
  autoCapture: boolean;
  highContrast: boolean;
  invert: boolean;
  format: BarcodeFormat;
  onCancel: () => void;
  onConfirmed: (value: string, confidence: number) => void;
  onManualEntry: (value: string) => void;
};
type DebugFrame = {
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
type AccessState = "ready" | "requesting" | "active" | CameraAccessIssue;
type CaptureQuality = {
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

function permissionCopy(access: AccessState): {
  eyebrow: string;
  title: string;
  message: string;
  action: string;
  help: string;
} {
  if (access === "requesting")
    return {
      eyebrow: "Requesting access",
      title: "Opening camera…",
      message:
        "Your device may show a permission prompt. Choose Allow to scan numbers.",
      action: "Opening…",
      help: "Camera images stay on this device.",
    };
  if (access === "denied")
    return {
      eyebrow: "Permission needed",
      title: "Allow camera access",
      message:
        "Your browser blocked the camera. Choose Allow when prompted, or enable camera access in this site’s browser settings.",
      action: "Try Again",
      help: "If the browser does not prompt again, change the site permission and return here.",
    };
  if (access === "overlay")
    return {
      eyebrow: "Android security check",
      title: "Close overlays before allowing camera",
      message:
        "Android blocked the camera prompt because another app is drawing over the screen. Close chat bubbles, screen recorders, floating tools, or accessibility overlays, then continue.",
      action: "I Closed Overlays",
      help: "Android will show the camera permission prompt only after those overlays are gone.",
    };
  if (access === "busy")
    return {
      eyebrow: "Camera in use",
      title: "Close the other camera app",
      message:
        "Another application or browser tab is using the camera. Close it, then retry.",
      action: "Try Again",
      help: "Only one application can use some mobile cameras at a time.",
    };
  if (access === "unavailable")
    return {
      eyebrow: "Camera stream unavailable",
      title: "Stream unavailable",
      message:
        "This browser has no accessible camera stream. Capture or import a screen photo, or enter the number below.",
      action: "Try Again",
      help: "Use Photo to capture a screen or select an existing image from this device.",
    };
  if (access === "insecure")
    return {
      eyebrow: "Secure connection required",
      title: "Open this over HTTPS",
      message: "Browsers allow camera access only on a secure connection.",
      action: "Check Again",
      help: "Use the secure application URL rather than a downloaded or plain-http copy.",
    };
  if (access === "constraints")
    return {
      eyebrow: "Camera settings",
      title: "Use a different camera",
      message:
        "The preferred rear camera settings were unavailable. The app will retry with basic camera settings.",
      action: "Retry Camera",
      help: "You can switch cameras once the preview opens.",
    };
  if (access === "host")
    return {
      eyebrow: "Preview limitation",
      title: "Camera is blocked in this preview",
      message:
        "This embedded preview browser is not allowed to open your mobile camera. Use the published app link in Chrome or Safari, then choose Allow.",
      action: "Retry Here",
      help: "The code can request a stream only when the host browser permits camera access.",
    };
  if (access === "unknown")
    return {
      eyebrow: "Camera error",
      title: "Could not start the camera",
      message:
        "Retry access, or continue with manual entry while you check the browser permissions.",
      action: "Try Again",
      help: "No images were captured or uploaded.",
    };
  return {
    eyebrow: "Camera access",
    title: "Ready to scan",
    message:
      "Enable your rear camera only when you are ready. The preview stays on this device.",
    action: "Enable Rear Camera",
    help: "You can change the camera later with the switch control.",
  };
}

export default function CameraStage({
  simpleMode = false,
  screenMode = false,
  immediateCapture = false,
  minLength,
  maxLength,
  autoCapture,
  highContrast,
  invert,
  format,
  onCancel,
  onConfirmed,
  onManualEntry,
}: CameraStageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef(new CameraService());
  const barcodeGuardRef = useRef(new BarcodeGuard());
  const ocrRef = useRef<OCRService>(new BrowserOCRService());
  const nativeTextRef = useRef(new NativeTextService());
  const processingRef = useRef(false);
  const queuedManualCaptureRef = useRef(false);
  const autoRequestedRef = useRef(false);
  const capturedRef = useRef(false);
  const lastScanAtRef = useRef(0);
  const stabilityRef = useRef(
    new StabilityTracker(immediateCapture ? 1 : REQUIRED_STABLE_FRAMES)
  );
  const motionRef = useRef(new FrameMotionTracker(1, 18));
  const [accessState, setAccessState] = useState<AccessState>("ready");
  const [status, setStatus] = useState("Camera ready");
  const [statusKind, setStatusKind] = useState<ScanState>("reading");
  const [detail, setDetail] = useState("Enable the camera to begin local OCR.");
  const [stableCount, setStableCount] = useState(0);
  const [torch, setTorch] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [manual, setManual] = useState("");
  const [manualError, setManualError] = useState("");
  const [debugFrame, setDebugFrame] = useState<DebugFrame | null>(null);
  const [runtimeDiagnostics, setRuntimeDiagnostics] =
    useState<CameraRuntimeDiagnostics>(() =>
      cameraRef.current.getRuntimeDiagnostics()
    );
  const [photoStatus, setPhotoStatus] = useState("");
  const [captureQuality, setCaptureQuality] = useState<CaptureQuality>({
    state: "soft",
    label: "ANALYZING LENS",
  });
  const [manualCapturePending, setManualCapturePending] = useState(false);
  const isActive = accessState === "active";

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

  const requestCamera = useCallback(async () => {
    if (!videoRef.current || accessState === "requesting") return;
    capturedRef.current = false;
    stabilityRef.current.reset();
    motionRef.current.reset();
    setStableCount(0);
    setCaptureQuality({ state: "hold", label: "HOLD STILL" });
    setAccessState("requesting");
    try {
      await cameraRef.current.start(videoRef.current);
      setRuntimeDiagnostics(cameraRef.current.getRuntimeDiagnostics());
      setAccessState("active");
      applyState(
        "reading",
        "Align exactly one clear horizontal line of digits inside the box.",
        0
      );
    } catch (error) {
      let issue: CameraAccessIssue =
        error instanceof CameraAccessError ? error.issue : "unknown";
      if (error instanceof CameraAccessError)
        setRuntimeDiagnostics(error.diagnostics);
      if (issue === "denied" && cameraRef.current.isAndroid()) {
        const permission = await cameraRef.current.getPermissionState();
        if (permission === "prompt") issue = "overlay";
      }
      setAccessState(issue);
      applyState("uncertain", permissionCopy(issue).message, 0);
    }
  }, [accessState, applyState]);

  useEffect(() => {
    if (autoRequestedRef.current) return;
    autoRequestedRef.current = true;
    const timer = window.setTimeout(() => void requestCamera(), 80);
    return () => window.clearTimeout(timer);
  }, [requestCamera]);

  const acknowledgeOverlayRecovery = useCallback(() => {
    setAccessState("ready");
    applyState(
      "reading",
      "Overlays cleared. Tap Enable Rear Camera to request Android permission again.",
      0
    );
  }, [applyState]);

  const openNativeCamera = () => photoInputRef.current?.click();

  const handlePhotoSelection = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !canvasRef.current) return;
      setPhotoStatus("Analyzing the selected photo on this device…");
      applyState("reading", "Reading the selected screen photo locally…", 0);
      try {
        const imageUrl = URL.createObjectURL(file);
        const image = new Image();
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () =>
            reject(new Error("The image could not be opened."));
          image.src = imageUrl;
        });
        const canvas = canvasRef.current;
        const longestEdge = Math.max(image.naturalWidth, image.naturalHeight);
        const scale = Math.min(1, 2048 / longestEdge);
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context)
          throw new Error("The image canvas could not be prepared.");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(imageUrl);
        await ocrRef.current.initialize();
        const photoMinLength = 4;
        const chooseCandidate = (
          blocks: OcrTextBlock[],
          minimumConfidence = 62
        ) =>
          screenMode
            ? selectProminentDisplayNumber(blocks, {
                format,
                minLength: photoMinLength,
                maxLength,
                minimumConfidence,
              })
            : evaluateOcrFrame(blocks, {
                format,
                minLength,
                maxLength,
                minimumConfidence,
              });
        const readPhoto = async (
          frame: HTMLCanvasElement,
          minimumConfidence = 62
        ) => {
          const nativeBlocks = await nativeTextRef.current.detect(frame);
          const nativeDecision = nativeBlocks.length
            ? chooseCandidate(nativeBlocks, minimumConfidence)
            : null;
          const recognized = await ocrRef.current.recognize(frame, {
            includeSeparatedNumericWords: screenMode,
          });
          return [
            nativeDecision,
            chooseCandidate(recognized.blocks, minimumConfidence),
          ].filter((decision): decision is FrameDecision => Boolean(decision));
        };
        let photoDecisions = await readPhoto(canvas);
        let decision = selectVerifiedPhotoOrderNumber(photoDecisions);
        if (!decision.candidate) {
          const handwritingFrame =
            cameraRef.current.createHandwritingFrame(canvas);
          if (handwritingFrame) {
            photoDecisions = [
              ...photoDecisions,
              ...(await readPhoto(handwritingFrame, 48)),
            ];
            decision = selectVerifiedPhotoOrderNumber(photoDecisions);
          }
        }
        if (screenMode) {
          setPhotoStatus("Improving screen contrast locally…");
          cameraRef.current.normalizeScreenFrame(canvas);
          photoDecisions = [...photoDecisions, ...(await readPhoto(canvas))];
          decision = selectVerifiedPhotoOrderNumber(photoDecisions);
        }
        if (!decision.candidate && screenMode) {
          setPhotoStatus("Correcting the screen angle locally…");
          const corrected = cameraRef.current.rotateFrame(canvas, -12);
          if (corrected) {
            photoDecisions = [
              ...photoDecisions,
              ...(await readPhoto(corrected, 42)),
            ];
            decision = selectVerifiedPhotoOrderNumber(photoDecisions);
          }
        }
        if (decision.candidate) {
          setPhotoStatus("");
          onConfirmed(decision.candidate.value, decision.candidate.confidence);
          return;
        }
        setPhotoStatus(decision.detail);
        applyState(decision.state, decision.detail, 0);
      } catch (error) {
        setPhotoStatus(
          "That photo could not be read. Take a sharp image with one line of digits or use manual entry."
        );
        applyState(
          "uncertain",
          "That photo could not be read. Use a sharper photo or enter the number manually.",
          0
        );
        if (import.meta.env.DEV)
          console.debug("[Number to Barcode OCR] photo fallback failed", error);
      }
    },
    [applyState, format, maxLength, minLength, onConfirmed, screenMode]
  );

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
          setDebugFrame(current =>
            current ? { ...current, skipped: "in-flight" } : current
          );
        return;
      }
      const runManualCapture = force || queuedManualCaptureRef.current;
      if (runManualCapture) queuedManualCaptureRef.current = false;
      const scanCooldown = immediateCapture ? 160 : SCAN_INTERVAL_MS;
      if (!runManualCapture && now - lastScanAtRef.current < scanCooldown) {
        if (import.meta.env.DEV)
          setDebugFrame(current =>
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
        const frame = cameraRef.current.captureCenteredFrame(
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
          setCaptureQuality(current =>
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
        if (screenMode) cameraRef.current.normalizeScreenFrame(frame);
        const rawBarcodes = await barcodeGuardRef.current.detect(frame);
        let directBarcode = selectNumericLinearBarcode(
          rawBarcodes,
          minLength,
          maxLength
        );
        let barcodeRegions = rawBarcodes
          .filter(
            barcode =>
              barcode.format !== "qr_code" && barcode.format !== "zxing_1d"
          )
          .map(barcode => barcode.bbox);
        let enhancedFrame: HTMLCanvasElement | null = null;
        let barcodePath: DebugFrame["path"] = "barcode-native";
        if (!directBarcode && !screenMode) {
          enhancedFrame = cameraRef.current.createAdaptiveBarcodeFrame(frame);
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
                  barcode =>
                    barcode.format !== "qr_code" &&
                    barcode.format !== "zxing_1d"
                )
                .map(barcode => barcode.bbox),
            ];
            barcodePath = "barcode-adaptive";
          }
        }
        const focusRegion =
          directBarcode?.format === "zxing_1d"
            ? barcodeRegions[0]
            : (directBarcode?.bbox ?? barcodeRegions[0]);
        const quality = cameraRef.current.assessFrameQuality(
          frame,
          focusRegion
        );
        setCaptureQuality(current =>
          current.state === quality.state && current.label === quality.label
            ? current
            : { state: quality.state, label: quality.label }
        );
        if (!screenMode && !directBarcode && barcodeRegions.length === 0)
          setCaptureQuality(current =>
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
          void cameraRef.current.freezeFocusWhenSharp();
        const decide = (blocks: OcrTextBlock[], minimumConfidence?: number) => {
          const rules = {
            format,
            minLength: screenMode ? Math.max(8, minLength) : minLength,
            maxLength,
            minimumConfidence,
          };
          return barcodeRegions.length > 0
            ? selectBarcodeAdjacentNumeric(blocks, barcodeRegions, rules)
            : screenMode
              ? selectProminentDisplayNumber(blocks, rules)
              : evaluateOcrFrame(blocks, rules);
        };
        let path: DebugFrame["path"] = directBarcode ? barcodePath : "ocr";
        let recognized = {
          blocks: [] as OcrTextBlock[],
          engineConfidence: directBarcode ? 100 : 0,
        };
        let decision: FrameDecision;
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
            : (undefined as never);
          if (!decision?.candidate) {
            const fastScreenFrame = screenMode
              ? cameraRef.current.createFastScreenFrame(ocrFrame)
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
              if (decision.candidate) path = "ocr-fast";
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
        if (runManualCapture && screenMode && !decision.candidate) {
          const corrected = cameraRef.current.rotateFrame(frame, 25);
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
          decision.state === "candidate"
            ? stabilityRef.current.observe(decision.candidate)
            : stabilityRef.current.reset();
        const finalState: ScanState = stability.confirmed
          ? "confirmed"
          : decision.state;
        applyState(finalState, decision.detail, stability.count);
        if (import.meta.env.DEV) {
          setDebugFrame({
            durationMs: Math.round(performance.now() - startedAt),
            engineConfidence: Math.round(recognized.engineConfidence),
            decision,
            path,
          });
          console.debug("[Number to Barcode OCR]", {
            finalState,
            stability,
            decision,
            engineConfidence: recognized.engineConfidence,
            path,
          });
        }
        if (
          stability.confirmed &&
          decision.candidate &&
          autoCapture &&
          !capturedRef.current
        ) {
          capturedRef.current = true;
          cameraRef.current.stop();
          setAccessState("ready");
          navigator.vibrate?.(32);
          window.setTimeout(
            () =>
              onConfirmed(
                decision.candidate!.value,
                decision.candidate!.confidence
              ),
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
      format,
      immediateCapture,
      isActive,
      maxLength,
      minLength,
      onConfirmed,
      screenMode,
    ]
  );

  useEffect(() => {
    void ocrRef.current.initialize();
    void barcodeGuardRef.current.warmFallback();
    return () => {
      cameraRef.current.stop();
      void ocrRef.current.dispose();
    };
  }, []);
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
  }, [immediateCapture, isActive, scan]);

  const handleTorch = async () => {
    const enabled = !torch;
    if (await cameraRef.current.setTorch(enabled)) setTorch(enabled);
    else
      applyState(
        "uncertain",
        "This camera does not expose a browser torch control.",
        stableCount
      );
  };
  const handleZoom = async () => {
    const nextZoom = zoom === 1 ? 1.6 : zoom === 1.6 ? 2.2 : 1;
    if (await cameraRef.current.setZoom(nextZoom)) setZoom(nextZoom);
    else
      applyState(
        "uncertain",
        "Pinch-to-zoom may still be available in your browser.",
        stableCount
      );
  };
  const handleSwitch = async () => {
    if (!videoRef.current) return;
    try {
      await cameraRef.current.switchCamera(videoRef.current);
      motionRef.current.reset();
      setCaptureQuality({ state: "hold", label: "HOLD STILL" });
      applyState(
        "reading",
        "Camera switched. Hold the number inside the frame for a moment.",
        0
      );
    } catch (error) {
      const issue =
        error instanceof CameraAccessError ? error.issue : "unknown";
      setAccessState(issue);
      applyState("uncertain", permissionCopy(issue).message, 0);
    }
  };
  const recovery = permissionCopy(accessState);

  const submitManual = (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const value = cleanNumberInput(manual);
      const validation = validateNumber(value, format, minLength, maxLength);
      if (!validation.valid) {
        setManualError(validation.message || "Enter a valid numeric value.");
        return;
      }
      setManualError("");
      onManualEntry(value);
    } catch (error) {
      setManualError(
        error instanceof Error ? error.message : "Enter digits 0–9 only."
      );
      return;
    }
  };

  return (
    <section
      className={`camera-stage ${isActive ? "camera-active" : "camera-blocked"} ${simpleMode ? "camera-direct-mode" : ""}`}
    >
      <div className="camera-topbar">
        <div className="brand-compact">
          <span className="founder-mark">
            <img
              src="/manus-storage/number-to-barcode-founder-mark_8a1dd44c.png"
              alt="Founder scanner mark"
            />
          </span>
          <span>
            Number<span>/</span>Barcode
          </span>
        </div>
        <div className="camera-top-actions">
          <button
            className="photo-import-control"
            onClick={openNativeCamera}
            aria-label="Capture or import a screen photo"
          >
            <ImagePlus size={15} />
            <span>Photo</span>
          </button>
          <InstallAppControl />
          {!simpleMode && (
            <button
              className="icon-control"
              onClick={onCancel}
              aria-label="Cancel camera scanning"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>
      <div className="camera-viewport" role="presentation">
        <div className="camera-fallback" />
        <video
          ref={videoRef}
          muted
          playsInline
          className={`${highContrast ? "camera-high-contrast" : ""} ${invert ? "camera-invert" : ""}`}
        />
        <div
          className={`reticle ${isActive ? "" : "reticle-idle"}`}
          aria-hidden="true"
        >
          <span className="reticle-corner top-left" />
          <span className="reticle-corner top-right" />
          <span className="reticle-corner bottom-left" />
          <span className="reticle-corner bottom-right" />
          <span className="scan-beam" />
          <span className="reticle-guide left" />
          <span className="reticle-guide right" />
        </div>
        {isActive && (
          <div
            className={`capture-quality ${captureQuality.state}`}
            role="status"
            aria-live="polite"
          >
            <span />
            <strong>{captureQuality.label}</strong>
            <small>
              {captureQuality.state === "ready"
                ? "focused"
                : captureQuality.state === "soft"
                  ? "focus"
                  : captureQuality.state === "dim"
                    ? "exposure"
                    : "reflection"}
            </small>
          </div>
        )}
        {isActive && (
          <div className="camera-instruction">
            <Aperture size={16} />{" "}
            {screenMode
              ? "Hold the long order number inside the box"
              : "Align one line of digits inside the box"}
          </div>
        )}
        {!isActive && (
          <div className="camera-permission-layer">
            <div
              className="permission-telemetry"
              aria-label="Scanner readiness"
            >
              <span>
                <i /> LOCAL OCR
              </span>
              <span>
                <i /> PHOTO READY
              </span>
              <span>
                <i /> CODE 128
              </span>
            </div>
            <div className="camera-permission-card">
              <div className="camera-permission-icon">
                {simpleMode ? (
                  <Camera size={21} />
                ) : accessState === "denied" || accessState === "overlay" ? (
                  <ShieldCheck size={21} />
                ) : (
                  <Camera size={21} />
                )}
              </div>
              <p className="eyebrow">
                {simpleMode && accessState === "requesting"
                  ? "Starting local camera"
                  : simpleMode
                    ? recovery.eyebrow
                    : recovery.eyebrow}
              </p>
              <h2>
                {simpleMode && accessState === "ready"
                  ? "Point at the order number"
                  : recovery.title}
              </h2>
              <p className="permission-message">
                {simpleMode && accessState === "ready"
                  ? "The camera opens automatically. If the browser asks, choose Allow."
                  : recovery.message}
              </p>
              <div className="camera-permission-actions">
                <button
                  className="primary-action"
                  onClick={() =>
                    simpleMode
                      ? void requestCamera()
                      : accessState === "overlay"
                        ? acknowledgeOverlayRecovery()
                        : void requestCamera()
                  }
                  disabled={accessState === "requesting"}
                >
                  {accessState === "requesting" ? (
                    <RefreshCcw className="animate-spin" size={18} />
                  ) : (
                    <Camera size={18} />
                  )}
                  {accessState === "requesting"
                    ? "Opening…"
                    : accessState === "ready"
                      ? "Open live camera"
                      : "Try camera again"}
                </button>
                {simpleMode ? (
                  accessState !== "ready" && (
                    <>
                      <button
                        className="secondary-action native-camera-fallback"
                        onClick={openNativeCamera}
                      >
                        <ImagePlus size={18} />
                        Capture or choose photo
                      </button>
                      <div className="manual-recovery-mode">
                        <span>Manual input · digits only</span>
                        <form
                          className="direct-manual-form"
                          onSubmit={submitManual}
                        >
                          <input
                            value={manual}
                            onChange={event => {
                              setManual(event.target.value);
                              setManualError("");
                            }}
                            inputMode="numeric"
                            placeholder="Enter long number"
                            aria-label="Enter long number"
                          />
                          <button type="submit">Make barcode</button>
                          {manualError && <small>{manualError}</small>}
                        </form>
                      </div>
                    </>
                  )
                ) : (
                  <>
                    <button
                      className="secondary-action photo-fallback"
                      onClick={openNativeCamera}
                    >
                      <ImagePlus size={18} />
                      Take or choose a photo
                    </button>
                    <button
                      className="secondary-action"
                      onClick={() => onManualEntry(manual)}
                    >
                      Use Manual Entry
                    </button>
                  </>
                )}
              </div>
              {photoStatus && (
                <p className="photo-status" role="status">
                  {photoStatus}
                </p>
              )}
              <p className="camera-permission-help">
                {simpleMode
                  ? accessState === "ready"
                    ? "Camera and OCR work locally on this device."
                    : recovery.help
                  : recovery.help}
              </p>
              {import.meta.env.DEV && (
                <p className="camera-runtime-note">
                  {runtimeDiagnostics.secureContext ? "Secure" : "Insecure"} ·{" "}
                  {runtimeDiagnostics.mediaDevicesAvailable
                    ? "camera API"
                    : "no camera API"}{" "}
                  ·{" "}
                  {runtimeDiagnostics.embedded
                    ? "embedded host"
                    : "top-level browser"}{" "}
                  · policy {runtimeDiagnostics.cameraPolicy}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
      {isActive && (
        <>
          <div className="camera-status-panel" aria-live="polite">
            <div className="status-signal">
              <span className={`status-dot ${statusKind}`} />
              <div>
                <strong>{status}</strong>
                <p>{photoStatus || detail}</p>
              </div>
            </div>
            {!immediateCapture && (
              <div
                className="stability-pips"
                aria-label={`${stableCount} of ${REQUIRED_STABLE_FRAMES} stable readings`}
              >
                {[1, 2, 3].map(step => (
                  <i
                    key={step}
                    className={stableCount >= step ? "active" : ""}
                  />
                ))}
              </div>
            )}
          </div>
          {screenMode && (
            <button
              className="manual-capture-orb"
              onClick={() => void scan(true)}
              disabled={!isActive || manualCapturePending}
              aria-label="Capture now and override automatic scan"
            >
              <Camera size={28} />
              <span>{manualCapturePending ? "READING" : "CAPTURE"}</span>
            </button>
          )}
          {import.meta.env.DEV && debugFrame && (
            <details className="ocr-debug">
              <summary>
                <Bug size={13} className="inline-block mr-1" /> OCR diagnostics
                · {debugFrame.decision.blocks.length} block(s)
              </summary>
              <div className="ocr-debug-body">
                <p className="ocr-debug-meta">
                  {debugFrame.durationMs} ms · {debugFrame.path} · engine{" "}
                  {debugFrame.engineConfidence}% · state{" "}
                  {debugFrame.decision.state}
                  {debugFrame.skipped ? ` · ${debugFrame.skipped}` : ""}
                  {barcodeGuardRef.current.isAvailable
                    ? " · machine-code guard on"
                    : " · guard unavailable"}
                </p>
                {debugFrame.decision.blocks.map((block, index) => (
                  <div
                    className="ocr-debug-block"
                    key={`${block.text}-${index}`}
                  >
                    <code>{JSON.stringify(block.text)}</code>
                    <span className={block.accepted ? "ok" : ""}>
                      {block.accepted ? "accepted" : block.reason}
                    </span>
                    <small className="ocr-debug-box">
                      {Math.round(block.confidence)}% · area{" "}
                      {Math.round(block.area)} · [{Math.round(block.bbox.x0)},
                      {Math.round(block.bbox.y0)} → {Math.round(block.bbox.x1)},
                      {Math.round(block.bbox.y1)}]
                    </small>
                  </div>
                ))}
              </div>
            </details>
          )}
          {!simpleMode && (
            <>
              <div className="camera-actions">
                <button
                  className={`camera-action ${torch ? "active" : ""}`}
                  onClick={() => void handleTorch()}
                >
                  <Flashlight size={18} />
                  <span>Torch</span>
                </button>
                <button
                  className="camera-action"
                  onClick={() => void handleSwitch()}
                >
                  <RotateCcw size={18} />
                  <span>Switch</span>
                </button>
                <button
                  className="camera-action"
                  onClick={() => void handleZoom()}
                >
                  <ZoomIn size={18} />
                  <span>{zoom}× zoom</span>
                </button>
              </div>
              <form className="manual-bar" onSubmit={submitManual}>
                <ScanLine size={17} />
                <input
                  value={manual}
                  onChange={event => {
                    setManual(event.target.value);
                    setManualError("");
                  }}
                  inputMode="numeric"
                  placeholder="Enter number manually"
                  aria-label="Manual number entry"
                />
                <button type="submit" disabled={!manual.trim()}>
                  <Sparkles size={16} /> Use
                </button>
                {manualError && (
                  <small className="manual-input-error">{manualError}</small>
                )}
              </form>
            </>
          )}
        </>
      )}
      <input
        ref={photoInputRef}
        className="hidden"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={event => void handlePhotoSelection(event)}
        aria-label="Take or choose a photo to read"
      />
      <canvas ref={canvasRef} className="hidden" />
    </section>
  );
}
