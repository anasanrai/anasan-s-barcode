import { useMemo, useState } from "react";
import BarcodePreview, { FORMAT_CONFIG, type BarcodeFormat } from "./BarcodePreview";
import QRCodePreview from "./QRCodePreview";
import NumberInput from "./NumberInput";
import { useNumberHistory } from "@/lib/useNumberHistory";
import { PELICAN_LENGTH } from "@/lib/pelican";

const FORMAT_OPTIONS = Object.keys(FORMAT_CONFIG) as BarcodeFormat[];

type Props = { onScan?: () => void };

export default function BarcodeGenerator({ onScan }: Props) {
  const [input, setInput] = useState("");
  const [format, setFormat] = useState<BarcodeFormat>("CODE128");
  const [mode, setMode] = useState<"barcode" | "qr">("barcode");
  const [error, setError] = useState("");
  const { addNumber, findMatch } = useNumberHistory();

  const resolvedNumber = useMemo(() => {
    if (!input) return "";
    if (input.length === PELICAN_LENGTH) return input;
    return findMatch(input) ?? "";
  }, [input, findMatch]);

  const displayValue = input.length > 0 ? (resolvedNumber || input) : "";

  const handleNumberSubmit = () => {
    if (!displayValue) { setError("Enter a number to generate."); return; }
    setError("");
    addNumber(displayValue);
  };

  return (
    <div className="generator">
      <div className="generator__header">
        <h1 className="generator__title">HungerTag</h1>
        <p className="generator__subtitle">Scan. Generate. Done.</p>
      </div>

      <div className="generator__mode-switch">
        <button
          type="button"
          className={`generator__mode-btn ${mode === "barcode" ? "generator__mode-btn--active" : ""}`}
          onClick={() => setMode("barcode")}
        >
          Barcode
        </button>
        <button
          type="button"
          className={`generator__mode-btn ${mode === "qr" ? "generator__mode-btn--active" : ""}`}
          onClick={() => setMode("qr")}
        >
          QR Code
        </button>
      </div>

      {mode === "barcode" && (
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
      )}

      {mode === "barcode" && (
        <p className="generator__format-desc">{FORMAT_CONFIG[format].description}</p>
      )}

      <NumberInput
        value={input}
        onChange={(v) => { setInput(v); setError(""); }}
        onSubmit={handleNumberSubmit}
        findMatch={findMatch}
        format={format}
        placeholder={mode === "qr" ? "Enter text or URL…" : format === "CODE128" ? "Enter text or digits…" : "Enter digits…"}
      />

      {error && <p className="generator__error">{error}</p>}

      {displayValue && (
        <div className="generator__barcode">
          {mode === "barcode" ? (
            <BarcodePreview
              value={displayValue}
              format={format}
              onError={(msg) => setError(msg)}
            />
          ) : (
            <QRCodePreview
              value={displayValue}
              onError={(msg) => setError(msg)}
            />
          )}
          <p className="generator__number">{displayValue}</p>
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
