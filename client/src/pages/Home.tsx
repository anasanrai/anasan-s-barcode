import { Check, Copy, RefreshCcw, TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";
import BarcodePreview, { BarcodePreviewHandle } from "@/components/BarcodePreview";
import CameraScanner from "@/components/CameraScanner";
import InstallApp from "@/components/InstallApp";

type Screen = "capture" | "result";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("capture");
  const [number, setNumber] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const barcodeRef = useRef<BarcodePreviewHandle | null>(null);

  const capture = (value: string) => {
    setNumber(value);
    setError("");
    setScreen("result");
  };

  const copyNumber = async () => {
    try {
      await navigator.clipboard.writeText(number);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Could not copy the number. Select it from the barcode label instead.");
    }
  };

  return (
    <main className="app-shell">
      <header className="site-header">
        <a href="/" className="brand" aria-label="Number to Barcode home"><span className="brand-mark">∣∣∣</span><span>Number<span className="brand-slash">/</span>Barcode</span></a>
        <div className="header-actions"><InstallApp /><span className="header-note">Code 128 label studio</span></div>
      </header>

      {screen === "capture" ? (
        <CameraScanner onDetected={capture} onError={setError} />
      ) : (
        <section className="result-card" aria-labelledby="barcode-ready-title">
          <p className="eyebrow">Code 128 barcode</p>
          <h1 id="barcode-ready-title">Barcode ready.</h1>
          <p className="result-lede">Your number is encoded exactly as shown. Save the label, or start another scan.</p>
          <div className="label-frame">
            <div className="label-frame__top"><span>SCANNABLE LABEL</span><span>CODE 128</span></div>
            <BarcodePreview ref={barcodeRef} value={number} onError={setError} />
            <div className="label-number"><span>NUMBER</span><strong>{number}</strong></div>
          </div>
          {error && <p className="inline-error" role="alert"><TriangleAlert size={17} /> {error}</p>}
          <div className="result-actions">
            <button className="button button--primary" type="button" onClick={() => { setScreen("capture"); setNumber(""); setError(""); }}><RefreshCcw size={18} /> Scan next number</button>
            <button className="button button--secondary" type="button" onClick={() => void copyNumber()}>{copied ? <Check size={18} /> : <Copy size={18} />}{copied ? "Copied" : "Copy number"}</button>
            <button className="button button--secondary" type="button" onClick={() => barcodeRef.current?.download()}>Save PNG</button>
          </div>
        </section>
      )}

      {screen === "capture" && error && <p className="global-error" role="alert"><TriangleAlert size={17} /> {error}</p>}
      <footer className="site-footer">Runs locally in your browser. Camera images and numbers are not sent to a server.</footer>
    </main>
  );
}
