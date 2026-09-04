import { useEffect, useMemo, useState } from "react";
import { Barcode, Camera, Check, Copy, Download, History, Printer, QrCode, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import BarcodePreview, { FORMAT_CONFIG, type BarcodeFormat } from "./BarcodePreview";
import QRCodePreview from "./QRCodePreview";
import NumberInput from "./NumberInput";
import { useNumberHistory } from "@/lib/useNumberHistory";
import { detectBarcodeFormat } from "@/lib/pelican";
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
  const [copied, setCopied] = useState(false);
  const { history, addNumber, findMatch, clearHistory } = useNumberHistory();

  useEffect(() => {
    if (initialValue) {
      setInput(initialValue);
    }
  }, [initialValue]);

  // Clean value for generation
  const resolvedValue = useMemo(() => {
    const trimmed = input.trim();
    if (!trimmed) return "";
    if (mode === "qr") return trimmed;
    // Strip common separators for barcode
    return trimmed.replace(/[\s\-_]/g, "");
  }, [input, mode]);

  // Automatically adjust format if user enters a standard GTIN/EAN length
  useEffect(() => {
    if (resolvedValue && mode === "barcode") {
      const auto = detectBarcodeFormat(resolvedValue);
      setFormat(auto);
    }
  }, [resolvedValue, mode]);

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

  const handlePrint = () => {
    if (!resolvedValue) return;
    window.print();
  };

  const handleSelectHistory = (item: string) => {
    setInput(item);
    toast.success(`Loaded ${item}`);
  };

  return (
    <div className="generator">
      <div className="generator__header">
        <h1 className="generator__title">
          {lang === "ar" ? (
            <>
              مولد <span className="brand-accent">الباركود</span>
            </>
          ) : (
            <>
              Barcode <span className="brand-accent">Generator</span>
            </>
          )}
        </h1>
        <p className="generator__subtitle">
          {lang === "ar"
            ? "أدخل أي رقم أو نص لإنشاء باركود فوري ورمز QR مع مسح مباشر"
            : "Enter digits or text for instant barcode & QR generation"}
        </p>
      </div>

      {/* Mode switch */}
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
          className={`generator__mode-btn ${mode === "qr" ? "generator__mode-btn--active" : ""}`}
          onClick={() => setMode("qr")}
        >
          <QrCode size={15} />
          <span>{t.qrCode}</span>
        </button>
      </div>

      {/* Main Input Box */}
      <div className="generator__input-section">
        <NumberInput
          value={input}
          onChange={(v) => setInput(v)}
          onSubmit={() => {
            if (resolvedValue) addNumber(resolvedValue);
          }}
          findMatch={findMatch}
          format={format}
          placeholder={
            mode === "qr"
              ? t.enterTextOrUrl
              : "Enter number or code (e.g. 6281007012345)..."
          }
        />
      </div>

      {/* Barcode / QR Preview Card */}
      {resolvedValue ? (
        <div className="smart-match-card smart-match-card--exact">
          <div className="smart-match-card__header">
            <div className="smart-match-card__badge">
              <Sparkles size={13} />
              <span>
                {mode === "barcode"
                  ? `Barcode: ${resolvedValue}`
                  : `QR Code: ${resolvedValue.length > 28 ? resolvedValue.slice(0, 28) + "…" : resolvedValue}`}
              </span>
            </div>
            {mode === "barcode" && (
              <span className="smart-match-card__format">{format}</span>
            )}
          </div>

          <div className="smart-match-card__barcode">
            {mode === "barcode" ? (
              <BarcodePreview
                value={resolvedValue}
                format={format}
                onError={() => {}}
              />
            ) : (
              <QRCodePreview value={resolvedValue} onError={() => {}} />
            )}
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
            <button
              type="button"
              className="button button--secondary smart-action-btn"
              onClick={handlePrint}
            >
              <Printer size={15} />
              <span>Print</span>
            </button>
            {onOpenScanner && (
              <button
                type="button"
                className="button button--secondary smart-action-btn"
                onClick={onOpenScanner}
              >
                <Camera size={15} />
                <span>Scan</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        onOpenScanner && (
          <div className="generator__empty-state">
            <button
              type="button"
              className="button button--primary generator__scan-cta"
              onClick={onOpenScanner}
            >
              <Camera size={18} />
              <span>{lang === "ar" ? "فتح الماسح بالكاميرا" : "Open Camera Scanner"}</span>
            </button>
          </div>
        )
      )}

      {/* Formats scrollbar at bottom (in barcode mode) */}
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

      {/* Recent Scans / History Section */}
      {history.length > 0 && (
        <div className="generator__history-section mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
              <History size={13} />
              {lang === "ar" ? "السجل الأخير" : "Recent History"}
            </span>
            <button
              type="button"
              className="text-xs text-slate-500 hover:text-rose-400 transition-colors flex items-center gap-1"
              onClick={clearHistory}
            >
              <Trash2 size={12} />
              <span>{lang === "ar" ? "مسح" : "Clear"}</span>
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {history.slice(0, 8).map((item) => (
              <button
                key={item}
                type="button"
                className="px-2.5 py-1 text-xs font-mono bg-white/5 hover:bg-white/10 border border-white/10 rounded-md transition-colors"
                onClick={() => handleSelectHistory(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
