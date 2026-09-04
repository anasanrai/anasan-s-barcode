/**
 * productDb.ts
 * Search utilities over the static product catalog with smart partial suffix matching.
 */

import { PRODUCTS, EVD_PRODUCTS, type Product } from "@/data/products";

export type { Product };
export { PRODUCTS, EVD_PRODUCTS };

const LIMIT = 60;

function norm(s: string): string {
  return s.toLowerCase().replace(/[\s\-_]/g, "");
}

export interface SuffixMatchResult {
  status: "exact_match" | "multiple_matches" | "not_found" | "empty";
  products: Product[];
  resolvedBarcode?: string;
  matchedProduct?: Product;
  query: string;
}

/**
 * Smart partial lookup:
 * - If input matches an exact full barcode or GTIN (e.g. 12-14 digits)
 * - If input is a 4-11 digit suffix (e.g. "003788" for "06281016003788")
 * - If input is an exact SKU
 */
export function lookupBySuffixOrSku(input: string, evdOnly = false): SuffixMatchResult {
  const q = input.trim();
  if (!q) {
    return { status: "empty", products: [], query: q };
  }

  const pool = evdOnly ? EVD_PRODUCTS : PRODUCTS;
  const qClean = q.replace(/[\s\-_]/g, "");
  const qUp = q.toUpperCase();

  // 1. Direct Full Barcode Match in DB
  const exactBarcodeMatch = pool.find((p) =>
    p.barcode === qClean ||
    p.barcode === q ||
    (p.barcodes && p.barcodes.some((b) => b === qClean || b === q)),
  );
  if (exactBarcodeMatch) {
    const matchedBarcode =
      exactBarcodeMatch.barcodes?.find((b) => b === qClean || b === q) ||
      exactBarcodeMatch.barcode;
    return {
      status: "exact_match",
      resolvedBarcode: matchedBarcode,
      matchedProduct: exactBarcodeMatch,
      products: [exactBarcodeMatch],
      query: q,
    };
  }

  // 2. Direct SKU Match
  const exactSkuMatches = pool.filter((p) => p.sku.toUpperCase() === qUp);
  if (exactSkuMatches.length === 1) {
    return {
      status: "exact_match",
      resolvedBarcode: exactSkuMatches[0].barcode,
      matchedProduct: exactSkuMatches[0],
      products: exactSkuMatches,
      query: q,
    };
  } else if (exactSkuMatches.length > 1) {
    return {
      status: "multiple_matches",
      products: exactSkuMatches,
      query: q,
    };
  }

  // 3. Suffix Matching: Barcode ends with query (e.g. last 5-7 digits)
  if (/^\d{3,13}$/.test(qClean)) {
    const suffixMatches = pool.filter(
      (p) =>
        p.barcode.endsWith(qClean) ||
        (p.barcodes && p.barcodes.some((b) => b.endsWith(qClean))),
    );
    if (suffixMatches.length === 1) {
      const p = suffixMatches[0];
      const matchedBarcode =
        p.barcodes?.find((b) => b.endsWith(qClean)) || p.barcode;
      return {
        status: "exact_match",
        resolvedBarcode: matchedBarcode,
        matchedProduct: p,
        products: suffixMatches,
        query: q,
      };
    } else if (suffixMatches.length > 1) {
      return {
        status: "multiple_matches",
        products: suffixMatches,
        query: q,
      };
    }
  }

  // 4. If query is a full valid numeric code (8-18 digits) not found in static catalog,
  // allow direct generation as exact match without product metadata
  if (/^\d{8,18}$/.test(qClean)) {
    return {
      status: "exact_match",
      resolvedBarcode: qClean,
      products: [],
      query: q,
    };
  }

  // 5. General search fallback (contains query in name/sku/barcode)
  const fuzzy = searchProducts(q, evdOnly);
  if (fuzzy.length > 0) {
    return {
      status: "multiple_matches",
      products: fuzzy,
      query: q,
    };
  }

  return { status: "not_found", products: [], query: q };
}

/**
 * Search all products (or EVD subset) by:
 *  - SKU prefix/contains
 *  - Barcode suffix/contains
 *  - Product name contains
 */
export function searchProducts(query: string, evdOnly = false): Product[] {
  const q = query.trim();
  if (!q) return (evdOnly ? EVD_PRODUCTS : PRODUCTS).slice(0, LIMIT);

  const pool = evdOnly ? EVD_PRODUCTS : PRODUCTS;
  const nq = norm(q);
  const qUp = q.toUpperCase();

  type Scored = { product: Product; score: number };
  const results: Scored[] = [];

  for (const product of pool) {
    const nSku = norm(product.sku);
    const nName = norm(product.name);
    const allBarcodes = product.barcodes || [product.barcode];

    let score = 0;

    // Exact SKU match
    if (product.sku.toUpperCase() === qUp) {
      score = 100;
    }
    // SKU starts with query
    else if (product.sku.toUpperCase().startsWith(qUp)) {
      score = 80;
    }
    // Any barcode ends with query (last-digits lookup)
    else if (allBarcodes.some((b) => b.endsWith(q))) {
      score = 75;
    }
    // SKU contains query
    else if (nSku.includes(nq)) {
      score = 60;
    }
    // Any barcode contains query
    else if (allBarcodes.some((b) => b.includes(q))) {
      score = 55;
    }
    // Name contains query
    else if (nName.includes(nq)) {
      score = nName.startsWith(nq) ? 45 : 30;
    }

    if (score > 0) results.push({ product, score });
  }

  return results
    .sort((a, b) => b.score - a.score || a.product.sku.localeCompare(b.product.sku))
    .slice(0, LIMIT)
    .map((r) => r.product);
}
