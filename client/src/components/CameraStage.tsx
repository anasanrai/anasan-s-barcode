/** Signal Field design system: explicit permission recovery and compact touch controls make the camera stage dependable on real mobile browsers. */
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
import { CameraAccessError, type CameraAccessIssue } from "@/services/camera";
import {
  evaluateOcrFrame,
  selectProminentDisplayNumber,
  selectVerifiedPhotoOrderNumber,
  type FrameDecision,
  type OcrTextBlock,
} from "@/services/ocrPipeline";
import { NativeTextService } from "@/services/nativeText";
import { BrowserOCRService } from "@/services/ocr";
import {
  assertNumericInput,
  type BarcodeFormat,
  validateNumber,
} from "@/services/number";
import InstallAppControl from "@/components/InstallAppControl";
import { useCameraSession } from "@/hooks/useCameraSession";
import { useScanLoop } from "@/hooks/useScanLoop";

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

function permissionCopy(access: string): {
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
  const nativeTextRef = useRef(new NativeTextService());
  const ocrRef = useRef(new BrowserOCRService());

  const {
    cameraService,
    accessState,
    torch,
    zoom,
    runtimeDiagnostics,
    requestCamera,
    autoRequest,
    stopCamera,
    handleTorch,
    handleZoom,
    handleSwitch,
    isActive,
  } = useCameraSession(videoRef);

  const {
    status,
    statusKind,
    detail,
    stableCount,
    captureQuality,
    manualCapturePending,
    debugFrame,
    scan,
    reset: resetScan,
  } = useScanLoop({
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
  });

  const [manual, setManual] = useState("");
  const [manualError, setManualError] = useState("");
  const [photoStatus, setPhotoStatus] = useState("");

  // Auto-request camera on mount
  useEffect(() => {
    return autoRequest();
  }, [autoRequest]);

  // Reset scan state when camera becomes active
  useEffect(() => {
    if (isActive) resetScan();
  }, [isActive, resetScan]);

  const acknowledgeOverlayRecovery = useCallback(() => {
    stopCamera();
  }, [stopCamera]);

  const openNativeCamera = () => photoInputRef.current?.click();

  const handlePhotoSelection = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !canvasRef.current) return;
      setPhotoStatus("Analyzing the selected photo on this device…");
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
                minLength: photoMinLength,
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
            : undefined;
          const recognized = await ocrRef.current.recognize(frame, {
            includeSeparatedNumericWords: screenMode,
          });
          return [
            nativeDecision,
            chooseCandidate(recognized.blocks, minimumConfidence),
          ].filter((d): d is FrameDecision => Boolean(d));
        };

        let photoDecisions = await readPhoto(canvas);
        let decision = selectVerifiedPhotoOrderNumber(photoDecisions);
        if (!decision.candidate) {
          const handwritingFrame =
            cameraService.createHandwritingFrame(canvas);
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
          cameraService.normalizeScreenFrame(canvas);
          photoDecisions = [...photoDecisions, ...(await readPhoto(canvas))];
          decision = selectVerifiedPhotoOrderNumber(photoDecisions);
        }
        if (!decision.candidate && screenMode) {
          setPhotoStatus("Correcting the screen angle locally…");
          const corrected = cameraService.rotateFrame(canvas, -12);
          if (corrected) {
            photoDecisions = [
              ...photoDecisions,
              ...(await readPhoto(corrected, 42)),
            ];
            decision = selectVerifiedPhotoOrderNumber(photoDecisions);
          }
        }
        URL.revokeObjectURL(imageUrl);
        if (decision.candidate) {
          setPhotoStatus("");
          onConfirmed(decision.candidate.value, decision.candidate.confidence);
          return;
        }
        setPhotoStatus(decision.detail);
      } catch (error) {
        setPhotoStatus(
          "That photo could not be read. Take a sharp image with one line of digits or use manual entry."
        );
        if (import.meta.env.DEV)
          console.debug("[Number to Barcode OCR] photo fallback failed", error);
      }
    },
    [cameraService, format, maxLength, onConfirmed, screenMode]
  );

  const recovery = permissionCopy(accessState);

  const submitManual = (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const value = assertNumericInput(manual);
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
              <p className="eyebrow">{recovery.eyebrow}</p>
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
                            onChange={(event) => {
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
              <p className="camera-permission-help">{recovery.help}</p>
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
                aria-label={`${stableCount} of 3 stable readings`}
              >
                {[1, 2, 3].map((step) => (
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
                  aria-pressed={torch}
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
                  onChange={(event) => {
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
        onChange={(event) => void handlePhotoSelection(event)}
        aria-label="Take or choose a photo to read"
      />
      <canvas ref={canvasRef} className="hidden" />
    </section>
  );
}
