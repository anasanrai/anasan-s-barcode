import { useEffect, useMemo, useState } from "react";
import { Barcode, QrCode, Search, Package } from "lucide-react";
import BarcodePreview, { FORMAT_CONFIG, type BarcodeFormat } from "./BarcodePreview";
import QRCodePreview from "./QRCodePreview";
import NumberInput from "./NumberInput";
import LookupPanel from "./LookupPanel";
import { useNumberHistory } from "@/lib/useNumberHistory";
import { PELICAN_LENGTH } from "@/lib/pelican";
import { useLang } from "@/lib/i18n";
import type { Product } from "@/lib/productDb";

const FORMAT_OPTIONS = Object.keys(FORMAT_CONFIG) as BarcodeFormat[];

type Props = {
  initialValue?: string;
  /** When set by a parent, immediately loads this value into the generator. */
  pushedValue?: string;
};

export default function BarcodeGenerator({ initialValue = "", pushedValue }: Props) {
  const { t, lang } = useLang();
  const [input, setInput] = useState(initialValue);
  const [format, setFormat] = useState<BarcodeFormat>("CODE128");
  const [mode, setMode] = useState<"barcode" | "lookup" | "qr">("barcode");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [error, setError] = useState("");
  const { addNumber, findMatch } = useNumberHistory();

  useEffect(() => {
    if (initialValue) {
      setInput(initialValue);
      setError("");
    }
  }, [initialValue]);

  useEffect(() => {
    if (pushedValue) {
      const barcode = pushedValue.replace(/__v\d+$/, "");
      setInput(barcode);
      setError("");
    }
  }, [pushedValue]);

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

  const handleProductSelect = (barcode: string, product: Product) => {
    setInput(barcode);
    setSelectedProduct(product);
    setError("");
    addNumber(barcode);
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

      {/* Mode switch for Store Workbench: Barcode, Product Catalog, QR Code */}
      <div className="generator__mode-switch">
        <button
          type="button"
          className={`generator__mode-btn ${mode === "barcode" ? "generator__mode-btn--active" : ""}`}
          onClick={() => setMode("barcode")}
        >
          <Barcode size={15} />
          <span>{t.barcode}</span>
        </button>
        <button
          type="button"
          className={`generator__mode-btn ${mode === "lookup" ? "generator__mode-btn--active" : ""}`}
          onClick={() => setMode("lookup")}
        >
          <Package size={15} />
          <span>{t.storeLookup}</span>
        </button>
        <button
          type="button"
          className={`generator__mode-btn ${mode === "qr" ? "generator__mode-btn--active" : ""}`}
          onClick={() => setMode("qr")}
        >
          <QrCode size={15} />
          <span>{t.qrCode}</span>
        </button>
      </div>

      {/* Barcode Formats Selector (for Barcode or Lookup mode) */}
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

      {/* Active Barcode Preview if value is loaded (shows at top of Lookup as well) */}
      {displayValue && (
        <div className="generator__barcode">
          {selectedProduct && (
            <div className="generator__product-badge">
              <span>{selectedProduct.name}</span>
              <code>SKU: {selectedProduct.sku}</code>
            </div>
          )}
          {mode !== "qr" ? (
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

      {/* Mode 1: Manual Barcode Input */}
      {mode === "barcode" && (
        <>
          <NumberInput
            value={input}
            onChange={(v) => {
              setInput(v);
              setSelectedProduct(null);
              setError("");
            }}
            onSubmit={handleNumberSubmit}
            findMatch={findMatch}
            format={format}
            placeholder={FORMAT_CONFIG[format].example}
          />
          {error && <p className="generator__error">{error}</p>}
        </>
      )}

      {/* Mode 2: Store Product Catalog Lookup */}
      {mode === "lookup" && (
        <div className="generator__lookup-container">
          <LookupPanel onSelect={handleProductSelect} />
        </div>
      )}

      {/* Mode 3: QR Code Generator */}
      {mode === "qr" && (
        <>
          <NumberInput
            value={input}
            onChange={(v) => {
              setInput(v);
              setSelectedProduct(null);
              setError("");
            }}
            onSubmit={handleNumberSubmit}
            findMatch={findMatch}
            format={format}
            placeholder={t.enterTextOrUrl}
          />
          {error && <p className="generator__error">{error}</p>}
        </>
      )}
    </div>
  );
}
