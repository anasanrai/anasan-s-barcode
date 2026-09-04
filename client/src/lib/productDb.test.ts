import { describe, expect, it } from "vitest";
import { lookupBySuffixOrSku } from "./productDb";

describe("Smart Partial Barcode Lookup", () => {
  it("resolves exact suffix to full barcode when single match exists", () => {
    // Suffix "276458" -> 06281016276458 (Al Batal Chips Burning Hot)
    const res = lookupBySuffixOrSku("276458");
    expect(res.status).toBe("exact_match");
    expect(res.resolvedBarcode).toBe("06281016276458");
    expect(res.matchedProduct).toBeDefined();
    expect(res.matchedProduct?.name).toContain("Al Batal");
  });

  it("returns multiple_matches if multiple products share suffix", () => {
    const res = lookupBySuffixOrSku("12");
    expect(["multiple_matches", "exact_match"]).toContain(res.status);
    expect(res.products.length).toBeGreaterThan(0);
  });

  it("returns not_found for non-existent suffix/SKU", () => {
    const res = lookupBySuffixOrSku("99999999999ZZZ");
    expect(res.status).toBe("not_found");
    expect(res.products.length).toBe(0);
  });

  it("matches by SKU directly", () => {
    const res = lookupBySuffixOrSku("06WMI4");
    expect(res.status).toBe("exact_match");
    expect(res.resolvedBarcode).toBe("06281016276458");
  });

  it("resolves suffix 63527 to Mirinda Citrus Zero barcode", () => {
    const res = lookupBySuffixOrSku("63527");
    expect(res.status).toBe("exact_match");
    expect(res.resolvedBarcode).toBe("00012000063527");
    expect(res.matchedProduct?.name).toContain("Mirinda Citrus");
  });

  it("resolves secondary barcode suffix in multi-barcode products", () => {
    // 081036 -> Lusine White Sliced Bread 600g (06281100081036)
    const res = lookupBySuffixOrSku("081036");
    expect(res.status).toBe("exact_match");
    expect(res.resolvedBarcode).toBe("06281100081036");
    expect(res.matchedProduct?.name).toContain("Lusine");
  });
});
