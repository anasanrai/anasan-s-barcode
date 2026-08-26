/** Signal Field direct mode: one-purpose camera scanning converts a stable long numeric string straight into a Code 128 barcode. */
import { useRef, useState } from "react";
import { Check, Copy, Download, RefreshCcw, TriangleAlert } from "lucide-react";
import BarcodePreview from "@/components/BarcodePreview";
import CameraStage from "@/components/CameraStage";
import { downloadBarcodePng } from "@/services/barcode";
import {
  barcodeValue,
  assertNumericInput,
  validateNumber,
} from "@/services/number";

type Screen = "camera" | "result";
const CODE128 = "CODE128" as const;
const MIN_LENGTH = 6;
const MAX_LENGTH = 64;

export default function Home() {
  const [screen, setScreen] = useState<Screen>("camera");
  const [number, setNumber] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const barcodeRef = useRef<SVGSVGElement | null>(null);

  const acceptNumber = (raw: string) => {
    try {
      const value = assertNumericInput(raw);
      const validation = validateNumber(value, CODE128, MIN_LENGTH, MAX_LENGTH);
      if (!validation.valid) {
        setError(validation.message || "Use a long numeric value.");
        return;
      }
      setNumber(value);
      setError("");
      setScreen("result");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Use digits only.");
    }
  };

  const copyNumber = async () => {
    try {
      await navigator.clipboard.writeText(number);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Could not copy the number. Select it from the label instead.");
    }
  };

  const saveBarcode = async () => {
    if (!barcodeRef.current) {
      setError("The barcode preview is not ready to save yet.");
      return;
    }
    try {
      await downloadBarcodePng(barcodeRef.current, `barcode-${number}`);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not save the barcode."
      );
    }
  };

  if (screen === "camera") {
    return (
      <CameraStage
        simpleMode
        screenMode
        immediateCapture
        minLength={MIN_LENGTH}
        maxLength={MAX_LENGTH}
        autoCapture
        highContrast={false}
        invert={false}
        format={CODE128}
        onCancel={() => undefined}
        onConfirmed={(value) => acceptNumber(value)}
        onManualEntry={acceptNumber}
      />
    );
  }

  const encoded = barcodeValue(number, CODE128);
  return (
    <main className="app-shell direct-result-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <span className="founder-mark">
            <img
              src="/manus-storage/number-to-barcode-founder-mark_8a1dd44c.png"
              alt=""
            />
          </span>
          <span>
            Number<span>/</span>Barcode
          </span>
        </div>
      </header>
      <section className="content-stage result-stage direct-result-stage">
        <div className="stage-heading">
          <p className="eyebrow">Code 128 barcode</p>
          <h1>Barcode ready.</h1>
          <p>Your captured number is encoded exactly as shown.</p>
        </div>
        <div className="output-frame">
          <div className="output-header">
            <span>SCANNABLE LABEL</span>
            <span>CODE 128</span>
          </div>
          <BarcodePreview
            ref={barcodeRef}
            value={encoded}
            format={CODE128}
            onError={setError}
          />
          <div className="output-number">
            <span>NUMBER</span>
            <strong>{number}</strong>
          </div>
        </div>
        {error && (
          <div className="inline-error">
            <TriangleAlert size={17} />
            <span>{error}</span>
          </div>
        )}
        <div className="stage-actions">
          <button
            className="primary-action"
            onClick={() => {
              setNumber("");
              setError("");
              setCopied(false);
              setSaved(false);
              setScreen("camera");
            }}
          >
            <RefreshCcw size={18} /> Scan next number
          </button>
          <button
            className="secondary-action"
            onClick={() => void copyNumber()}
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? "Copied" : "Copy number"}
          </button>
          <button
            className="secondary-action"
            onClick={() => void saveBarcode()}
          >
            {saved ? <Check size={18} /> : <Download size={18} />}
            {saved ? "Saved" : "Save PNG"}
          </button>
        </div>
      </section>
    </main>
  );
}
