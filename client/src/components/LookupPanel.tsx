import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { searchProducts, EVD_PRODUCTS, type Product } from "@/lib/productDb";

type Props = {
  /** Called when the user selects a product — passes the full barcode */
  onSelect: (barcode: string, product: Product) => void;
};

type Filter = "all" | "evd";

export default function LookupPanel({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Product | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search when panel mounts
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  const results = useMemo(
    () => searchProducts(query, filter === "evd"),
    [query, filter],
  );

  const handleSelect = useCallback(
    (product: Product) => {
      setSelected(product);
      onSelect(product.barcode, product);
    },
    [onSelect],
  );

  const handleFilterChange = (f: Filter) => {
    setFilter(f);
    setQuery("");
    setSelected(null);
    inputRef.current?.focus();
  };

  const placeholder =
    filter === "evd"
      ? "Search EVD by name or SKU…"
      : "Type SKU, last digits, or product name…";

  const evdCount = EVD_PRODUCTS.length;

  return (
    <div className="lookup">
      {/* ── Filter pills ── */}
      <div className="lookup__filters">
        <button
          type="button"
          id="lookup-filter-all"
          className={`lookup__filter-btn ${filter === "all" ? "lookup__filter-btn--active" : ""}`}
          onClick={() => handleFilterChange("all")}
        >
          📦 All Products
        </button>
        <button
          type="button"
          id="lookup-filter-evd"
          className={`lookup__filter-btn lookup__filter-btn--evd ${filter === "evd" ? "lookup__filter-btn--active" : ""}`}
          onClick={() => handleFilterChange("evd")}
        >
          ☕ EVD Coffee
          <span className="lookup__filter-count">{evdCount}</span>
        </button>
      </div>

      {/* ── EVD hero banner (shown only when EVD filter is active) ── */}
      {filter === "evd" && (
        <div className="lookup__evd-banner">
          <div className="lookup__evd-banner-icon">☕</div>
          <div>
            <div className="lookup__evd-banner-title">Everyday Coffee Shop</div>
            <div className="lookup__evd-banner-sub">
              {evdCount} products · Type SKU suffix or name to filter
            </div>
          </div>
        </div>
      )}

      {/* ── Search input ── */}
      <div className="lookup__search-wrap">
        <span className="lookup__search-icon">🔍</span>
        <input
          ref={inputRef}
          id="lookup-search"
          type="search"
          className="lookup__search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
          }}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {query && (
          <button
            type="button"
            className="lookup__search-clear"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              setSelected(null);
              inputRef.current?.focus();
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Results hint ── */}
      <div className="lookup__hint">
        {query
          ? `${results.length} result${results.length !== 1 ? "s" : ""} for "${query}"`
          : filter === "evd"
            ? `Showing all ${results.length} EVD Coffee products`
            : `Showing top ${results.length} products — type to filter`}
      </div>

      {/* ── Results list ── */}
      <ul className="lookup__results" role="listbox" aria-label="Product results">
        {results.length === 0 ? (
          <li className="lookup__empty">
            <span>😕</span>
            <span>No products found for "{query}"</span>
          </li>
        ) : (
          results.map((product) => (
            <li
              key={product.sku}
              role="option"
              aria-selected={selected?.sku === product.sku}
              className={`lookup__result ${selected?.sku === product.sku ? "lookup__result--selected" : ""} ${product.isEvd ? "lookup__result--evd" : ""}`}
              onClick={() => handleSelect(product)}
            >
              <div className="lookup__result-main">
                <span className="lookup__result-name">{product.name}</span>
                <div className="lookup__result-meta">
                  <span className="lookup__result-sku">{product.sku}</span>
                  {product.isEvd && (
                    <span className="lookup__result-evd-badge">☕ EVD</span>
                  )}
                  {product.subcategory && (
                    <span className="lookup__result-cat">{product.subcategory}</span>
                  )}
                </div>
              </div>
              <div className="lookup__result-right">
                <span className="lookup__result-barcode">{product.barcode}</span>
                <span className="lookup__result-cta">
                  {selected?.sku === product.sku ? "✓ Generated" : "Generate →"}
                </span>
              </div>
            </li>
          ))
        )}
      </ul>

      {/* ── Selected product confirmation ── */}
      {selected && (
        <div className="lookup__confirm" role="alert">
          <span>✓</span>
          <div>
            <strong>{selected.name}</strong>
            <div className="lookup__confirm-sub">
              Barcode <code>{selected.barcode}</code> loaded in Generate tab
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
