import { describe, expect, it } from "vitest";
import { extractPelicanNumber, FrameConfirmation } from "./pelican";

describe("pelican extractor", () => {
  it("extracts 14-digit after Barcodes label", () => {
    expect(extractPelicanNumber("Barcodes:\n06281016003788\nSKU: 123")).toBe("06281016003788");
  });
  it("preserves leading zero as string", () => {
    const r = extractPelicanNumber("Barcodes: 06281016003788");
    expect(r).toBe("06281016003788");
    expect(r![0]).toBe("0");
  });
  it("ignores SKU shorter numbers when 14 exists", () => {
    expect(extractPelicanNumber("SKU 41234 Price 12.5 Barcodes: 06281016003788 Quantity 1")).toBe("06281016003788");
  });
  it("returns null when no 14-digit present (no guessing)", () => {
    expect(extractPelicanNumber("SKU 41234 Price 12")).toBeNull();
    expect(extractPelicanNumber("Barcodes: 12345")).toBeNull();
  });
  it("handles Arabic and extra text noise", () => {
    expect(extractPelicanNumber("المنتج\nBarcodes:\n06281016003788\nالسعر 10")).toBe("06281016003788");
  });
});

describe("frame confirmation", () => {
  it("requires 3 identical frames", () => {
    const f = new FrameConfirmation(3);
    expect(f.push("06281016003788")).toBeNull();
    expect(f.push("06281016003788")).toBeNull();
    expect(f.push("06281016003788")).toBe("06281016003788");
  });
  it("resets on different value", () => {
    const f = new FrameConfirmation(2);
    expect(f.push("11111111111111")).toBeNull();
    expect(f.push("22222222222222")).toBeNull();
    expect(f.push("22222222222222")).toBe("22222222222222");
  });
  it("resets on null", () => {
    const f = new FrameConfirmation(2);
    f.push("06281016003788");
    f.push(null);
    expect(f.push("06281016003788")).toBeNull();
  });
});
