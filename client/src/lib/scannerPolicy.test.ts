import { BarcodeFormat } from "@zxing/library";
import { describe, expect, it } from "vitest";
import { evaluateDecodedBarcode, supportedSourceFormat, UNSUPPORTED_BARCODE_MESSAGE } from "./scannerPolicy";

describe("scanner format policy", () => {
  it("accepts only numeric 1D source formats", () => {
    expect(supportedSourceFormat(BarcodeFormat.CODE_128)).toBe("CODE_128");
    expect(supportedSourceFormat(BarcodeFormat.EAN_13)).toBe("EAN_13");
  });

  it("ignores QR and unsupported barcode formats", () => {
    expect(supportedSourceFormat(BarcodeFormat.QR_CODE)).toBeNull();
    expect(supportedSourceFormat(BarcodeFormat.CODE_39)).toBeNull();
    expect(supportedSourceFormat(BarcodeFormat.DATA_MATRIX)).toBeNull();
    expect(UNSUPPORTED_BARCODE_MESSAGE).toContain("enter the exact digits manually");
    expect(evaluateDecodedBarcode("123456", BarcodeFormat.QR_CODE)).toEqual({ kind: "reject", message: UNSUPPORTED_BARCODE_MESSAGE });
  });

  it("accepts only unchanged numeric supported payloads", () => {
    expect(evaluateDecodedBarcode("123456", BarcodeFormat.CODE_128)).toEqual({ kind: "accept", value: "123456" });
    expect(evaluateDecodedBarcode("12-3456", BarcodeFormat.CODE_128)).toMatchObject({ kind: "reject" });
    expect(evaluateDecodedBarcode("4006381333932", BarcodeFormat.EAN_13)).toMatchObject({ kind: "reject" });
  });
});
