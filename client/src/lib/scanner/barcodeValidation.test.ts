import { describe, expect, it } from "vitest";
import {
  calculateGtinCheckDigit,
  detectBarcodeFormat,
  extractNumericCandidate,
  isValidGtinChecksum,
  validateBarcodeString,
} from "./barcodeValidation";

describe("barcodeValidation engine", () => {
  describe("GTIN check digit calculation & validation", () => {
    it("correctly computes standard GTIN-14 check digit", () => {
      // 0628101600378 + check digit 8
      expect(calculateGtinCheckDigit("0628101600378")).toBe(8);
      expect(isValidGtinChecksum("06281016003788")).toBe(true);
      expect(isValidGtinChecksum("06281016003780")).toBe(false);
    });

    it("correctly computes standard EAN-13 check digit", () => {
      // 590123412345 + check digit 7
      expect(calculateGtinCheckDigit("590123412345")).toBe(7);
      expect(isValidGtinChecksum("5901234123457")).toBe(true);
      expect(isValidGtinChecksum("5901234123450")).toBe(false);
    });

    it("correctly computes UPC-A check digit", () => {
      // 01234567890 + check digit 5
      expect(calculateGtinCheckDigit("01234567890")).toBe(5);
      expect(isValidGtinChecksum("012345678905")).toBe(true);
    });

    it("correctly computes EAN-8 check digit", () => {
      // 9638507 + check digit 4
      expect(calculateGtinCheckDigit("9638507")).toBe(4);
      expect(isValidGtinChecksum("96385074")).toBe(true);
    });
  });

  describe("String preservation & leading zeroes", () => {
    it("strictly preserves leading zeroes as strings", () => {
      const code = "000012345678";
      expect(typeof code).toBe("string");
      expect(code.startsWith("0000")).toBe(true);
      expect(validateBarcodeString(code).valid).toBe(true);
    });

    it("validates arbitrary numeric strings of different lengths", () => {
      // 6-digit code
      expect(validateBarcodeString("123456").valid).toBe(true);
      // 10-digit code
      expect(validateBarcodeString("9876543210").valid).toBe(true);
      // 14-digit GTIN
      expect(validateBarcodeString("06281016003788").valid).toBe(true);
    });

    it("rejects non-numeric characters when digitsOnly is true", () => {
      expect(validateBarcodeString("12345A").valid).toBe(false);
      expect(validateBarcodeString("ABCDEF").valid).toBe(false);
    });

    it("rejects codes shorter than minLength", () => {
      expect(validateBarcodeString("12345", { minLength: 6 }).valid).toBe(false);
      expect(validateBarcodeString("123456", { minLength: 6 }).valid).toBe(true);
    });
  });

  describe("OCR text candidate extraction", () => {
    it("extracts clean numeric string from raw OCR text with surrounding noise", () => {
      const ocr = "Item Code:\n06281016003788\nPrice $9.99";
      expect(extractNumericCandidate(ocr)).toBe("06281016003788");
    });

    it("handles OCR space separation inside digit groups", () => {
      const ocr = "0628 1016 0037 88";
      expect(extractNumericCandidate(ocr)).toBe("06281016003788");
    });

    it("corrects OCR letter-O and letter-l when adjacent to digits", () => {
      const ocr = "O6281O16OO3788";
      expect(extractNumericCandidate(ocr)).toBe("06281016003788");
    });

    it("extracts 6-digit arbitrary numbers", () => {
      const ocr = "Verification: 839201 Active";
      expect(extractNumericCandidate(ocr)).toBe("839201");
    });

    it("preserves leading zero on short and long numbers", () => {
      const ocr = "Batch: 004921";
      const result = extractNumericCandidate(ocr);
      expect(result).toBe("004921");
      expect(result?.[0]).toBe("0");
    });
  });

  describe("Format detection", () => {
    it("detects ITF-14 for 14-digit GTIN", () => {
      expect(detectBarcodeFormat("06281016003788")).toBe("ITF14");
    });

    it("detects EAN-13 for 13-digit EAN", () => {
      expect(detectBarcodeFormat("5901234123457")).toBe("EAN13");
    });

    it("detects UPC for 12-digit UPC", () => {
      expect(detectBarcodeFormat("012345678905")).toBe("UPC");
    });

    it("detects EAN-8 for 8-digit EAN", () => {
      expect(detectBarcodeFormat("96385074")).toBe("EAN8");
    });

    it("defaults to CODE128 for arbitrary numeric or alphanumeric strings", () => {
      expect(detectBarcodeFormat("123456")).toBe("CODE128");
      expect(detectBarcodeFormat("9876543210")).toBe("CODE128");
      expect(detectBarcodeFormat("AN-2026")).toBe("CODE128");
    });
  });
});
