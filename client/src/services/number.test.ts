import { describe, expect, it } from "vitest";
import {
  assertNumericInput,
  sanitizeNumericInput,
  calculateEan13CheckDigit,
  validateNumber,
  barcodeValue,
} from "../number";

describe("assertNumericInput", () => {
  it("returns digits only", () => {
    expect(assertNumericInput("12345")).toBe("12345");
  });

  it("throws on letters", () => {
    expect(() => assertNumericInput("ABC123")).toThrow();
  });

  it("throws on separators", () => {
    expect(() => assertNumericInput("12-34")).toThrow();
  });

  it("returns empty string for empty input", () => {
    expect(assertNumericInput("")).toBe("");
  });
});

describe("sanitizeNumericInput", () => {
  it("strips non-digits", () => {
    expect(sanitizeNumericInput("12-34.56")).toBe("123456");
  });

  it("returns empty for empty input", () => {
    expect(sanitizeNumericInput("")).toBe("");
  });
});

describe("calculateEan13CheckDigit", () => {
  it("calculates correct check digit", () => {
    expect(calculateEan13CheckDigit("4006381333931".slice(0, 12))).toBe("1");
  });

  it("throws for wrong length", () => {
    expect(() => calculateEan13CheckDigit("123")).toThrow();
  });
});

describe("validateNumber", () => {
  it("validates CODE128 length", () => {
    expect(validateNumber("12345678", "CODE128", 4, 20).valid).toBe(true);
    expect(validateNumber("12", "CODE128", 4, 20).valid).toBe(false);
    expect(validateNumber("123456789012345678901", "CODE128", 4, 20).valid).toBe(false);
  });

  it("validates EAN13", () => {
    expect(validateNumber("123456789012", "EAN13", 12, 13).valid).toBe(true);
    expect(validateNumber("1234567890128", "EAN13", 12, 13).valid).toBe(false); // wrong check digit
  });

  it("rejects non-numeric", () => {
    expect(validateNumber("ABC", "CODE128", 4, 20).valid).toBe(false);
  });
});

describe("barcodeValue", () => {
  it("adds check digit for EAN13", () => {
    expect(barcodeValue("123456789012", "EAN13")).toBe("1234567890128");
  });

  it("passes through CODE128", () => {
    expect(barcodeValue("12345", "CODE128")).toBe("12345");
  });
});
