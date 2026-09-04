import { describe, expect, it } from "vitest";
import { detectBarcodeFormat, validateBarcode } from "@/lib/pelican";

describe("Barcode Format Detection & Validation", () => {
  it("detects GTIN-14 as ITF14", () => {
    expect(detectBarcodeFormat("06281016003788")).toBe("ITF14");
    expect(validateBarcode("06281016003788").valid).toBe(true);
  });

  it("detects 13 digits as EAN13", () => {
    expect(detectBarcodeFormat("6281016003788")).toBe("EAN13");
  });

  it("detects 12 digits as UPC", () => {
    expect(detectBarcodeFormat("012345678905")).toBe("UPC");
  });

  it("detects 8 digits as EAN8", () => {
    expect(detectBarcodeFormat("12345670")).toBe("EAN8");
  });

  it("detects arbitrary length numeric codes as CODE128", () => {
    expect(detectBarcodeFormat("15781512805")).toBe("CODE128");
    expect(detectBarcodeFormat("998877665544332211")).toBe("CODE128");
  });
});
