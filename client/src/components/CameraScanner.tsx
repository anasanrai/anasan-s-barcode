import { BrowserMultiFormatOneDReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { Camera, FileImage, LoaderCircle, ScanLine, ShieldCheck, Type } from "lucide-react";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { validateExactDigits } from "@/lib/number";
import { evaluateDecodedBarcode } from "@/lib/scannerPolicy";

type CameraScannerProps = {
  onDetected: (value: string) => void;
  onError: (message: string) => void;
};

type ScannerState = "idle" | "starting" | "scanning" | "image";

const scanHints = new Map<DecodeHintType, unknown>([
  [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128, BarcodeFormat.EAN_13]],
]);

export default function CameraScanner({ onDetected, onError }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const readerRef = useRef(new BrowserMultiFormatOneDReader(scanHints));
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const detectedRef = useRef(false);
  const [state, setState] = useState<ScannerState>("idle");
  const [manualValue, setManualValue] = useState("");
  const [manualError, setManualError] = useState("");
  const [cameraUnavailable, setCameraUnavailable] = useState(false);

  const stopCamera = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setState("idle");
  };

  const acceptDecodedBarcode = (candidate: string, format: BarcodeFormat) => {
    const decision = evaluateDecodedBarcode(candidate, format);
    if (decision.kind === "reject") {
      onError(decision.message);
      return false;
    }
    detectedRef.current = true;
    stopCamera();
    onDetected(decision.value);
    return true;
  };

  const startCamera = async () => {
    if (!videoRef.current) return;
    detectedRef.current = false;
    setCameraUnavailable(false);
    setState("starting");
    try {
      const controls = await readerRef.current.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
        if (result && !detectedRef.current) {
          acceptDecodedBarcode(result.getText(), result.getBarcodeFormat());
        }
      });
      controlsRef.current = controls;
      setState("scanning");
    } catch {
      setCameraUnavailable(true);
      setState("idle");
      onError("Camera access is unavailable. Use image upload or manual entry instead.");
    }
  };

  useEffect(() => () => stopCamera(), []);

  const onImageSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    stopCamera();
    setState("image");
    const imageUrl = URL.createObjectURL(file);
    try {
      const result = await readerRef.current.decodeFromImageUrl(imageUrl);
      URL.revokeObjectURL(imageUrl);
      if (!acceptDecodedBarcode(result.getText(), result.getBarcodeFormat())) setState("idle");
    } catch {
      URL.revokeObjectURL(imageUrl);
      setState("idle");
      onError("No supported numeric barcode was detected. Use a clearer image or enter the exact digits manually.");
    }
  };

  const submitManual = () => {
    const validation = validateExactDigits(manualValue);
    if (!validation.valid) {
      setManualError(validation.message);
      return;
    }
    setManualError("");
    onDetected(validation.value);
  };

  const busy = state === "starting" || state === "image";

  return (
    <section className="scanner-card" aria-labelledby="scanner-title">
      <div className="scanner-card__header">
        <div>
          <p className="eyebrow">Capture a number</p>
          <h1 id="scanner-title">Ready when you are.</h1>
          <p>Scan a numeric 1D label, upload an image, or type a number to make a crisp Code 128 barcode.</p>
        </div>
        <span className="privacy-badge"><ShieldCheck size={16} /> Private in your browser</span>
      </div>

      <div className="camera-stage">
        <video ref={videoRef} autoPlay muted playsInline className={state === "scanning" ? "camera-video active" : "camera-video"} />
        {state !== "scanning" && (
          <div className="camera-empty">
            {busy ? <LoaderCircle className="spin" size={34} /> : <ScanLine size={38} />}
            <strong>{state === "image" ? "Scanning image…" : "Camera preview"}</strong>
            <span>Point your camera at a numeric Code 128 or valid EAN-13 label.</span>
          </div>
        )}
        {state === "scanning" && <div className="scan-window" aria-hidden="true" />}
      </div>

      <div className="scan-actions">
        {state === "scanning" ? (
          <button className="button button--secondary" type="button" onClick={stopCamera}><Camera size={18} /> Stop camera</button>
        ) : (
          <button className="button button--primary" type="button" onClick={() => void startCamera()} disabled={busy}><Camera size={18} /> {cameraUnavailable ? "Try camera again" : "Use camera"}</button>
        )}
        <button className="button button--secondary" type="button" onClick={() => fileInputRef.current?.click()} disabled={busy}><FileImage size={18} /> Upload image</button>
        <input ref={fileInputRef} onChange={(event) => void onImageSelected(event)} accept="image/*" type="file" className="sr-only" />
      </div>

      <div className="manual-entry">
        <label htmlFor="manual-number"><Type size={16} /> Or enter the number yourself</label>
        <div>
          <input id="manual-number" inputMode="numeric" autoComplete="off" value={manualValue} onChange={(event) => { setManualValue(event.target.value); setManualError(""); }} onKeyDown={(event) => { if (event.key === "Enter") submitManual(); }} aria-describedby={manualError ? "manual-number-error" : undefined} placeholder="e.g. 123456789" />
          <button className="button button--dark" type="button" onClick={submitManual}>Create barcode</button>
        </div>
        {manualError ? <small id="manual-number-error" role="alert" className="manual-entry__error">{manualError}</small> : <small>Digits only, between 6 and 64 characters.</small>}
      </div>
    </section>
  );
}
