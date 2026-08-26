import { describe, expect, it } from "vitest";
import { isValidEan13, validateDetectedNumber, validateExactDigits } from "./number";

describe("strict barcode number validation", () => {
  it("accepts one unchanged six-digit value", () => {
    expect(validateExactDigits("123456")).toEqual({ valid: true, value: "123456" });
  });

  it.each(["12 3456", "12-3456", "12.3456", "ABC123456", "2026-08-26", "12:34:56", " 123456", "123456 "])(
    "rejects non-digit input without normalizing: %s",
    (value) => {
      expect(validateExactDigits(value)).toMatchObject({ valid: false });
    },
  );

  it("rejects an EAN-13 source with an invalid check digit", () => {
    expect(isValidEan13("4006381333931")).toBe(true);
    expect(isValidEan13("4006381333932")).toBe(false);
    expect(validateDetectedNumber("4006381333932", "EAN_13")).toMatchObject({ valid: false });
  });

  it("permits valid EAN-13 source data and arbitrary manual Code 128 data", () => {
    expect(validateDetectedNumber("4006381333931", "EAN_13")).toEqual({ valid: true, value: "4006381333931" });
    expect(validateDetectedNumber("1234567890123", "CODE_128")).toEqual({ valid: true, value: "1234567890123" });
  });
});
