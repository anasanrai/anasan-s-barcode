import { describe, expect, it } from "vitest";
import { selectNumericLinearBarcode } from "./barcodeGuard";

describe("selectNumericLinearBarcode", () => {
  it("accepts a numeric linear barcode while rejecting QR payloads and nearby text", () => {
    const result = selectNumericLinearBarcode([
      { value: "1900494833", format: "qr_code", bbox: { x0: 0, y0: 0, x1: 40, y1: 40 } },
      { value: "6281007120401", format: "ean_13", bbox: { x0: 40, y0: 50, x1: 320, y1: 120 } },
      { value: "MADE IN CHINA", format: "code_128", bbox: { x0: 0, y0: 140, x1: 200, y1: 180 } },
    ], 6, 64);
    expect(result?.value).toBe("6281007120401");
  });

  it("rejects a barcode payload outside the allowed numeric length", () => {
    const result = selectNumericLinearBarcode([{ value: "1234", format: "code_128", bbox: { x0: 0, y0: 0, x1: 40, y1: 20 } }], 6, 64);
    expect(result).toBeNull();
  });
});
