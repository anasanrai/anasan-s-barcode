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

  it("extracts from real Pelican simulator screen with product name, SKU, and Barcodes label", () => {
    const screenText = `
Al Batal Cheese Flavor Potato Chips
12x23g

SKU: XOHQ95

Barcodes:
06281016003788
`;
    expect(extractPelicanNumber(screenText)).toBe("06281016003788");
  });

  it("handles space or dash separated numbers from OCR", () => {
    expect(extractPelicanNumber("Barcodes: 0628 1016 0037 88")).toBe("06281016003788");
    expect(extractPelicanNumber("Barcodes: 0628-1016-003788")).toBe("06281016003788");
  });

  it("handles OCR letter-O as zero", () => {
    expect(extractPelicanNumber("Barcodes:\nO6281O16OO3788")).toBe("06281016003788");
  });

  it("converts 13-digit EAN after Barcodes label to 14-digit Pelican format", () => {
    expect(extractPelicanNumber("Barcodes:\n6281016003788")).toBe("06281016003788");
  });

  it("ignores SKU shorter numbers when 14 exists", () => {
    expect(extractPelicanNumber("SKU 41234 Price 12.5 Barcodes: 06281016003788 Quantity 1")).toBe("06281016003788");
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
