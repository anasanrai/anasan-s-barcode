import { useEffect, useMemo, useState } from "react";
import { Camera, Check, Copy, Download, HelpCircle, Package, QrCode, Search, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import BarcodePreview, { FORMAT_CONFIG, type BarcodeFormat } from "./BarcodePreview";
import QRCodePreview from "./QRCodePreview";
import NumberInput from "./NumberInput";
import { useNumberHistory } from "@/lib/useNumberHistory";
import { lookupBySuffixOrSku, type Product, type SuffixMatchResult } from "@/lib/productDb";
import { detectBarcodeFormat, PELICAN_LENGTH } from "@/lib/pelican";
import { exportBarcodeDataUrl } from "@/lib/scanner/barcodeEngine";
import { useLang } from "@/lib/i18n";

const FORMAT_OPTIONS = Object.keys(FORMAT_CONFIG) as BarcodeFormat[];

type Props = {
  initialValue?: string;
  onOpenScanner?: () => void;
};

export default function BarcodeGenerator({ initialValue = "", onOpenScanner }: Props) {
  const { t, lang } = useLang();
  const [input, setInput] = useState(initialValue);
  const [format, setFormat] = useState<BarcodeFormat>("CODE128");
  const [mode, setMode] = useState<"barcode" | "qr">("barcode");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [copied, setCopied] = useState(false);
  const { addNumber, findMatch } = useNumberHistory();

  useEffect(() => {
    if (initialValue) {
      setInput(initialValue);
      setSelectedProduct(null);
    }
  }, [initialValue]);

  // Real-time partial suffix & SKU lookup
  const matchResult: SuffixMatchResult = useMemo(() => {
    if (!input.trim() || mode === "qr") {
      return { status: "empty", products: [], query: input };
    }
    return lookupBySuffixOrSku(input);
  }, [input, mode]);

  // Determine active barcode value to render
  const resolvedValue = useMemo(() => {
    if (selectedProduct) return selectedProduct.barcode;
    if (matchResult.status === "exact_match" && matchResult.resolvedBarcode) {
      return matchResult.resolvedBarcode;
    }
    // If raw input is 8-18 digits, render it directly
    if (/^\d{8,18}$/.test(input.replace(/[\s\-_]/g, ""))) {
      return input.replace(/[\s\-_]/g, "");
    }
    return "";
  }, [selectedProduct, matchResult, input]);

  // Automatically update format if GTIN-14 / EAN-13 detected
  useEffect(() => {
    if (resolvedValue) {
      const autoFormat = detectBarcodeFormat(resolvedValue);
      setFormat(autoFormat);
    }
  }, [resolvedValue]);

  const handleProductCardClick = (product: Product) => {
    setSelectedProduct(product);
    setInput(product.barcode);
    addNumber(product.barcode);
    toast.success(`Loaded ${product.name}`);
  };

  const handleCopy = async () => {
    if (!resolvedValue) return;
    try {
      await navigator.clipboard.writeText(resolvedValue);
      setCopied(true);
      toast.success(t.copied);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleDownload = () => {
    if (!resolvedValue) return;
    const url = exportBarcodeDataUrl(resolvedValue, format);
    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.download = `barcode-${resolvedValue}.png`;
      a.click();
      toast.success("Barcode downloaded");
    }
  };

  const activeProduct = selectedProduct || matchResult.matchedProduct;

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
        <p className="generator__subtitle">
          {lang === "ar"
            ? "أدخل آخر 5–7 أرقام من الباركود أو رمز SKU للحصول على الباركود فوراً"
            : "Enter last 5–7 digits or SKU for instant complete barcode generation"}
        </p>
      </div>

      {/* Mode switch */}
      <div className="generator__mode-switch">
        <button
          type="button"
          className={`generator__mode-btn ${mode === "barcode" ? "generator__mode-btn--active" : ""}`}
          onClick={() => {
            setMode("barcode");
            setSelectedProduct(null);
          }}
        >
          <span>{t.barcode}</span>
        </button>
        <button
          type="button"
          className={`generator__mode-btn ${mode === "qr" ? "generator__mode-btn--active" : ""}`}
          onClick={() => {
            setMode("qr");
            setSelectedProduct(null);
          }}
        >
          <QrCode size={14} />
          <span>{t.qrCode}</span>
        </button>
      </div>

      {/* Main Input Box */}
      <div className="generator__input-section">
        <NumberInput
          value={input}
          onChange={(v) => {
            setInput(v);
            setSelectedProduct(null);
          }}
          onSubmit={() => {
            if (resolvedValue) addNumber(resolvedValue);
          }}
          findMatch={findMatch}
          format={format}
          placeholder={
            mode === "qr"
              ? t.enterTextOrUrl
              : "Enter last 5–7 digits or SKU (e.g. 276458, 06WMI4)…"
          }
        />
      </div>

      {/* Case 1: EXACT MATCH / FULL BARCODE RESOLVED */}
      {resolvedValue && mode === "barcode" && (
        <div className="smart-match-card smart-match-card--exact">
          <div className="smart-match-card__header">
            <div className="smart-match-card__badge">
              <Sparkles size={13} />
              <span>
                {matchResult.status === "exact_match" && input.length < 12
                  ? `Matched suffix: ${input} → ${resolvedValue}`
                  : `Complete Barcode: ${resolvedValue}`}
              </span>
            </div>
            <span className="smart-match-card__format">{format}</span>
          </div>

          {activeProduct && (
            <div className="smart-match-product-info">
              <span className="smart-match-product-info__name">{activeProduct.name}</span>
              <div className="smart-match-product-info__meta">
                <span className="smart-match-product-info__sku">SKU: {activeProduct.sku}</span>
                <span className="smart-match-product-info__cat">{activeProduct.category}</span>
                {activeProduct.isEvd && <span className="smart-match-product-info__evd">☕ EVD</span>}
              </div>
            </div>
          )}

          <div className="smart-match-card__barcode">
            <BarcodePreview
              value={resolvedValue}
              format={format}
              onError={() => {}}
            />
          </div>

          <div className="smart-match-card__actions">
            <button
              type="button"
              className="button button--secondary smart-action-btn"
              onClick={() => void handleCopy()}
            >
              {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
              <span>{copied ? t.copied : t.copyNumber}</span>
            </button>
            <button
              type="button"
              className="button button--secondary smart-action-btn"
              onClick={handleDownload}
            >
              <Download size={15} />
              <span>Download</span>
            </button>
          </div>
        </div>
      )}

      {/* Case 2: MULTIPLE MATCHES — User selects the intended product */}
      {matchResult.status === "multiple_matches" && mode === "barcode" && (
        <div className="smart-multi-match">
          <div className="smart-multi-match__title">
            <HelpCircle size={15} className="text-amber-400" />
            <span>
              Found {matchResult.products.length} products ending with <b>"{input}"</b> — Select matching item:
            </span>
          </div>
          <div className="smart-multi-match__list" role="listbox">
            {matchResult.products.map((p) => (
              <button
                key={p.sku}
                type="button"
                className="smart-multi-match__item"
                onClick={() => handleProductCardClick(p)}
              >
                <div className="smart-multi-match__item-main">
                  <span className="smart-multi-match__item-name">{p.name}</span>
                  <div className="smart-multi-match__item-meta">
                    <span className="smart-multi-match__item-sku">SKU: {p.sku}</span>
                    <span className="smart-multi-match__item-cat">{p.subcategory || p.category}</span>
                    {p.isEvd && <span className="smart-match-product-info__evd">☕ EVD</span>}
                  </div>
                </div>
                <div className="smart-multi-match__item-right">
                  <code>{p.barcode}</code>
                  <span className="smart-multi-match__select-btn">Generate →</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Case 3: NOT FOUND IN DATABASE — Direct fallback button to Camera Scanner */}
      {matchResult.status === "not_found" && mode === "barcode" && (
        <div className="smart-not-found">
          <div className="smart-not-found__banner">
            <Package size={28} className="text-slate-400" />
            <div>
              <h4>No product found for "{input}"</h4>
              <p>The partial number is not in the local database. Scan the full barcode from the device screen.</p>
            </div>
          </div>

          {onOpenScanner && (
            <button
              type="button"
              className="button button--primary smart-not-found__scan-btn"
              onClick={onOpenScanner}
            >
              <Camera size={18} />
              <span>Open Camera Scanner (OCR)</span>
            </button>
          )}
        </div>
      )}

      {/* QR Code preview when in QR mode */}
      {mode === "qr" && input.trim() && (
        <div className="generator__barcode">
          <QRCodePreview value={input.trim()} onError={() => {}} />
        </div>
      )}

      {/* Formats scrollbar at bottom */}
      {mode === "barcode" && (
        <div className="generator__formats-scroll mt-4">
          {FORMAT_OPTIONS.map((f) => (
            <button
              key={f}
              type="button"
              className={`generator__format-btn ${format === f ? "generator__format-btn--active" : ""}`}
              onClick={() => setFormat(f)}
            >
              {FORMAT_CONFIG[f].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
