import { useEffect, useMemo, useState } from "react";
import BarcodePreview, { FORMAT_CONFIG, type BarcodeFormat } from "./BarcodePreview";
import QRCodePreview from "./QRCodePreview";
import NumberInput from "./NumberInput";
import { useNumberHistory } from "@/lib/useNumberHistory";
import { PELICAN_LENGTH } from "@/lib/pelican";
import { useLang } from "@/lib/i18n";

const FORMAT_OPTIONS = Object.keys(FORMAT_CONFIG) as BarcodeFormat[];

type Props = {
  initialValue?: string;
};

export default function BarcodeGenerator({ initialValue = "" }: Props) {
  const { t, lang } = useLang();
  const [input, setInput] = useState(initialValue);
  const [format, setFormat] = useState<BarcodeFormat>("CODE128");
  const [mode, setMode] = useState<"barcode" | "qr">("barcode");
  const [error, setError] = useState("");
  const { addNumber, findMatch } = useNumberHistory();

  useEffect(() => {
    if (initialValue) {
      setInput(initialValue);
      setError("");
    }
  }, [initialValue]);

  const resolvedNumber = useMemo(() => {
    if (!input) return "";
    if (input.length === PELICAN_LENGTH) return input;
    return findMatch(input) ?? "";
  }, [input, findMatch]);

  const displayValue = input.length > 0 ? (resolvedNumber || input) : "";

  const handleNumberSubmit = () => {
    if (!displayValue) {
      setError(t.notReady);
      return;
    }
    setError("");
    addNumber(displayValue);
  };

  return (
    <div className="generator">
      <div className="generator__header">
        <h1 className="generator__title">
          {lang === "ar" ? (
            <>
              باركود <span className="brand-accent">هنغرستيشن</span>
            </>
          ) : (
            <>
              Hunger<span className="brand-accent">Station</span> Barcode
            </>
          )}
        </h1>
        <p className="generator__subtitle">{t.subtitle}</p>
      </div>

      <div className="generator__mode-switch">
        <button
          type="button"
          className={`generator__mode-btn ${mode === "barcode" ? "generator__mode-btn--active" : ""}`}
          onClick={() => setMode("barcode")}
        >
          {t.barcode}
        </button>
        <button
          type="button"
          className={`generator__mode-btn ${mode === "qr" ? "generator__mode-btn--active" : ""}`}
          onClick={() => setMode("qr")}
        >
          {t.qrCode}
        </button>
      </div>

      {mode === "barcode" && (
        <div className="generator__formats-scroll">
          {FORMAT_OPTIONS.map((f) => (
            <button
              key={f}
              type="button"
              className={`generator__format-btn ${format === f ? "generator__format-btn--active" : ""}`}
              onClick={() => {
                setFormat(f);
                setError("");
              }}
            >
              {FORMAT_CONFIG[f].label}
            </button>
          ))}
        </div>
      )}

      <NumberInput
        value={input}
        onChange={(v) => {
          setInput(v);
          setError("");
        }}
        onSubmit={handleNumberSubmit}
        findMatch={findMatch}
        format={format}
        placeholder={mode === "qr" ? t.enterTextOrUrl : FORMAT_CONFIG[format].example}
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
        </div>
      )}
    </div>
  );
}
