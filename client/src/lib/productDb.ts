/**
 * productDb.ts
 * Search utilities over the static product catalog.
 */

import { PRODUCTS, EVD_PRODUCTS, type Product } from "@/data/products";

export type { Product };
export { EVD_PRODUCTS };

const LIMIT = 60;

/**
 * Normalize a string for fuzzy matching: lowercase, strip spaces/dashes.
 */
function norm(s: string): string {
  return s.toLowerCase().replace(/[\s\-_]/g, "");
}

/**
 * Search all products (or EVD subset) by:
 *  - SKU prefix/contains
 *  - Barcode suffix/contains
 *  - Product name contains
 *
 * Returns up to LIMIT results, ranked: exact SKU match first, then SKU prefix,
 * then barcode suffix match, then name match.
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
    const nBarcode = product.barcode;

    let score = 0;

    // Exact SKU match
    if (product.sku.toUpperCase() === qUp) {
      score = 100;
    }
    // SKU starts with query
    else if (product.sku.toUpperCase().startsWith(qUp)) {
      score = 80;
    }
    // SKU contains query
    else if (nSku.includes(nq)) {
      score = 60;
    }
    // Barcode ends with query (last-digits lookup)
    else if (nBarcode.endsWith(q)) {
      score = 70;
    }
    // Barcode contains query
    else if (nBarcode.includes(q)) {
      score = 55;
    }
    // Name contains query (word boundary preferred)
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
