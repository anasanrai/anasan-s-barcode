import { useState } from "react";
import BarcodePreview, { FORMAT_CONFIG, type BarcodeFormat } from "./BarcodePreview";
import NumberInput from "./NumberInput";
import { useNumberHistory } from "@/lib/useNumberHistory";
import { PELICAN_LENGTH } from "@/lib/pelican";

const FORMAT_OPTIONS = Object.keys(FORMAT_CONFIG) as BarcodeFormat[];

type Props = { onScan?: () => void };

export default function BarcodeGenerator({ onScan }: Props) {
  const [input, setInput] = useState("");
  const [format, setFormat] = useState<BarcodeFormat>("CODE128");
  const [activeNumber, setActiveNumber] = useState("");
  const [activeFormat, setActiveFormat] = useState<BarcodeFormat>("CODE128");
  const [error, setError] = useState("");
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const { addNumber, findMatch } = useNumberHistory();

  const handleGenerate = () => {
    const num = input.length === PELICAN_LENGTH ? input : findMatch(input);
    if (!num) { setError("Enter a number to generate."); return; }
    setError("");
    setActiveNumber(num);
    setActiveFormat(format);
    addNumber(num);
  };

  return (
    <div className="generator">
      <div className="generator__header">
        <h1 className="generator__title">Pelican Barcode</h1>
        <p className="generator__subtitle">Generate barcodes in multiple formats.</p>
      </div>

      <div className="generator__formats">
        {FORMAT_OPTIONS.map((f) => (
          <button
            key={f}
            type="button"
            className={`generator__format-btn ${format === f ? "generator__format-btn--active" : ""}`}
            onClick={() => { setFormat(f); setError(""); }}
          >
            {FORMAT_CONFIG[f].label}
          </button>
        ))}
      </div>

      <p className="generator__format-desc">{FORMAT_CONFIG[format].description}</p>

      <NumberInput
        value={input}
        onChange={(v) => { setInput(v); setError(""); }}
        onSubmit={handleGenerate}
        findMatch={findMatch}
        format={format}
        placeholder={format === "CODE128" ? "Enter text or digits…" : "Enter digits…"}
      />

      <button type="button" className="generator__btn" onClick={handleGenerate}>
        Generate Barcode
      </button>

      {error && <p className="generator__error">{error}</p>}

      {activeNumber && (
        <div className="generator__barcode">
          <BarcodePreview
            value={activeNumber}
            format={activeFormat}
            onError={(msg) => setError(msg)}
            onValid={(v) => setIsValid(v)}
          />
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
