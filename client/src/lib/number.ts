export const MIN_BARCODE_LENGTH = 6;
export const MAX_BARCODE_LENGTH = 64;

export type NumberValidation =
  | { valid: true; value: string }
  | { valid: false; message: string };

/**
 * Accept a number only when its literal, unchanged value is safe to encode.
 * Do not trim, strip, concatenate, or otherwise normalize user/scan input.
 */
export function validateExactDigits(value: string): NumberValidation {
  if (!value) {
    return { valid: false, message: "Enter a number to create a barcode." };
  }
  if (!/^\d+$/.test(value)) {
    return { valid: false, message: "Use digits only. Spaces, punctuation, and letters are not accepted." };
  }
  if (value.length < MIN_BARCODE_LENGTH) {
    return { valid: false, message: `Use at least ${MIN_BARCODE_LENGTH} digits for a reliable label.` };
  }
  if (value.length > MAX_BARCODE_LENGTH) {
    return { valid: false, message: `Use no more than ${MAX_BARCODE_LENGTH} digits.` };
  }
  return { valid: true, value };
}

/** Validates the GS1 modulo-10 check digit for an EAN-13 source barcode. */
export function isValidEan13(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false;
  const body = value.slice(0, 12);
  const sum = body.split("").reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  const expected = (10 - (sum % 10)) % 10;
  return expected === Number(value[12]);
}

export function validateDetectedNumber(value: string, sourceFormat: "CODE_128" | "EAN_13"): NumberValidation {
  const exact = validateExactDigits(value);
  if (!exact.valid) return exact;
  if (sourceFormat === "EAN_13" && !isValidEan13(value)) {
    return { valid: false, message: "This EAN-13 barcode has an invalid check digit." };
  }
  return exact;
}
