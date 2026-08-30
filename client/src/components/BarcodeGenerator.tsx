import { useState } from "react";
import BarcodePreview from "./BarcodePreview";
import NumberInput from "./NumberInput";
import { useNumberHistory } from "@/lib/useNumberHistory";
import { PELICAN_LENGTH } from "@/lib/pelican";

type Props = { onScan?: () => void };

export default function BarcodeGenerator({ onScan }: Props) {
  const [input, setInput] = useState("");
  const [activeNumber, setActiveNumber] = useState("");
  const [error, setError] = useState("");
  const { addNumber, findMatch } = useNumberHistory();

  const handleGenerate = () => {
    const num = input.length === PELICAN_LENGTH ? input : findMatch(input);
    if (!num || num.length !== PELICAN_LENGTH) {
      setError("Enter exactly 14 digits or a matching suffix.");
      return;
    }
    setError("");
    setActiveNumber(num);
    addNumber(num);
  };

  const handleUseDetected = (num: string) => {
    setInput(num);
    setActiveNumber(num);
    addNumber(num);
    setError("");
  };

  return (
    <div className="generator">
      <div className="generator__header">
        <h1 className="generator__title">Pelican Barcode</h1>
        <p className="generator__subtitle">Enter a 14-digit number or type last digits to recall.</p>
      </div>

      <NumberInput
        value={input}
        onChange={(v) => { setInput(v); setError(""); }}
        onSubmit={handleGenerate}
        findMatch={findMatch}
        placeholder="Type last 4-6 digits to recall…"
      />

      <button type="button" className="generator__btn" onClick={handleGenerate}>
        Generate Barcode
      </button>

      {error && <p className="generator__error">{error}</p>}

      {activeNumber && (
        <div className="generator__barcode">
          <BarcodePreview value={activeNumber} onError={(msg) => setError(msg)} />
          <p className="generator__number">{activeNumber}</p>
        </div>
      )}

      {onScan && (
        <button type="button" className="generator__switch" onClick={onScan}>
          Switch to Scanner
        </button>
      )}
    </div>
  );
}

export { BarcodeGenerator };
