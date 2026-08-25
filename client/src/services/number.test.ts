/** Signal Field design system: domain tests protect exact user-entered digits and barcode compatibility. */

import { describe, expect, it } from "vitest";
import {
  barcodeValue,
  calculateEan13CheckDigit,
  cleanNumberInput,
  validateNumber,
} from "./number";

describe("number parsing", () => {
  it("preserves an exact digits-only manual value", () => {
    expect(cleanNumberInput("0123456789")).toBe("0123456789");
  });

  it("rejects letters", () => {
    expect(() => cleanNumberInput("12AB34")).toThrow("digits 0–9 only");
  });

  it("rejects mixed text rather than silently extracting its digits", () => {
    expect(() => cleanNumberInput("ABC 12345")).toThrow("digits 0–9 only");
  });

  it("rejects separators rather than silently modifying a manual value", () => {
    expect(() => cleanNumberInput("12 345-678.90")).toThrow("digits 0–9 only");
    expect(() => cleanNumberInput("12/345")).toThrow("digits 0–9 only");
  });
});

describe("barcode compatibility", () => {
  it("enforces configured numeric lengths", () => {
    expect(validateNumber("123", "CODE128", 4, 30).valid).toBe(false);
    expect(validateNumber("1234", "CODE128", 4, 30).valid).toBe(true);
    expect(validateNumber("1".repeat(31), "CODE128", 4, 30).valid).toBe(false);
  });

  it("calculates an EAN-13 check digit for 12-digit input", () => {
    expect(calculateEan13CheckDigit("400638133393")).toBe("1");
    expect(barcodeValue("400638133393", "EAN13")).toBe("4006381333931");
  });

  it("rejects invalid EAN-13 input lengths", () => {
    expect(validateNumber("1234567890", "EAN13", 4, 30).valid).toBe(false);
  });

  it("rejects a supplied 13-digit EAN with an invalid check digit", () => {
    const result = validateNumber("4006381333932", "EAN13", 4, 30);
    expect(result.valid).toBe(false);
    expect(result.message).toContain("check digit");
  });

  it("keeps Code 128 as the safe option for arbitrary configured numeric lengths", () => {
    expect(
      validateNumber("123456789012345678901234567890", "CODE128", 4, 30).valid
    ).toBe(true);
    expect(
      validateNumber("123456789012345678901234567890", "EAN13", 4, 30).valid
    ).toBe(false);
  });
});
