import { useMemo, useState } from "react";
import { ArrowLeft, Coffee, Copy, Check, Download, Search, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { EVD_PRODUCTS, type Product } from "@/lib/productDb";
import BarcodePreview from "@/components/BarcodePreview";
import { detectBarcodeFormat } from "@/lib/pelican";
import { exportBarcodeDataUrl } from "@/lib/scanner/barcodeEngine";
import { useLang } from "@/lib/i18n";

type Props = {
  onBack: () => void;
  onSelectBarcode?: (barcode: string) => void;
};

type EvdCategory = "all" | "iced" | "hot" | "matcha" | "bakery";

export default function EvdPage({ onBack, onSelectBarcode }: Props) {
  const { lang } = useLang();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<EvdCategory>("all");
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [copied, setCopied] = useState(false);

  // Filter EVD products by category and query
  const filteredProducts = useMemo(() => {
    let list = EVD_PRODUCTS;

    if (category === "iced") {
      list = list.filter((p) => /iced|cold|frappe|tonic/i.test(p.name));
    } else if (category === "hot") {
      list = list.filter((p) => /latte|cappuccino|americano|espresso|flat white|hot/i.test(p.name) && !/iced|cold/i.test(p.name));
    } else if (category === "matcha") {
      list = list.filter((p) => /matcha|tea|chai/i.test(p.name));
    } else if (category === "bakery") {
      list = list.filter((p) => /croissant|cookie|cake|muffin|pastry|donut|bread|sandwich/i.test(p.name));
    }

    if (!query.trim()) return list;

    const q = query.toLowerCase().trim();
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.includes(q),
    );
  }, [category, query]);

  const handleProductClick = (product: Product) => {
    setActiveProduct(product);
    if (onSelectBarcode) onSelectBarcode(product.barcode);
  };

  const handleCopy = async () => {
    if (!activeProduct) return;
    try {
      await navigator.clipboard.writeText(activeProduct.barcode);
      setCopied(true);
      toast.success("Barcode copied to clipboard");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleDownload = () => {
    if (!activeProduct) return;
    const format = detectBarcodeFormat(activeProduct.barcode);
    const url = exportBarcodeDataUrl(activeProduct.barcode, format);
    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.download = `evd-${activeProduct.sku}-${activeProduct.barcode}.png`;
      a.click();
      toast.success("Barcode image downloaded");
    }
  };

  return (
    <div className="evd-page">
      {/* ── Header ── */}
      <header className="evd-header">
        <button type="button" className="evd-header__back" onClick={onBack} aria-label="Back">
          <ArrowLeft size={18} />
          <span>{lang === "ar" ? "العودة" : "Back"}</span>
        </button>

        <div className="evd-header__title-wrap">
          <div className="evd-header__icon">☕</div>
          <div>
            <h1 className="evd-header__title">Everyday Coffee Shop (EVD)</h1>
            <p className="evd-header__sub">{EVD_PRODUCTS.length} Store Products & Barcodes</p>
          </div>
        </div>
      </header>

      {/* ── Search & Filters ── */}
      <div className="evd-search-bar">
        <Search size={16} className="text-amber-400" />
        <input
          type="search"
          className="evd-search-input"
          placeholder="Search EVD drinks, bakery, or SKU (e.g. Latte, XOHQ95)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button type="button" className="evd-search-clear" onClick={() => setQuery("")}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* ── Category Pills ── */}
      <div className="evd-categories">
        <button
          type="button"
          className={`evd-cat-pill ${category === "all" ? "evd-cat-pill--active" : ""}`}
          onClick={() => setCategory("all")}
        >
          All Items ({EVD_PRODUCTS.length})
        </button>
        <button
          type="button"
          className={`evd-cat-pill ${category === "iced" ? "evd-cat-pill--active" : ""}`}
          onClick={() => setCategory("iced")}
        >
          🧊 Iced & Cold
        </button>
        <button
          type="button"
          className={`evd-cat-pill ${category === "hot" ? "evd-cat-pill--active" : ""}`}
          onClick={() => setCategory("hot")}
        >
          ☕ Hot Coffee
        </button>
        <button
          type="button"
          className={`evd-cat-pill ${category === "matcha" ? "evd-cat-pill--active" : ""}`}
          onClick={() => setCategory("matcha")}
        >
          🍵 Matcha & Tea
        </button>
        <button
          type="button"
          className={`evd-cat-pill ${category === "bakery" ? "evd-cat-pill--active" : ""}`}
          onClick={() => setCategory("bakery")}
        >
          🥐 Bakery
        </button>
      </div>

      {/* ── Active Product Scannable Barcode Hero Modal ── */}
      {activeProduct && (
        <div className="evd-modal-overlay" role="dialog" aria-modal="true">
          <div className="evd-modal-card">
            <div className="evd-modal-card__header">
              <div className="evd-modal-card__badge">
                <Sparkles size={13} />
                <span>EVD Barcode Ready</span>
              </div>
              <button
                type="button"
                className="evd-modal-card__close"
                onClick={() => setActiveProduct(null)}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            <div className="evd-modal-product-info">
              <h3 className="evd-modal-product-info__title">{activeProduct.name}</h3>
              <div className="evd-modal-product-info__meta">
                <span>SKU: <b>{activeProduct.sku}</b></span>
                <span>Category: <b>{activeProduct.subcategory || activeProduct.category}</b></span>
              </div>
              <div className="evd-modal-digits">
                <code>{activeProduct.barcode}</code>
              </div>
            </div>

            <div className="evd-modal-card__barcode">
              <BarcodePreview
                value={activeProduct.barcode}
                format={detectBarcodeFormat(activeProduct.barcode)}
                onError={() => {}}
              />
            </div>

            <div className="evd-modal-card__actions">
              <button
                type="button"
                className="button button--secondary flex-1"
                onClick={() => void handleCopy()}
              >
                {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                <span>{copied ? "Copied!" : "Copy Number"}</span>
              </button>
              <button
                type="button"
                className="button button--secondary flex-1"
                onClick={handleDownload}
              >
                <Download size={16} />
                <span>Download</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Product Grid ── */}
      <div className="evd-grid">
        {filteredProducts.length === 0 ? (
          <div className="evd-empty">
            <Coffee size={36} className="text-amber-500 mb-2" />
            <p>No EVD products found matching "{query}"</p>
          </div>
        ) : (
          filteredProducts.map((p) => (
            <button
              key={p.sku}
              type="button"
              className={`evd-product-card ${activeProduct?.sku === p.sku ? "evd-product-card--active" : ""}`}
              onClick={() => handleProductClick(p)}
            >
              <div className="evd-product-card__header">
                <span className="evd-product-card__name">{p.name}</span>
                <span className="evd-product-card__sku">{p.sku}</span>
              </div>

              <div className="evd-product-card__footer">
                <span className="evd-product-card__cat">{p.subcategory || p.category}</span>
                <span className="evd-product-card__barcode">{p.barcode}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
