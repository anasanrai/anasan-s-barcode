/** Signal Field design system: deterministic number cleaning and strict barcode validation keep user data precise. */

export type BarcodeFormat = "CODE128" | "CODE39" | "EAN13";

export type NumberValidation = {
  valid: boolean;
  message?: string;
  recommendation?: string;
};

export function cleanNumberInput(raw: string): string {
  if (!raw) return "";
  if (!/^\d+$/.test(raw)) {
    throw new Error(
      "Enter digits 0–9 only. Spaces and separators are not changed."
    );
  }
  return raw;
}

export function calculateEan13CheckDigit(digits: string): string {
  if (!/^\d{12}$/.test(digits))
    throw new Error("EAN-13 requires 12 digits to calculate a check digit.");
  const sum = digits
    .split("")
    .reduce(
      (total, digit, index) =>
        total + Number(digit) * (index % 2 === 0 ? 1 : 3),
      0
    );
  return String((10 - (sum % 10)) % 10);
}

export function validateNumber(
  value: string,
  format: BarcodeFormat,
  minLength: number,
  maxLength: number
): NumberValidation {
  if (!value)
    return { valid: false, message: "Enter or capture a number first." };
  if (!/^\d+$/.test(value))
    return { valid: false, message: "Numeric mode accepts digits 0–9 only." };
  if (value.length < minLength)
    return { valid: false, message: `Use at least ${minLength} digits.` };
  if (value.length > maxLength)
    return { valid: false, message: `Use no more than ${maxLength} digits.` };

  if (format === "EAN13" && value.length !== 12 && value.length !== 13) {
    return {
      valid: false,
      message:
        "EAN-13 needs exactly 12 digits (check digit added) or 13 digits.",
      recommendation: "Use Code 128 for other numeric lengths.",
    };
  }

  if (format === "EAN13" && value.length === 13) {
    const expected = calculateEan13CheckDigit(value.slice(0, 12));
    if (value.at(-1) !== expected) {
      return {
        valid: false,
        message: "The EAN-13 check digit does not match the first 12 digits.",
        recommendation:
          "Correct the number or use Code 128 for arbitrary numeric values.",
      };
    }
  }

  return { valid: true };
}

export function barcodeValue(value: string, format: BarcodeFormat): string {
  if (format === "EAN13" && value.length === 12)
    return `${value}${calculateEan13CheckDigit(value)}`;
  return value;
}

export function barcodeScanWarning(
  value: string,
  format: BarcodeFormat
): string | null {
  if (format === "CODE128" && value.length > 30)
    return "This Code 128 value is dense. Use a larger print size and keep the full white margin visible.";
  if (format === "CODE39" && value.length > 24)
    return "This Code 39 value is dense. Use a larger print size and keep the full white margin visible.";
  return null;
}
