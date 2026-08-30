import { useRef, useState } from "react";
import BarcodePreview, { BarcodePreviewHandle } from "@/components/BarcodePreview";
import InstallApp from "@/components/InstallApp";
import PelicanScanner from "@/components/PelicanScanner";

type Screen = "scan" | "result";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("scan");
  const [number, setNumber] = useState("");
  const [barcodeError, setBarcodeError] = useState("");
  const barcodeRef = useRef<BarcodePreviewHandle | null>(null);

  const handleDetected = (value: string) => {
    setNumber(value);
    setBarcodeError("");
    setScreen("result");
  };

  const handleBack = () => {
    setNumber("");
    setBarcodeError("");
    setScreen("scan");
  };

  if (screen === "result") {
    return (
      <main className="pelican-result">
        <InstallApp />
        <div className="pelican-result__barcode">
          <BarcodePreview ref={barcodeRef} value={number} onError={(msg) => setBarcodeError(msg)} />
        </div>
        {barcodeError && <p className="pelican-result__error">{barcodeError}</p>}
        <p className="pelican-result__number">{number}</p>
        <button className="pelican-back" type="button" onClick={handleBack}>
          Back / Scan Again
        </button>
      </main>
    );
  }

  return (
    <main className="pelican-app">
      <InstallApp />
      <PelicanScanner onDetected={handleDetected} />
    </main>
  );
}
