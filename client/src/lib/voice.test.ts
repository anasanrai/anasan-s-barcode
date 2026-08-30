import { describe, expect, it } from "vitest";
import { normalizeSpokenInput } from "./voice";

describe("voice normalizer", () => {
  it("converts spoken single digits to numeric string", () => {
    expect(normalizeSpokenInput("zero six two eight one zero", true)).toBe("062810");
  });

  it("handles numbers already formatted as digits", () => {
    expect(normalizeSpokenInput("06281016003788", true)).toBe("06281016003788");
    expect(normalizeSpokenInput("0628 1016 003788", true)).toBe("06281016003788");
  });

  it("handles double and triple word patterns", () => {
    expect(normalizeSpokenInput("double five double zero", true)).toBe("5500");
    expect(normalizeSpokenInput("triple zero seven", true)).toBe("0007");
  });

  it("handles Arabic spoken digits and Eastern Arabic numerals", () => {
    expect(normalizeSpokenInput("صفر ستة اثنين ثمانية", true)).toBe("0628");
    expect(normalizeSpokenInput("٠٦٢٨١٠١٦", true)).toBe("06281016");
  });

  it("handles alphanumeric input for Code 128 / Code 39", () => {
    expect(normalizeSpokenInput("X O H Q nine five", false)).toBe("XOHQ95");
  });

  it("strips invalid non-numeric chars in numericOnly mode", () => {
    expect(normalizeSpokenInput("item number 1 2 3 4 5 please", true)).toBe("12345");
  });
});
