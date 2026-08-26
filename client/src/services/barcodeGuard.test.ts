import { describe, expect, it } from "vitest";
import { selectNumericLinearBarcode } from "../barcodeGuard";

describe("selectNumericLinearBarcode", () => {
  it("selects numeric linear barcode", () => {
    const detections = [
      { value: "12345678", format: "code_128", bbox: { x0: 0, y0: 0, x1: 100, y1: 20 } },
      { value: "ABC", format: "code_128", bbox: { x0: 0, y0: 0, x1: 100, y1: 20 } },
    ];
    const result = selectNumericLinearBarcode(detections, 4, 20);
    expect(result?.value).toBe("12345678");
  });

  it("rejects non-numeric", () => {
    const detections = [
      { value: "ABC123", format: "code_128", bbox: { x0: 0, y0: 0, x1: 100, y1: 20 } },
    ];
    expect(selectNumericLinearBarcode(detections, 4, 20)).toBeNull();
  });

  it("rejects QR codes", () => {
    const detections = [
      { value: "12345678", format: "qr_code", bbox: { x0: 0, y0: 0, x1: 100, y1: 20 } },
    ];
    expect(selectNumericLinearBarcode(detections, 4, 20)).toBeNull();
  });
});
