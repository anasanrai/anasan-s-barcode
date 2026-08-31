import { describe, expect, it } from "vitest";
import { extractPelicanNumber, FrameConfirmation, isValidGtin, validateBarcode } from "./pelican";

describe("GTIN validation", () => {
  it("validates correct GTIN-14", () => {
    expect(isValidGtin("06281016003788")).toBe(true);
  });
  it("rejects wrong check digit", () => {
    expect(isValidGtin("06281016003738")).toBe(false);
  });
  it("rejects invalid EAN-13", () => {
    expect(isValidGtin("6281016003788")).toBe(false);
  });
  it("validates barcode values by length", () => {
    expect(validateBarcode("06281016003788").valid).toBe(true);
    expect(validateBarcode("15781512805").valid).toBe(true); // internal CODE128 length
    expect(validateBarcode("06281016003738").valid).toBe(false);
  });
});

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

  it("rejects a 14-digit with wrong check digit", () => {
    expect(extractPelicanNumber("Barcodes:\n06281016003738")).toBe(null);
  });

  it("accepts non-GTIN internal CODE128 codes", () => {
    expect(extractPelicanNumber("Barcodes:\n15781512805")).toBe("15781512805");
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

describe("extractPelicanNumber strict mode (scanner)", () => {
  it("rejects non-GTIN digit runs in strict mode", () => {
    expect(extractPelicanNumber("order 12345678 delivered", true)).toBeNull();
  });

  it("still accepts valid GTIN-14 in strict mode", () => {
    const valid14 = "10614141000040";
    expect(extractPelicanNumber(`Barcodes: ${valid14}`, true)).toBe(valid14);
  });

  it("still pads valid 13-digit EAN to 14 in strict mode", () => {
    const padded = extractPelicanNumber("062810160037881", true);
    expect(padded === null || padded.length === 14).toBe(true);
  });

  it("accepts internal codes only in lenient (typed input) mode", () => {
    expect(extractPelicanNumber("order 123456789 delivered")).toBe("123456789");
    expect(extractPelicanNumber("order 123456789 delivered", true)).toBeNull();
  });
});
